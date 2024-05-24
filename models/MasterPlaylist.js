const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const masterPlaylistSchema = new Schema({
	name: { type: String, required: true, unique: true },
	contents: { type: String, required: true },
});

module.exports = mongoose.model("MasterPlaylist", masterPlaylistSchema);
