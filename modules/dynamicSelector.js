const logger = require("./logger");

class DynamicSelector {
	costLimit = null;
	logger = logger;

	changeCostLimit(costLimit) {
		this.costLimit = costLimit;
	}

	selectCDN(connection, availableCDNs, lastResort, isDelayed, currTime) {
		const blacklist = isDelayed ? [connection.cdn] : [];
		let prevCdnName = null;
		let selectedCDN = null;

		for (const CDN of availableCDNs) {
			if (blacklist.includes(CDN._id.toString())) {
				prevCdnName = CDN.name;
				continue;
			}
			if (CDN.status.isDown) {
				continue;
			}
			// TODO: 비용 초과 시 CDN 변경 할까 말까
			if (this.costLimit && CDN.cost > this.costLimit) {
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

		if (!selectedCDN) {
			selectedCDN = lastResort;
		}

		if (isDelayed) {
			this.logger.appendDelayLog(
				prevCdnName,
				selectedCDN.name,
				connection._id,
				currTime,
			);
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

		const distributedConnCounts = new Map();
		for (let i = 0; i < targetCDNs.length; i++) {
			distributedConnCounts.set(targetCDNs[i].name, 0);
		}

		const groupSize = Math.ceil(connections.length / targetCDNs.length);
		const savePromises = [];

		for (let i = 0; i < targetCDNs.length; i++) {
			for (let j = 0; j < groupSize; j++) {
				if (i * groupSize + j >= connections.length) {
					break;
				}
				connections[i * groupSize + j].CDN = targetCDNs[i];
				savePromises.push(connections[i * groupSize + j].save());

				distributedConnCounts.set(
					targetCDNs[i].name,
					distributedConnCounts.get(targetCDNs[i].name) + 1,
				);
			}
		}
		await Promise.all(savePromises);

		return distributedConnCounts;
	}
}

module.exports = new DynamicSelector();
