var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var Stocks = new Schema({
	name: String,
	symbol: String,
	data: [{
		symbol: String,
		date: Date,
		price: Number
	}],
	snapshot: {
		d1: String,
		l1: String
	}
}, { collection: 'fcc_stocks' });


module.exports = mongoose.model('Stocks', Stocks);
