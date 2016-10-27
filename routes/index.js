var express = require('express');
var Stock = require('../models/stocks');
var multer  = require('multer');
//var waterfall = require('async-waterfall');
//var timeFormat = require('d3-time-format');
var moment = require('moment');
var _ = require('underscore');
var url = require('url');
var dotenv = require('dotenv');
var async = require("async");
var yahooFinance = require('yahoo-finance');
var router = express.Router();

var upload = multer();

dotenv.load();


/* GET home page. */
router.get('/', function(req, res, next) {
	//console.log(typeof ISODate("2016-10-06T06:00:00Z"))
	var results = [];
	var lookup;
	var index = 0;
	async.series([
		function(callback) {
			getAllDb({}, function(err, result){
				if (result.length === 0) {
					lookup = ['AAPL', 'GOOGL'];
					results = [];
				} else {
					lookup = [];
					for (var i in result) {
						lookup.push(result[i].key)
						results.push(result[i])
						index++;
					}
					//var dateFormat = result[0].values[0].date;
					//console.log(dateFormat)
				}
				callback();
			})
		},
		function(callback) {
			var new_lookup = [];
			for (var i in lookup) {
				function myIndexOf(this_symbol) {
					for (var i = 0; i < results.length; i++) {
						if (results[i].key === this_symbol) {
							return results[i].key;
						}
					}  
					return -1;
				}
				var stockFilter = myIndexOf(lookup[i]);
				if (stockFilter === -1) {
					new_lookup.push(lookup[i]);
				}
				
			}
			if (new_lookup.length > 0) {
				async.map(new_lookup, loadSnapshot, function(err, result){
					for (var i in result) {
						results.push(result[i])					
					}
					callback();
				})
			} else {
				callback();
			}
		},
		function(callback) {
			async.map(lookup, getStockInfo, function(err, result){
				var prop = Object.getOwnPropertyNames(result)

				for (var i in result) {

					var arrays = _.find(result[prop[i]], function(item) {
						return Array.isArray(item)
					})
					results[index].values = arrays;
					index++;
				}
				callback()
			})
		}
	], function(err) {
		if (err) {
			return next(err)
		}
		var dots = [];
		Stock.update({}, results, {safe: true, upsert: true, multi: true}, function(error, docs){
			if (error) {
				return next(error)
			}
			for(var i in results) {
				for (var j in results[i].values) {
					//var date = 
					//var format = timeFormat("%Y-%m-%dT%H:%M:%S.%LZ");
					results[i].values[j].date = moment(results[i].values[j].date);
					dots.push(results[i].values[j])
				}				
			}
					
		});
		
		
		return res.render('index', {
			data: results,
			dots: dots
		});
	})
});


router.delete('/delete/:symbol', function(req, res, next){
	var symbol = req.params.symbol;
	async.waterfall([
	  function(callback){
		
	    //callback(null, 'one', 'two');
		Stock.findOneAndRemove({key: symbol}, function(error, data) {
			if (error) {
				callback(error);
			}
			callback(null);
		});
	  },
	  function(callback){
		Stock.find(function(err, docs){
			if (err) {
				callback(err);
			}
			callback(null, docs);
		});
	  }
	], function (err, result) {
		if (err) {
			return next(err);
		}
		var dots = [];
		for(var i in result) {
			for (var j in result[i].values) {
				results[i].values[j].date = moment(results[i].values[j].date);
				dots.push(result[i].values[j])
			}				
		}
		return res.render('index', { 
			data: result,
			dots: dots
		});
	});
});

