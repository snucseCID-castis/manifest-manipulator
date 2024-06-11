const { ConnectionClosedEvent } = require("mongodb");
const Connection = require("./models/Connection");
const Delay = require("./models/Delay");

class ConnectionManager {
	constructor(delayThreshold) {
		this.delayThreshold = delayThreshold;
		this.delayLogs = [];
	}

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
		if (cdnId) {
			await Connection.findOneAndUpdate(
				{ _id: connection._id },
				{
					$set: {
						cdn: cdnId,
					},
				},
			);
		}
	}

	async setLastSegment(connection, lastSegment, mediaPlaylistName, cdnId) {
		const strippedMediaPlaylistName = mediaPlaylistName.split(".")[0];

		await Connection.findOneAndUpdate(
			{ _id: connection._id },
			{
				$set: {
					[`prevs.${strippedMediaPlaylistName}.${cdnId}`]: {
						lastSegment,
						lastUpdated: Date.now(),
					},
				},
			},
		);
	}

	async refreshConnection(connection) {
		const newExpiry = new Date(Date.now() + 10000);
		// Save the updated connection to MongoDB

		await Connection.findOneAndUpdate(
			{ _id: connection._id },
			{ $set: { expiry: newExpiry } },
			{ new: true, useFindAndModify: false },
		);
	}

	async logConnectionRequest(connection, mediaPlaylistName, time) {
		const logKey = mediaPlaylistName.split(".")[0];
		const update = {};
		const updatePath = `requestLogs.${logKey}`;

		// 현재 로그가 있는 경우에는 배열에 새로운 시간을 추가하고, 없는 경우에는 새로운 배열을 생성
		update[updatePath] = { $each: [time], $slice: -10 };

		await Connection.findOneAndUpdate(
			{ _id: connection._id },
			{ $push: update },
			{ new: true, useFindAndModify: false },
		);
		// if (connection.requestLogs.has(logKey)) {
		// 	const requestTimes = connection.requestLogs.get(logKey);
		// 	requestTimes.push(time);
		// 	connection.requestLogs.set(logKey, requestTimes);
		// } else {
		// 	connection.requestLogs.set(logKey, [time]);
		// }
		// await connection.save();
	}

	async setConnectionCDN(connectionId, cdnId) {
		await Connection.findOneAndUpdate(
			{ _id: connectionId },
			{ $set: { cdn: cdnId } },
			{ new: true, useFindAndModify: false },
		);
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
				// console.log(currentTime - relatedLogs[relatedLogs.length - 1])
				const delay = new Delay({
					cdn: connection.cdn,
					connection: connection._id,
					time: currentTime,
				});
				this.delayLogs.push(delay);
				return [connection.cdn.toString()];
			}
		}
		return [];
	}

	async saveDelayLogs() {
		await Delay.insertMany(this.delayLogs);
		this.delayLogs = [];
	}
}

const connectionManager = new ConnectionManager(4500);

module.exports = connectionManager;
