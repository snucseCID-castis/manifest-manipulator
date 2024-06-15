const express = require("express");
const ConnectionManager = require("./modules/connectionManager");
const playlistManagerFactory = require("./modules/playlistManager");
const CDNAnalyzerFactory = require("./modules/cdnAnalyzer").CDNAnalyzerFactory;
const dynamicSelector = require("./modules/dynamicSelector");
const optimalCDNCriteria = require("./modules/cdnAnalyzer").optimalCDNCriteria;
const app = express();

// parameter seting
const optimalCDNCriterion = optimalCDNCriteria.BPSMMperClient; // criterion for optimal CDN selection
const maximumCost = 0.8; // absolute cost limit per client
const triggerRatio = 0.9; // ratio of cost exceeding check
const setRatio = 0.5; // ratio of cost which is used for stabilizing total cost
////////

// // logging middleware
// app.use((req, res, next) => {
// 	const start = Date.now();
// 	res.on("finish", () => {
// 		const duration = Date.now() - start;
// 		console.log(
// 			`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`,
// 		);
// 	});
// 	next();
// });

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
		optimalCDNCriterion,
		maximumCost,
		dynamicSelector,
		triggerRatio,
		setRatio,
	);
	const connectionManager = new ConnectionManager(4500);

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

		const isDelayed = connectionManager.checkDelay(
			connection,
			currentTime,
			req.params.mediaPlaylist,
		);

		const selectedCDN = dynamicSelector.selectCDN(
			connection,
			cdnAnalyzer.availableCDNs,
			cdnAnalyzer.lastResort,
			isDelayed,
			currentTime,
		);

		const { playlistContent, lastSegment } =
			await playlistManager.fetchMediaPlaylist(
				selectedCDN,
				req.params.mediaPlaylist,
				connection,
			);

		if (!playlistContent) {
			return res.status(404).send("Not Found");
		}

		await connectionManager.updateCDN(connection, selectedCDN?._id);

		await connectionManager.setLastSegment(
			connection,
			lastSegment,
			req.params.mediaPlaylist,
			selectedCDN?._id,
		);

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
