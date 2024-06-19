const express = require("express");
const path = require("node:path");
const http = require("node:http");
const { Server } = require("socket.io");
const ConnectionManager = require("./modules/connectionManager");
const playlistManagerFactory = require("./modules/playlistManager");
const CDNAnalyzerFactory = require("./modules/cdnAnalyzer").CDNAnalyzerFactory;
const dynamicSelector = require("./modules/dynamicSelector");
const optimalCDNCriteria = require("./modules/cdnAnalyzer").optimalCDNCriteria;

const app = express();
const httpServer = http.createServer(app);
const io = new Server(httpServer);

global.io = io;

// parameter seting
const optimalCDNCriterion = optimalCDNCriteria.TPS; // criterion for optimal CDN selection
const maximumCost = 2.0; // absolute cost limit per client
const triggerRatio = 0.9; // ratio of cost exceeding check
const setRatio = 0.5; // ratio of cost which is used for stabilizing total cost
const delayThreshold = 6000; // threshold for delay detection
////////

async function startServer() {
	const playlistManager = await playlistManagerFactory();
	const cdnAnalyzer = await CDNAnalyzerFactory(
		optimalCDNCriterion,
		maximumCost,
		dynamicSelector,
		triggerRatio,
		setRatio,
	);
	const connectionManager = new ConnectionManager(delayThreshold);

	app.use("/static", express.static(path.join(__dirname, "node_modules")));
	app.use(express.static(path.join(__dirname, "public")));

	app.get("/", (req, res) => {
		res.sendFile(path.join(__dirname, "public", "index.html"));
	});

	app.get("/admin/max/:maxCost", (req, res) => {
		cdnAnalyzer.updateMaximumCost(Number.parseFloat(req.params.maxCost));
		res.send("!!!ADMIN: Maximum cost updated!!!");
	});

	app.get("/admin/trigger/:triggerRatio", (req, res) => {
		cdnAnalyzer.updateTriggerRatio(Number.parseFloat(req.params.triggerRatio));
		res.send("!!!ADMIN: Trigger ratio updated!!!");
	});

	app.get("/admin/set/:setRatio", (req, res) => {
		cdnAnalyzer.updateSetRatio(Number.parseFloat(req.params.setRatio));
		res.send("!!!ADMIN: Set ratio updated!!!");
	});

	app.get("/admin/delay/:delayThreshold", (req, res) => {
		connectionManager.updateDelayThreshold(
			Number.parseInt(req.params.delayThreshold),
		);
		res.send("!!!ADMIN: Delay threshold updated!!!");
	});

	app.get("/api/:masterPlaylist", async (req, res) => {
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

	app.get("/api/:connectionId/:mediaPlaylist", async (req, res) => {
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

module.exports = { httpServer, startServer };
