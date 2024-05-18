const express = require("express");
const cookieParser = require("cookie-parser");
const connectionManager = require("./connectionManager");
const playlistManagerFactory = require("./playlistManager");
const app = express();

const cdnAnalyzer = new CDNAnalyzer();
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

async function startServer() {
	playlistManager = await playlistManagerFactory();

	app.get("/:pathname", async (req, res) => {
		const playlistName = req.params.pathname;
		const playlistContent = await playlistManager.fetchPlaylist(playlistName);
		if (!playlistContent) {
			return res.status(404).send("Not Found");
		}

		res.header("Content-Type", "application/vnd.apple.mpegurl");
		return res.send(playlistContent);
	});
}

module.exports = { app, startServer };
