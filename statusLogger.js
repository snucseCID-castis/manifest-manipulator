const Delay = require("./models/Delay");

class StatusLogger {
	delayLogs = [];

	appendDelayLog(prevCdnName, newCdnName, connectionId, time) {
		const delay = new Delay({
			prevCdnName: prevCdnName,
			newCdnName: newCdnName,
			connection: connectionId,
			time: time,
		});
		this.delayLogs.push(delay);

		console.log(`[Delay] prev CDN: ${prevCdnName} -> new CDN: ${newCdnName}`);
	}

	async saveDelayLogs() {
		await Delay.insertMany(this.delayLogs);
		this.delayLogs = [];
	}
}

module.exports = new StatusLogger();
