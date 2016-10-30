var express = require('express');
var Stock = require('../models/stocks');
var multer  = require('multer');
var moment = require('moment');
var _ = require('underscore');
var url = require('url');
var dotenv = require('dotenv');
var async = require("async");
var yahooFinance = require('yahoo-finance');
var router = express.Router();

var upload = multer();

dotenv.load();

router.get('/', function(req, res) {
	getDataDots(req, function(response) {
		req.session.data = response.data;
		req.session.dots = response.dots;
		return res.render('index', {
			data: response.data,
			dots: response.dots
		})
	})
})

/* GET home page. */
router.get('/api', function(req, res) {
	getDataDots(req, function(response) {
		req.session.data = response.data;
		req.session.dots = response.dots;
		res.json({
			data: response.data,
			dots: response.dots
		})
	})
});

router.delete('/delete/:symbol', function(req, res, next){
	var symbol = req.params.symbol;
	
	async.waterfall([
	  function(next){

		Stock.findOneAndRemove({key: symbol}, function(error, data) {
			if (error) {
				next(error);
			}
			next();
		});
	  },
	  function(next){
		Stock.find().lean().exec(function(err, result){
			if (err) {
				next(err);
			}
			
			next(null, result);
		});
	  },
		function (result, next) {
			var dots = [];
			for(var i in result) {
				for (var j in result[i].stock_array) {
					result[i].stock_array[j].date = moment(result[i].stock_array[j].date);
					dots.push(result[i].stock_array[j])
				}				
			}				

			req.session.data = result;
			req.session.dots = dots;
			next(null, result, dots);
		}
	], function (err, result, dots) {
		if (err) {
			next(err);
		}
		return res.render('index', {
			data: result,
			dots: dots
		})
	});
});

router.post('/add', upload.array(), function(req, res, next) {
	var re = /\s*,\s*/;	
	var symbol = req.body.symbol.split(re);	
	
	
	async.waterfall([
		function(next){
			
	    	//next(null, 'one', 'two');
			Stock.find(function(err, docs) {
				if (err) {
					next(err)
				}
				if (docs.length === 0) {
					next(null, []);
				} else {
					next(null, docs);
				}			
			})	
		},
	  	function(docs, next){
			
			var results = docs;
			async.map(symbol, loadSnapshot, function(err, result){
				for (var i in result) {
					results.push(result[i])	
				}
				next(null, results);
			})
	  	},
		function(results, next){
			var start_date = req.body.start_date;
			var end_date = req.body.end_date;
			if (start_date === null || start_date === undefined || start_date === '') {
				end_date = moment().format();
				start_date = moment().subtract(1, 'year').format();
			}
			req.app.locals.start_date = start_date;
			req.app.locals.end_date = end_date;
			var all_stocks = results;
			var lookup = []
			for (var i in all_stocks) {
				lookup.push(all_stocks[i].key)
			}
			async.map(lookup, function(query, next) {
				
				yahooFinance.historical({
					symbols: [query],
					from: start_date,
					to: end_date
				}, function(error, results){
					if (error) {
						return next(error)
					}
					next(null, results)
				});
			}, function(err, result){
				if (err) {
					next(err)
				}
				var all_stocks = results;
				var prop = Object.getOwnPropertyNames(result)
				var index = all_stocks.length - symbol.length;
				for (var i = 0; i < result.length; i++) {
					//var initial_length = results.length;
					var index = i;
					var arrays = _.find(result[prop[i]], function(item) {
						return Array.isArray(item)
					})
					all_stocks[index].stock_array = arrays;
					index++;
				}
				next(null, all_stocks);
			})
		},
		function(results, next) {
			insertNew(results, function(err){
				if (err) {
					next(err)
				}
				Stock.find().lean().exec(function(err, result){
					if (err) {
						next(err);
					}
					next(null, result)
				});
			})								
		},
		function(result, next) {
			var dots = [];
			for(var i in result) {
				for (var j in result[i].stock_array) {
					result[i].stock_array[j].date = moment(result[i].stock_array[j].date);
					dots.push(result[i].stock_array[j])
				}				
			}
			req.app.locals.data = result;
			req.app.locals.dots = dots;
			next(null)
		}
	], function (err) {
		if (err) {
			next(err)
		}
		return res.redirect('/')
	});
	
});

