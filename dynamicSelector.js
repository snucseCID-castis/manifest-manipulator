const CDN = require("./models/CDN");
const Connection = require("./models/Connection");
const connectionManager = require("./connectionManager");

class DynamicSelector {
	costLimit = null;

	changeCostLimit(costLimit) {
		this.costLimit = costLimit;
	}

	async selectCDN(connection, availableCDNs, blacklist) {
		let selectedCDN = null;
		for (const CDN of availableCDNs) {
			if (blacklist.includes(CDN._id)) {
				continue;
			}
			if (CDN.status.isDown) {
				continue;
			}
			// choose the first CDN which is not down and not in blacklist
			if (!selectedCDN) {
				selectedCDN = CDN;
			}

			// but if currently connected CDN is not down and not in blacklist, do not change the CDN
			if (CDN._id.equals(connection.cdn)) {
				selectedCDN = CDN;
				break;
			}
		}

		return selectedCDN;
	}
	async distributeConnections(connections, availableCDNs, cost) {
		let targetCDNs = availableCDNs.filter(
			(cdn) =>
				cdn.cost != null && cdn.status.isDown !== true && cdn.cost <= cost,
		);
		if (targetCDNs.length === 0) {
			targetCDNs = availableCDNs.filter((cdn) => cdn.status.isDown !== true);
		}
		if (targetCDNs.length === 0) {
			console.log("All servers are down");
			return;
		}
		const groupSize = Math.ceil(connections.length / targetCDNs.length);
		const savePromises = [];

		for (let i = 0; i < targetCDNs.length; i++) {
			for (let j = 0; j < groupSize; j++) {
				connections[i * groupSize + j].CDN = targetCDNs[i];
				savePromises.push(connections[i * groupSize + j].save());
			}
		}
		await Promise.all(savePromises);
	}
}

module.exports = new DynamicSelector();
