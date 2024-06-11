const DelayLog = require("../models/DelayLog");
const DownLog = require("../models/DownLog");
const PerfLog = require("../models/PerfLog");

class Logger {
	totalDelayLogs = [];
	delayLogs = [];
	downLogs = [];
	perfLogs = [];

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

	appendPerfLog(perfMap, time) {
		const perfLog = new PerfLog({
			performanceMap: perfMap,
			time: time,
		});
		this.perfLogs.push(perfLog);

		let message = "[Performance]\n";
		for (const [cdnName, perf] of perfMap) {
			if (perf.isDown) {
				message += `${cdnName}: DOWN!!!\n`;
			} else {
				message += `${cdnName}: ${perf.clientCount} clients connecting | ${perf.delayCount} clients delayed\n`;
			}
		}
		console.log(message);
	}

	async saveLogs() {
		await DelayLog.insertMany(this.totalDelayLogs);
		await DownLog.insertMany(this.downLogs);
		await PerfLog.insertMany(this.perfLogs);
	}

	async initLogs() {
		await DelayLog.deleteMany({});
		await DownLog.deleteMany({});
		await PerfLog.deleteMany({});
	}

	getDelayCount() {
		const countMap = new Map();
		for (const log of this.delayLogs) {
			const key = log.prevCdnName;
			if (!countMap.has(key)) {
				countMap.set(key, 1);
			} else {
				countMap.set(key, countMap.get(key) + 1);
			}
		}

		this.totalDelayLogs = this.totalDelayLogs.concat(this.delayLogs);
		this.delayLogs = [];

		return countMap;
	}
}

module.exports = new Logger();
