const { app, startServer } = require("./app");
const mongoose = require("mongoose");
const DelayLog = require("./models/DelayLog");
const statusLogger = require("./dynamicSelector");

const port = process.env.PORT || 3000;
const databaseURI = process.env.DATABASE_URI;

mongoose
	.connect(databaseURI)
	.then(async () => {
		console.log("Connected to MongoDB");
		let isShuttingDown = false;
		await DelayLog.deleteMany({});
		await startServer();
		app.listen(port, () => {
			console.log(`Server running on port ${port}`);
		});

		process.on("SIGINT", saveLogsAndShutDown);
		process.on("SIGTERM", saveLogsAndShutDown);

		async function saveLogsAndShutDown() {
			if (isShuttingDown) {
				return;
			}
			isShuttingDown = true;
			// await statusLogger.saveDelayLogs();
			mongoose.connection
				.close()
				.then(() => {
					process.exit(0);
				})
				.catch((err) => {
					process.exit(1);
				});
		}
	})
	.catch((err) => {
		console.log("Error connecting to MongoDB", err);
	});
