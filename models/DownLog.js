const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const downLogSchema = new Schema({
	downCdnNames: { type: [String], required: true },
	distributedConnCounts: { type: Map, of: Number, required: true },
	prevCdnConnCount: {
		type: Number,
		required: true,
	},
	time: { type: Date, required: true },
});

module.exports = mongoose.model("DownLog", downLogSchema, "DownLog");
