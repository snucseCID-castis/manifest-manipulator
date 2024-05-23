const { app, startServer } = require("./app");
const mongoose = require("mongoose");
const port = process.env.PORT || 3000;
const databaseURI = process.env.DATABASE_URI;

mongoose
	.connect(databaseURI)
	.then(async () => {
		console.log("Connected to MongoDB");
		await startServer();
		app.listen(port, () => {
			console.log(`Server running on port ${port}`);
		});
	})
	.catch((err) => {
		console.log("Error connecting to MongoDB", err);
	});
