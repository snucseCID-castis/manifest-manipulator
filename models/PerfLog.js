const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const perfLogSchema = new Schema({
	performanceMap: { type: Map, of: {
		isDown: { type: Boolean, required: true },
		clientCount: { type: Number, required: true },
		delayCount: { type: Number, required: true },
	}, required: true },
	time: { type: Date, required: true },
});

module.exports = mongoose.model("PerfLog", perfLogSchema, "PerfLog");
