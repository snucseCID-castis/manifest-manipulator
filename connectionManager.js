const Connection = require("./models/Connection");
const MediaPlaylist = require("./models/MediaPlaylist");

class ConnectionManager {
	delayThreshold = 5000;

	async createConnection() {
		const connection = new Connection();
		await connection.save();
		return connection;
	}
	async getConnection(connectionId) {
		let connection = await Connection.findOne({ _id: connectionId });
		if (!connection) {
			connection = new Connection({
				_id: connectionId,
			});
			await connection.save();
		} else {
			await this.refreshConnection(connection);
		}
		return connection;
	}

	async updateCDN(connection, cdnId) {
		if (!cdnId) {
			return;
		}
		connection.cdn = cdnId;
		await connection.save();
	}

	async refreshConnection(connection) {
		connection.expiry = new Date(Date.now() + 10000);
		// Save the updated connection to MongoDB
		await connection.save();
	}

	async logConnectionRequest(connection, mediaPlaylistName, time) {
		const logKey = mediaPlaylistName.split(".")[0];
		if (connection.requestLogs.has(logKey)) {
			const requestTimes = connection.requestLogs.get(logKey);
			requestTimes.push(time);
			connection.requestLogs.set(logKey, requestTimes);
		} else {
			connection.requestLogs.set(logKey, [time]);
		}
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

	blacklistFromDelay(connection, currentTime, mediaPlaylistName) {
		const logKey = mediaPlaylistName.split(".")[0];
		if (connection.requestLogs.has(logKey)) {
			const relatedLogs = connection.requestLogs.get(logKey);
			if (
				currentTime - relatedLogs[relatedLogs.length - 1] >
				this.delayThreshold
			) {
				return [connection.cdn];
			}
		}
		return [];
	}
}

module.exports = new ConnectionManager();
