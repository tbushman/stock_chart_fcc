var express = require('express');
var Stock = require('../models/stocks');
var multer  = require('multer');
var url = require('url');
var dotenv = require('dotenv');
var async = require("async");
var yahooFinance = require('yahoo-finance');
var router = express.Router();

var upload = multer();

dotenv.load();


/* GET home page. */
router.get('/', function(req, res, next) {
	
	Stock.find({}, 'data', function(err, docs){
		if (err) {
			return next(err);
		}
		if (!docs) {
			yahooFinance.snapshot({ 
				symbols: ['AAPL', 'GOOGL'],
				fields: ['s', 'n', 'd1', 'l1'] 
			}, function (err, quote) {

				async.map(Object.keys(quote), getStockInfo, function(err, result){
					//console.log(result) //array
					return res.render('index', {
						name: quote.name,
						symbol: quote.symbol,
						l1: quote.lastTradePriceOnly,
						d1: quote.lastTradeDate,
						data: result
					});
				})
			});
		}
		return res.render('index', { 
			data: docs
		});
	})
	
});


router.delete('/delete/:symbol', function(req, res, next){
	var symbol = req.params.symbol;
	Stock.findOneAndRemove({symbol: symbol}, function(error, data) {
		if (error) {
			return next(error);
		}
		Stock.find({}, 'data', function(err, docs){
			if (err) {
				return next(err);
			}
			return res.render('index', { 
				data: docs
			});
		});
	});
});

router.post('/add', upload.array(), function(req, res, next) {
	var symbol = req.body.symbol;
	yahooFinance.snapshot({ 
		symbol: symbol,
		fields: ['s', 'n', 'd1', 'l1'] 
	}, function (err, quote) {
		if (err) {
			return callback(err);
		}
		var snapshot = {
			l1: quote.lastTradePriceOnly,
			d1: quote.lastTradeDate 
		}
		var lookup = [''+quote.symbol+'']
		getStockInfo(lookup, function(err, result){
			if (err) {
				return callback(err);
			}
			
			var entry = {
				name: quote.name,
				symbol: quote.symbol,
				snapshot: snapshot,			
				data: result
			}
			
			Stock.findOne({symbol: quote.symbol}, function(err, stock){
				if (!stock) {
					Stock.insert(entry)
					//console.log(result) //array
					return res.render('index', entry);
					
				} else {
					try {
						Stock.updateOne(
							{symbol: quote.symbol},
							{$push: {data: result}},
							{$set: {snapshot: snapshot}},
							{upsert: true}
						);
					} catch (e) {
						console.log(e);
					}
					return res.render('index', entry);
				}
			});
		})
		
	});
	
});

function getStockInfo(lookup, callback) {
	var to = new Date();
	var year = to.getFullYear();
	var month = to.getMonth();
	var day = to.getDate();
	
	var makeDate = new Date(year-1, month, day); 
	var histDate = new Date();
	histDate.setTime(newDate.getTime());
	
	yahooFinance.historical({
		symbols: lookup,
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
