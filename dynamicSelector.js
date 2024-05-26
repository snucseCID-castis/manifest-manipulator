const CDN = require("./models/CDN");
const Connection = require("./models/Connection");
const connectionManager = require("./connectionManager");
const cdnAnalyzer = require("./cdnAnalyzer");

class DynamicSelector {
	async selectCDN(connection) {
		if (!connection.CDN || connection.CDN.status.isDown) {
			return (await cdnAnalyzer).optimalCDN;
		}
		// TODO: implement criteria check for previous CDN

		return connection.CDN;
	}
}

module.exports = new DynamicSelector();
