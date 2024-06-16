const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const perfLogSchema = new Schema({
	currentCost: { type: Number, required: true },
	costLimit: { type: Number, required: true },
	maximumCost: { type: Number, required: true },
	performanceMap: {
		type: Map,
		of: {
			isDown: { type: Boolean, required: true },
			clientCount: { type: Number, required: true },
			delayCount: { type: Number, required: true },
		},
		required: true,
	},
	time: { type: Date, required: true },
});

module.exports = mongoose.model("PerfLog", perfLogSchema, "PerfLog");