router.post('/add', upload.array(), function(req, res, next) {
	var re = /\s*,\s*/;	
	var symbol = req.body.symbol.split(re);	
	console.log(symbol)
	
	async.waterfall([
		function(callback){
	    	//callback(null, 'one', 'two');
			Stock.find(function(err, docs) {
				if (err) {
					callback(err)
				}
				if (docs.length === 0) {
					callback(null, []/*, []*/);
				} else {
					callback(null, docs/*, []*/);
				}			
			})	
		},
	  	function(docs/*, empty_array*/, callback){
	    	//callback(null, 'three');
			var results = docs;
			//var new_stocks = empty_array;
			async.map(symbol, loadSnapshot, function(err, result){
				for (var i in result) {
					results.push(result[i])	
					//new_stocks.push(result[i])				
				}
				callback(null, results/*, new_stocks*/);
			})
	  	},
		function(results/*, new_stocks*/, callback){
	    	// arg1 now equals 'three' 
		    //callback(null, 'done');
			
			
			async.map(symbol, getStockInfo, function(err, result){
				var all_stocks = results;
				//var added_stocks = new_stocks;
				var prop = Object.getOwnPropertyNames(result)
				//console.log(results)
				var index = all_stocks.length - symbol.length;
				for (var i = 0; i < result.length; i++) {
					//var initial_length = results.length;
					var arrays = _.find(result[prop[i]], function(item) {
						return Array.isArray(item)
					})
					all_stocks[index].values = arrays;
					//added_stocks[i].values = arrays;
					index++;
				}
				callback(null, all_stocks/*, added_stocks*/);
			})
		},
		function(results, /*new_stocks,*/ callback) {
			insertNew(results, function(err, result){
				callback(null, result);
			})
								
		}
	], function (err, result) {
	  // result now equals 'done' 
		if (err) {
			return next(err)
		}
		var dots = [];
		
		for(var i in result) {
			for (var j in result[i].values) {
				results[i].values[j].date = moment(results[i].values[j].date);
				dots.push(result[i].values[j])
			}				
		}
		return res.render('index', {
			data: result,
			dots: dots
		});
	});
	
});

function getAllDb(lookup, callback) {
	Stock.find(lookup, function(err, docs) {
		if (err) {
			callback(err);
		}
		callback(null, docs);
	})
}

function insertNew(all_stocks, callback) {
	
	var symbols = all_stocks.map(function(obj){ 	   
	   return obj.key;
	});
	Stock.find({key: {$in : symbols }}, function(err, stock) {
		if (err) {
			console.log(err)
		}
		while (all_stocks.length > 0) {
			function myIndexOf(this_stock) {
				for (var i = 0; i < stock.length; i++) {
					if (stock[i].key === this_stock.key) {
						return stock[i];
					}
				}  
				return -1;
			}
			var stockFilter = myIndexOf(all_stocks[0]);
			/*var updateData = {
				name: all_stocks[0].name,
				key: all_stocks[0].key,
				values: [{
					open: Number,
					high: Number,
					low: Number,
					close: Number,
					volume: Number,
					adjClose: Number,
					symbol: String,
					date: Date
				}]
			}*/
			if (stockFilter !== -1) {
				
				Stock.findOneAndUpdate({key: all_stocks[0].key}, stockFilter, {upsert: false}, function(err, docs){
					if (err) {
						return console.log(err);
					}
				})
				
			} else {
				stock = new Stock(all_stocks[0]);
				stock.save(function(err){
					if (err) {
						console.log(err)
					}
				})
			}
			all_stocks.shift();
		}
		Stock.find(function(err, docs){
			if (err) {
				callback(err);
			}
			callback(null, docs)
		});
	})
}


function loadSnapshot(lookup, callback) {
	yahooFinance.snapshot({ 
		symbol: lookup,
		fields: ['s', 'n', 'd1', 'l1'] 
	}, function (err, quote) {
		if (err) {
			return callback(err);
		}
		var quotes = {
			key: quote.symbol,
			name: quote.name,
			values: []
		}
		callback(null, quotes);
	});	
}

function getStockInfo(lookup, callback) {
	
	var to = new Date();
	var year = to.getFullYear();
	var month = to.getMonth();
	var day = to.getDate();
	//console.log(to)
	var makeDate = new Date(year, month-1, day); 
	var histDate = new Date();
	histDate.setTime(makeDate.getTime());

	yahooFinance.historical({
		symbols: [lookup],
		from: histDate,
		to: to
	}, function(error, results){
		if (error) {
			return callback(error)
		}
		callback(null, results)
	});
}



module.exports = router;