function getDataDots(req, next) {
	async.waterfall([
		function(next) {
			//establish lookup
			//get everything from collection into an array for updates
			var results;
			var lookup;
			getAllDb({}, function(err, result){
				if (result.length === 0 || result === null) {
					lookup = ['AAPL', 'GOOGL'];
					results = [];
				} else {
					lookup = [];
					for (var i in result) {
						lookup.push(result[i].key)
					}
					results = result;
				}
				next(null, lookup, results);
				//lookup is symbols of existing DB stock data ... ['AAPL', 'GOOGL'] if DB is empty
				//results is DB data ... [] if DB is empty
			})
		},
		function(lookup, results, next){
			//no need to lookup what's already in the collection
			//filter by key
			function myIndexOf(obj) { //obj is one from lookup
				for (var i = 0; i < results.length; i++) {
					if (results[i].key === obj) {
				        return obj;
				    }
					//only those documents NOT in db should remain after filter
				}
				return -1;
			}
			var new_lookup;
			if (results.length > 0) {
				new_lookup = [];
				for (var i in lookup) {
					var stockFilter = myIndexOf(lookup[i]);
					if (stockFilter === -1) {
						new_lookup.push(lookup[i])
					}
				}
			} else {
				new_lookup = lookup;
			}
			//results may still be []
			//new_lookup is symbols to lookup for populating the DB
			next(null, new_lookup, results);
		},
		function(new_lookup, results, next){
			//yahoo snapshot lookup
			var all_stocks = results;
			async.map(new_lookup, loadSnapshot, function(err, result){
				for (var i in result) {
					all_stocks.push(result[i])	
				}
				next(null, all_stocks);
			})
			//appends new document objects, each with empty stock_array, to collection array
		},
		function(results, next){
			//insert new or update existing data in each document's stock_array
			//get new data for all via getStockInfo function
			var all_stocks = results;
			var lookup = []
			for (var i in all_stocks) {
				lookup.push(all_stocks[i].key)
			}
			var start_date = req.app.locals.start_date;
			var end_date = req.app.locals.end_date;
			if (start_date === null || start_date === undefined || start_date === '') {
				end_date = moment().format();
				start_date = moment().subtract(1, 'year').format();
			}
			async.map(lookup, function(query, next) {

				yahooFinance.historical({
					symbols: [query],
					from: start_date,
					to: end_date
				}, function(error, results){
					if (error) {
						return next(error)
					}
					next(null, results)
				});
			}, function(err, result){
				if (err) {
					next(err)
				}
				var prop = Object.getOwnPropertyNames(result)

				for (i = 0; i < result.length; i++) {
					var index = i;
					var arrays = _.find(result[prop[i]], function(item) {
						return Array.isArray(item)
					})
					//all_stocks = the existing collection plus new entries with empty stock_arrays
					//update them all ??
					all_stocks[index].stock_array = arrays;
					index++;
				}
				next(null, all_stocks)
			})
		},
		function(results, next) {
			Stock.update({}, results, {safe: true, upsert: true, multi: true}, function(error, docs){
				if (error) {
					next(error)
				}

				next(null, results)
			});
			
		}
	], function(err, results) {
		if (err) {
			return next(err)
		}
		var dots = [];
		for(var i in results) {
			for (var j in results[i].stock_array) {
				results[i].stock_array[j].date = moment(results[i].stock_array[j].date);
				dots.push(results[i].stock_array[j])
			}				
		}
		
		req.session.data = results;
		req.session.dots = dots;
		return next({
			data: results,
			dots: dots
		});					
		
	})
	
}

function getAllDb(lookup, next) {
	Stock.find(lookup).lean().exec(function(err, docs) {
		if (err) {
			next(err);
		}
		next(null, docs);
	})
}

function insertNew(all_stocks, next) {
	for (var i in all_stocks) {
		Stock.findOne({key: all_stocks[i].key}, function(err, stock){
			if (err) {
				console.log(err)
			}
			if (!err && stock === null) {
				var this_stock = new Stock({
					name: all_stocks[i].name,
					key: all_stocks[i].key,
					stock_array: all_stocks[i].stock_array
				})
				this_stock.save(function(err){
					if (err) {
						console.log(err)
					}
				})
			} else {
				Stock.findOneAndUpdate({key: all_stocks[i].key}, all_stocks[i], {safe: true, upsert: false}, function(err, docs){
					if (err) {
						console.log(err);
					}						
				})
			}
		})
	}
	next();
}


function loadSnapshot(lookup, next) {
	yahooFinance.snapshot({ 
		symbol: lookup,
		fields: ['s', 'n', 'd1', 'l1'] 
	}, function (err, quote) {
		if (err) {
			return next(err);
		}
		var quotes = {
			key: quote.symbol,
			name: quote.name,
			stock_array: []
		}
		next(null, quotes);
	});	
}


module.exports = router;
