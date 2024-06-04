const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const requestLogSchema = new Schema({
	mediaPlaylistName: { type: String, required: true },
	time: { type: Date, default: Date.now },
});

const connectionSchema = new Schema({
	cdn: { type: Schema.Types.ObjectId, ref: "CDN", required: false },
	expiry: { type: Date, default: () => new Date(Date.now() + 10000) }, // currently set to 10 seconds from now. TODO: adjust according to media playlist request rate
	requestLogs: { type: [requestLogSchema], default: [] },
});

connectionSchema.index({ expiry: 1 }, { expireAfterSeconds: 300 });

module.exports = mongoose.model("Connection", connectionSchema);
