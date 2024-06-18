const logger = require("./logger");

class DynamicSelector {
	costLimit = 0;
	logger = logger;

	changeCostLimit(costLimit) {
		this.costLimit = costLimit;
	}

	selectCDN(connection, availableCDNs, lastResort, isDelayed, currTime) {
		const blacklist = isDelayed ? [connection.cdn.toString()] : [];
		let prevCdnName = null;
		let chepeastCDN = null;
		let selectedCDN = null;

		for (const CDN of availableCDNs) {
			if (blacklist.includes(CDN._id.toString())) {
				prevCdnName = CDN.name;
				continue;
			}
			if (CDN.status.isDown) {
				continue;
			}
			// if currently connected CDN is not down and not in blacklist, do not change the CDN
			if (CDN._id.equals(connection.cdn)) {
				selectedCDN = CDN;
				break;
			}

			if (!chepeastCDN || CDN.cost < chepeastCDN.cost) {
				chepeastCDN = CDN;
			}

			// cost condition is only considered when this is new connection
			if (this.costLimit && CDN.cost > this.costLimit) {
				continue;
			}
			// choose the first CDN which is not down and not in blacklist and has cost less than costLimit
			if (!selectedCDN) {
				selectedCDN = CDN;
			}
		}

		if (!selectedCDN) {
			if (chepeastCDN) {
				selectedCDN = chepeastCDN;
			} else {
				selectedCDN = lastResort;
			}
		}

		if (isDelayed) {
			if (!prevCdnName) {
				prevCdnName = lastResort.name;
			}
			this.logger.appendDelayLog(
				prevCdnName,
				selectedCDN.name,
				connection._id,
				currTime,
			);
		}

		return selectedCDN;
	}

	async distributeConnections(connections, availableCDNs, lastResort, cost) {
		let targetCDNs = availableCDNs.filter(
			(cdn) =>
				cdn.cost != null && cdn.status.isDown !== true && cdn.cost <= cost,
		);
		// there is no CDN with cost less than 'cost'
		if (targetCDNs.length === 0) {
			targetCDNs = availableCDNs.filter((cdn) => cdn.status.isDown !== true);
		}
		// there isn't any CDN available, connect to last resort
		if (targetCDNs.length === 0) {
			targetCDNs = [lastResort];
		}

		const distributedConnCounts = new Map();
		const groupSize = Math.ceil(connections.length / targetCDNs.length);
		const savePromises = [];

		for (let i = 0; i < targetCDNs.length; i++) {
			for (let j = 0; j < groupSize; j++) {
				if (i * groupSize + j >= connections.length) {
					break;
				}
				connections[i * groupSize + j].CDN = targetCDNs[i];
				savePromises.push(connections[i * groupSize + j].save());

				if (!distributedConnCounts.has(targetCDNs[i].name)) {
					distributedConnCounts.set(targetCDNs[i].name, 1);
				} else {
					distributedConnCounts.set(
						targetCDNs[i].name,
						distributedConnCounts.get(targetCDNs[i].name) + 1,
					);
				}
			}
		}
		await Promise.all(savePromises);

		return distributedConnCounts;
	}
}

module.exports = new DynamicSelector();
