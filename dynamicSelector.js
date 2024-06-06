const CDN = require("./models/CDN");
const Connection = require("./models/Connection");
const connectionManager = require("./connectionManager");

class DynamicSelector {
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
}

module.exports = new DynamicSelector();
