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
	async.waterfall([
		function(callback) {
			var results = [];
			var lookup;
			getAllDb({}, function(err, result){
				if (result.length === 0) {
					lookup = ['AAPL', 'GOOGL'];
					results = [];
				} else {
					lookup = [];
					for (var i in result) {
						lookup.push(result[i].key)
						results.push(result[i])
					}
				}
				callback(null, lookup, results);
				//lookup is symbols of existing DB stock data ... ['AAPL', 'GOOGL'] if DB is empty
				//results is DB data ... [] if DB is empty
			})
		},
		function(lookup, results, callback) {
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
			callback(null, lookup, new_lookup, results);
			//results may still be []
			//new_lookup is symbols to lookup for populating the DB
		},
		function(lookup, new_lookup, results, callback) {
			var index;
			if (new_lookup.length > 0) {
				index = results.length;
				async.map(new_lookup, loadSnapshot, function(err, result){
					for (var i in result) {
						results.push(result[i])	
					}
					//console.log(new_lookup)
					callback(null, index, new_lookup, results);
					//the next function will update stock_array array for new_lookup only
				})
			} else {
				index = 0;
				callback(null, index, lookup, results);
				//the next function will update stock_array array for existing DB docs
			}
		},
		function(index, lookup, results, callback) {
			var accumulated_index = index;
			//console.log(results)
			var accumulated = results;
			async.map(lookup, getStockInfo, function(err, result){
				var prop = Object.getOwnPropertyNames(result)

				for (var i in result) {

					var arrays = _.find(result[prop[i]], function(item) {
						return Array.isArray(item)
					})
					accumulated[accumulated_index].stock_array = arrays;
					accumulated_index++;
				}
				callback(null, accumulated)
			})
		}
	], function(err, results) {
		if (err) {
			return next(err)
		}
		var dots = [];
		Stock.update({}, results, {safe: true, upsert: true, multi: true}, function(error, docs){
			if (error) {
				return next(error)
			}
			function filterByKey(obj) {
				if (obj.hasOwnProperty('caster')) {
			        return false;
			    }
			    return true;
			}
			

			var arr = results.filter(filterByKey);
			for(var i in arr) {
				for (var j in arr[i].stock_array) {
					arr[i].stock_array[j].date = moment(arr[i].stock_array[j].date);
					dots.push(arr[i].stock_array[j])
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

		Stock.findOneAndRemove({key: symbol}, function(error, data) {
			if (error) {
				callback(error);
			}
			callback(null);
		});
	  },
	  function(callback){
		Stock.find().lean().exec(function(err, docs){
			if (err) {
				callback(err);
			}
			callback(null, docs);
		});
	  }
	], function (err) {
		if (err) {
			return next(err);
		}
		return res.redirect('/');
		var dots = [];
		for(var i in result) {
			for (var j in result[i].stock_array) {
				result[i].stock_array[j].date = moment(result[i].stock_array[j].date);
				dots.push(result[i].stock_array[j])
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
	var start_date = req.body.start_date;
	var end_date = req.body.end_date;
	
	console.log(end_date)
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
			
			var results = docs;
			async.map(symbol, loadSnapshot, function(err, result){
				for (var i in result) {
					results.push(result[i])	
				}
				callback(null, results/*, new_stocks*/);
			})
	  	},
		function(results/*, new_stocks*/, callback){
			
			if (start_date === null || start_date === undefined || start_date === '') {
				end_date = new Date();//.toISOString();
				var year = end_date.getFullYear();
				var month = end_date.getMonth();
				var day = end_date.getDate();
				//console.log(to)
				var makeDate = new Date(year-1, month, day); 
				end_date = new Date();
				//new Date(start);//.toISOString();//new Date();
				end_date.setTime(makeDate.getTime());
			}
			//var date_range = [start_date, end_date];
			async.map(start_date, end_date, symbol, getStockInfo, function(err, result){
				var all_stocks = results;
				var prop = Object.getOwnPropertyNames(result)
				var index = all_stocks.length - symbol.length;
				for (var i = 0; i < result.length; i++) {
					//var initial_length = results.length;
					var arrays = _.find(result[prop[i]], function(item) {
						return Array.isArray(item)
					})
					all_stocks[index].stock_array = arrays;
					index++;
				}
				console.log(start_date)
				callback(null, all_stocks/*, added_stocks*/);
			})
		},
		function(results, /*new_stocks,*/ callback) {
			insertNew(results, function(err, result){
				callback(null, results);
			})
								
		}
	], function (err, result) {
	  // result now equals 'done' 
		if (err) {
			return next(err)
		}
		var dots = [];
		
		//var keys = Object.keys(Stock.schema.paths);
		function filterByKey(obj) {
			if (obj.hasOwnProperty('caster')) {
		        return false;
		    }
		    return true;
		}
		var arr = result.filter(filterByKey);
		for(var i in arr) {
			for (var j in arr[i].stock_array) {
				arr[i].stock_array[j].date = moment(arr[i].stock_array[j].date);
				dots.push(arr[i].stock_array[j])
			}				
		}
							
		return res.render('index', {
			start: start_date,
			end: end_date,
			data: result,
			dots: dots
		});
	});
	
});

function filteredLookup(lookup, results, callback) {
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
	callback(null, new_lookup);
}

function getAllDb(lookup, callback) {
	Stock.find(lookup).lean().exec(function(err, docs) {
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
			if (stockFilter !== -1) {
				
				Stock.findOneAndUpdate({key: all_stocks[0].key}, all_stocks[0], {safe: true, upsert: false}, function(err, docs){
					if (err) {
						return console.log(err);
					}
				})
				
			} else {
				stock = new Stock(all_stocks[0]);
				stock.save(all_stocks[0], function(err, stock){
					if (err) {
						console.log(err)
					}
				})
			}
			all_stocks.shift();
		}
		//find.().lean() ftw
		Stock.find().lean().exec(function(err, docs){
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
			stock_array: []
		}
		callback(null, quotes);
	});	
}

function getStockInfo(start, end, lookup, callback) {
	//console.log(start)
	//var to = moment(end);
	//new Date(end);//.toISOString();
	/*var year = to.getFullYear();
	var month = to.getMonth();
	var day = to.getDate();
	//console.log(to)
	var makeDate = new Date(year, month, day); */
	//var histDate = moment(start);
	//new Date(start);//.toISOString();//new Date();
	//histDate.setTime(makeDate.getTime());
	start = new Date(start);
	end = new Date(start);
	console.log(start)
	yahooFinance.historical({
		symbols: [lookup],
		from: start,
		to: end
	}, function(error, results){
		if (error) {
			return callback(error)
		}
		callback(null, results)
	});
}



module.exports = router;
