var express = require('express');
var Stock = require('../models/stocks');
var multer  = require('multer');
//var waterfall = require('async-waterfall');
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
	var results = [];
	var lookup;
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
					}
				}
				callback();
			})
		},
		function(callback) {
			async.map(lookup, loadSnapshot, function(err, result){
				for (var i in result) {
					results.push(result[i])					
				}
				callback();
			})
		},
		function(callback) {
			async.map(lookup, getStockInfo, function(err, result){
				var prop = Object.getOwnPropertyNames(result)

				for (var i in result) {

					var arrays = _.find(result[prop[i]], function(item) {
						return Array.isArray(item)
					})
					results[i].values = arrays;
				}
				callback()
			})
		}
	], function(err) {
		if (err) {
			return next(err)
		}
		var dots = [];
		
		for(var i in results) {
			for (var j in results[i].values) {
				dots.push(results[i].values[j])
			}				
		}
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
					callback(null, [], []);
				} else {
					callback(null, docs, []);
				}			
			})	
		},
	  	function(docs, empty_array, callback){
	    	//callback(null, 'three');
			var results = docs;
			var new_stocks = empty_array;
			async.map(symbol, loadSnapshot, function(err, result){
				for (var i in result) {
					results.push(result[i])	
					new_stocks.push(result[i])				
				}
				callback(null, results, new_stocks);
			})
	  	},
		function(results, new_stocks, callback){
	    	// arg1 now equals 'three' 
		    //callback(null, 'done');
			
			
			async.map(symbol, getStockInfo, function(err, result){
				var all_stocks = results;
				var added_stocks = new_stocks;
				var prop = Object.getOwnPropertyNames(result)
				//console.log(results)
				var index = all_stocks.length - symbol.length;
				for (var i = 0; i < result.length; i++) {
					//var initial_length = results.length;
					var arrays = _.find(result[prop[i]], function(item) {
						return Array.isArray(item)
					})
					all_stocks[index].values = arrays;
					added_stocks[i].values = arrays;
					index++;
				}
				callback(null, all_stocks, added_stocks);
			})
		},
		function(all_stocks, added_stocks, callback) {
			var results = all_stocks;
			var new_stocks = added_stocks;
			checkDbIndex(symbol, function(err, result){
				if (result.length === 0) {
					for (var i in new_stocks) {
						Stock.insertOne(new_stocks[i], function(error, doc) {
							if (error) {
								return console.log(error)
							}
						});
					}
					callback(null, results);
				} else {
					for (var i in result) {
						//var coords = {x: x, y: y};
						function myIndexOf(stock) {
							for (var i = 0; i < new_stocks.length; i++) {
								if (new_stocks[i].key === stock.key) {
									return new_stocks[i];
								}
							}  
							return -1;
						}
						var stockFilter = myIndexOf(result[i]);
						if (stockFilter !== -1) {
							Stock.findOneAndUpdate({key: result[i].key}, stockFilter, {upsert: true}, function(err, docs){
								if (err) {
									return console.log(err);
								}
							})
						}
					}
					callback(null, results);
				}				
			});
		}
	], function (err, result) {
	  // result now equals 'done' 
		if (err) {
			return next(err)
		}
		var dots = [];
		
		for(var i in result) {
			for (var j in result[i].values) {
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

function checkDbIndex(lookup, callback) {
	Stock.find({ key: { $in: lookup } }, function(err, docs){
		if (err) {
			callback(err);
		}
		callback(null, docs);
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
	var makeDate = new Date(year-1, month, day); 
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
