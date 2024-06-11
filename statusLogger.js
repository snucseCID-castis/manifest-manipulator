const DelayLog = require("./models/DelayLog");

class StatusLogger {
	delayLogs = [];

	appendDelayLog(prevCdnName, newCdnName, connectionId, time) {
		const delayLog = new DelayLog({
			prevCdnName: prevCdnName,
			newCdnName: newCdnName,
			connection: connectionId,
			time: time,
		});
		this.delayLogs.push(delayLog);

		console.log(`[Delay] prev CDN: ${prevCdnName} -> new CDN: ${newCdnName}`);
	}

	async saveDelayLogs() {
		await DelayLog.insertMany(this.delayLogs);
		this.delayLogs = [];
	}
}

module.exports = new StatusLogger();
