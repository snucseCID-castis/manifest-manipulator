const CDN = require("./models/CDN");
const Connection = require("./models/Connection");
const connectionManager = require("./connectionManager");

class DynamicSelector {
	async selectCDN(connection, availableCDNs, blacklist) {
		if (!connection.CDN || connection.CDN.status.isDown) {
			return availableCDNs[0];
		}
		// TODO: implement criteria check for previous CDN

		return connection.CDN;
	}
	async distributeConnections(connections, availableCDNs, cost) {
		const targetCDNs = availableCDNs.filter(
			(cdn) => cdn.cost != null && cdn.cost <= cost,
		);
		const groupSize = Math.ceil(connections.length / targetCDNs.length);
		for (let i = 0; i < targetCDNs.length; i++) {
			for (let j = 0; j < groupSize; j++) {
				connections[i * groupSize + j].CDN = targetCDNs[i];
				connections[i * groupSize + j].save();
			}
		}
	}
}

module.exports = new DynamicSelector();
