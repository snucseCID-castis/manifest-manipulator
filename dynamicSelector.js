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
			if (CDN._id === connection.cdn) {
				selectedCDN = CDN;
				break;
			}
		}

		return selectedCDN;
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
