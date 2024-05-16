const express = require("express");
const cookieParser = require("cookie-parser");
const ConnectionManager = require("./connectionManager");
const PlaylistManager = require("./playlistManager");
const app = express();

const connectionManager = new ConnectionManager();
const playlistManager = new PlaylistManager(); // updates playlists

// logging middleware
app.use((req, res, next) => {
	const start = Date.now();
	res.on("finish", () => {
		const duration = Date.now() - start;
		console.log(
			`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`,
		);
	});
	next();
});

// parse cookies
app.use(cookieParser());

// store connection instance in request object
app.use(async (req, res, next) => {
	req.CDNConnection = await connectionManager.getOrCreateConnection(req, res);
	next();
});

app.get("/:pathname", async (req, res) => {
	const playlistName = req.params.pathname;
	const playlistContent = await playlistManager.fetchPlaylist(playlistName);
	if (!playlistContent) {
		return res.status(404).send("Not Found");
	}

	res.header("Content-Type", "application/vnd.apple.mpegurl");
	return res.send(playlistContent);

	// if (mediaPlaylists.has(name)) {
	// 	cdnURL = await selectCDN();
	// 	res.header("Content-Type", "application/vnd.apple.mpegurl");
	// 	return res.send(reconstructMediaPlaylist(m3u8, cdnURL));
	// }
	// res.status(400).send("Bad Request");
});

module.exports = { app };
