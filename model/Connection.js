const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const connectionSchema = new Schema({
	sessionID: { type: String, required: true, unique: true },
	cdn: { type: Schema.Types.ObjectId, ref: "CDN", required: true },
});

module.exports = mongoose.model("Connection", connectionSchema);
