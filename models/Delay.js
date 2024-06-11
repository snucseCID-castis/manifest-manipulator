const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const delaySchema = new Schema({
	prevCdnName: { type: String, required: true },
	newCdnName : { type: String, required: true },
	connection: {
		type: Schema.Types.ObjectId,
		ref: "Connection",
		required: true,
	},
	time: { type: Date, required: true },
});

module.exports = mongoose.model("Delay", delaySchema, "Delay");
