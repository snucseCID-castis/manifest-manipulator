const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const cdnSchema = new Schema({
	apiUrl: { type: String, unique: true },
	sourceBaseUrl: { type: String, required: true },
	type: { type: String, required: true, enum: ["cache", "cloudfront"] },
	status: {
		isDown: { type: Boolean, default: false },
		bps: { type: Number, default: 0 },
		tps: { type: Number, default: 0 },
		connection_count: { type: Number, default: 0 }
	},
	lastStatus: {
		bps: { type: Number, default: 0 },
		tps: { type: Number, default: 0 },
		connection_count: { type: Number, default: 0 },
		mm_connection_count: { type: Number, default: 0 },
		metric_for_mm: { type: Number, default: 0 }
	}
});

module.exports = mongoose.model("CDN", cdnSchema, "CDN");