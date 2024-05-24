const mongoose = require("mongoose");
const Connection = require("./models/Connection");
const cookie = require("cookie");
class ConnectionManager {
	async getOrCreateConnection(req, res) {
		const connectionId = req.cookies.connectionId;

		// If there's no connection ID in the cookie, create a new connection and set cookie
		if (!connectionId) {
			const connection = new Connection();
			await connection.save();

			res.setHeader(
				"Set-Cookie",
				cookie.serialize("connectionId", String(connection._id), {
					httpOnly: true,
				}),
			);

			return connection;
		}

		// Check if a connection exists for the given connection ID
		let connection = await Connection.findOne({ _id: connectionId });

		// If connection doesn't exist, create a new one
		if (!connection) {
			// Create a new connection with the provided connection ID
			connection = new Connection({ _id: connectionId });
			// Save the new connection to MongoDB
			await connection.save();
		} else {
			// If connection exists, update its expiry to 10 seconds from now
			await this.refreshConnection(connectionId);
		}

		return connection;
	}

	async refreshConnection(connectionId) {
		// Find the connection based on the connection ID
		const connection = await Connection.findOne({ _id: connectionId });
		// Update the expiry time to 10 seconds from now
		connection.expiry = new Date(Date.now() + 10000);
		// Save the updated connection to MongoDB
		await connection.save();
	}

	async setConnectionCDN(connectionId, cdnId) {
		// Find the connection based on the connection ID
		const connection = await Connection.findOne({ _id: connectionId });
		// Set the CDN for the connection
		connection.cdn = cdnId;
		// Save the updated connection to MongoDB
		await connection.save();
	}

	async getConnectionCount() {
		// Retrieve all live connections from MongoDB
		const connections = await Connection.find({ expiry: { $gt: new Date() } });
		// Initialize an object to store the connection count per CDN
		const connectionCount = {};
		// Count the number of connections per CDN
		for (const connection of connections) {
			if (!connectionCount[connection.cdn]) {
				connectionCount[connection.cdn] = 1;
			} else {
				connectionCount[connection.cdn]++;
			}
		}
		return connectionCount;
	}
}

module.exports = new ConnectionManager();
