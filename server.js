const { httpServer, startServer } = require("./app");
const mongoose = require("mongoose");
const logger = require("./modules/logger");

const port = process.env.PORT || 3000;
const databaseURI = process.env.DATABASE_URI;

mongoose
	.connect(databaseURI)
	.then(async () => {
		console.log("Connected to MongoDB");
		let isShuttingDown = false;
		await logger.initLogs();
		await startServer();
		httpServer.listen(port, () => {
			console.log(`Server running on port ${port}`);
		});

		process.on("SIGINT", saveLogsAndShutDown);
		process.on("SIGTERM", saveLogsAndShutDown);

		async function saveLogsAndShutDown() {
			if (isShuttingDown) {
				return;
			}
			isShuttingDown = true;
			await logger.saveLogs();
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
