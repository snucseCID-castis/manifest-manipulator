const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const delaySchema = new Schema({
	cdn: { type: Schema.Types.ObjectId, ref: "CDN", required: true },
	connection: {
		type: Schema.Types.ObjectId,
		ref: "Connection",
		required: true,
	},
	time: { type: Date, required: true },
});

module.exports = mongoose.model("Delay", delaySchema, "Delay");
