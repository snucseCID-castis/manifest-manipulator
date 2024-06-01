const CDN = require("./models/CDN");
const Connection = require("./models/Connection");
const connectionManager = require("./connectionManager");

class DynamicSelector {
	async selectCDN(connection, optimalCDN) {
		if (!connection.CDN || connection.CDN.status.isDown) {
			return optimalCDN;
		}
		// TODO: implement criteria check for previous CDN

		return connection.CDN;
	}
}

module.exports = new DynamicSelector();
