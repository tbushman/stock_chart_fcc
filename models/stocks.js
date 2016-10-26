var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var Stock = new Schema({
	name: String,
	key: String,
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
}, { collection: 'fcc_stocks' });


module.exports = mongoose.model('Stock', Stock);