var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var Stocks = new Schema({
	name: String,
	symbol: String,
	data: [{
		open: Number,
		high: Number,
		low: Number,
		close: Number,
		volume: Number,
		adjClose: Number,
		symbol: String,
		date: Date
	}],
	snapshot: {
		symbol: String,
		name: String,
		lastTradeDate: Date,
		lastTradePriceOnly: Number
	}
}, { collection: 'fcc_stocks' });


module.exports = mongoose.model('Stocks', Stocks);
