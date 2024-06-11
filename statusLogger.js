const DelayLog = require("./models/DelayLog");
const DownLog = require("./models/DownLog");

class StatusLogger {
	delayLogs = [];
	downLogs = [];

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

  appendDownLog(downCdnNames, distributedConnCounts, prevCdnConnCount, time) {
    const downLog = new DownLog({
      downCdnNames: downCdnNames,
      distributedConnCounts: distributedConnCounts,
      prevCdnConnCount: prevCdnConnCount,
      time: time,
    });
    this.downLogs.push(downLog);

    let message = `[Down] ${downCdnNames.join(", ")}\n`;
    for (const [cdnName, count] of distributedConnCounts) {
      message += `\t -> ${cdnName}: ${count} connections\n`;
    }

    console.log(message);
  }

	async saveDelayLogs() {
		await DelayLog.insertMany(this.delayLogs);
		this.delayLogs = [];
	}

	async saveDownLogs() {
		await DownLog.insertMany(this.downLogs);
		this.downLogs = [];
	}
}

module.exports = new StatusLogger();
