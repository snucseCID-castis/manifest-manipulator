const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const cdnSchema = new Schema({
	name: { type: String, required: true, unique: true },
	apiUrl: { type: String, unique: true },
	sourceBaseUrl: { type: String, required: true, unique: true },
	type: { type: String, required: true, enum: ["cache", "cloudfront"] },
	cost: { type: Number },
	status: {
		isDown: { type: Boolean, default: false },
		bps: { type: Number, default: 0 },
		tps: { type: Number, default: 0 },
		connection_count: { type: Number, default: 0 },
	},
	lastStatus: {
		bps: { type: Number, default: 0 },
		tps: { type: Number, default: 0 },
		connection_count: { type: Number, default: 0 },
		mm_connection_count: { type: Number, default: 0 },
		metric_for_mm: { type: Number, default: 0 },
	},
});

module.exports = mongoose.model("CDN", cdnSchema, "CDN");
