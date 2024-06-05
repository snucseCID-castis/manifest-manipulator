const express = require("express");
const connectionManager = require("./connectionManager");
const playlistManagerFactory = require("./playlistManager");
const CDNAnalyzerFactory = require("./cdnAnalyzer").CDNAnalyzerFactory;
const dynamicSelector = require("./dynamicSelector");
const optimalCDNCriteria = require("./cdnAnalyzer").optimalCDNCriteria;
const app = express();

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

// // parse cookies
// app.use(cookieParser());

// // store connection instance in request object
// app.use(async (req, res, next) => {
// 	req.CDNConnection = await connectionManager.getOrCreateConnection(req, res);
// 	next();
// });

async function startServer() {
	const playlistManager = await playlistManagerFactory();
	const cdnAnalyzer = await CDNAnalyzerFactory(
		optimalCDNCriteria.BPSMMperConnCntMM,
	);

	app.get("/:masterPlaylist", async (req, res) => {
		const connection = await connectionManager.createConnection();
		const playlistContent = await playlistManager.fetchMasterPlaylist(
			connection._id,
			req.params.masterPlaylist,
		);
		if (!playlistContent) {
			return res.status(404).send("Not Found");
		}

		res.header("Content-Type", "application/vnd.apple.mpegurl");
		return res.send(playlistContent);
	});

	app.get("/:connectionId/:mediaPlaylist", async (req, res) => {
		const currentTime = Date.now();
		const connection = await connectionManager.getConnection(
			req.params.connectionId,
		);
		if (!connection) {
			return res.status(404).send("Not Found");
		}
		const selectedCDN = await dynamicSelector.selectCDN(
			connection,
			cdnAnalyzer.optimalCDN,
		);
		await connectionManager.updateCDN(connection, selectedCDN?._id);
		const playlistContent = await playlistManager.fetchMediaPlaylist(
			selectedCDN,
			req.params.mediaPlaylist,
		);
		if (!playlistContent) {
			return res.status(404).send("Not Found");
		}
		await connectionManager.logConnectionRequest(
			connection,
			req.params.mediaPlaylist,
			currentTime,
		);
		res.header("Content-Type", "application/vnd.apple.mpegurl");
		return res.send(playlistContent);
	});
}

module.exports = { app, startServer };
