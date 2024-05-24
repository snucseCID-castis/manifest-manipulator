const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const cdnSchema = new Schema({
	url: { type: String, required: true, unique: true },
	traffic_uri: { type: String, required: true },
	type: { type: String, required: true, enum: ["cache", "cloudfront"] },
});

module.exports = mongoose.model("CDN", cdnSchema);
