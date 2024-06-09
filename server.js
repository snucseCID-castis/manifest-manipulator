const { app, startServer } = require("./app");
const mongoose = require("mongoose");
const Delay = require("./models/Delay");
const connectionManager = require("./connectionManager");

const port = process.env.PORT || 3000;
const databaseURI = process.env.DATABASE_URI;

mongoose
	.connect(databaseURI)
	.then(async () => {
		console.log("Connected to MongoDB");
		let isShuttingDown = false;
		await Delay.deleteMany({});
		await startServer();
		app.listen(port, () => {
			console.log(`Server running on port ${port}`);
		});

		process.on("SIGINT", saveDelayLogsAndShutDown);
		process.on("SIGTERM", saveDelayLogsAndShutDown);

		async function saveDelayLogsAndShutDown() {
			if (isShuttingDown) {
				return;
			}
			isShuttingDown = true;
			await connectionManager.saveDelayLogs();
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
