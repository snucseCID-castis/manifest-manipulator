const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const mediaPlaylistSchema = new Schema({
	name: { type: String, required: true, unique: true },
});

module.exports = mongoose.model("MediaPlaylist", mediaPlaylistSchema);
