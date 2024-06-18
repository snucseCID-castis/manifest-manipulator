const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const delayLogSchema = new Schema({
	prevCdnName: { type: String, required: true },
	newCdnName: { type: String, required: true },
	connection: {
		type: Schema.Types.ObjectId,
		ref: "Connection",
		required: true,
	},
	time: { type: Date, required: true },
});

delayLogSchema.index({ prevCdnName: 1 });
delayLogSchema.index({ time: -1 });

module.exports = mongoose.model("DelayLog", delayLogSchema, "DelayLog");
