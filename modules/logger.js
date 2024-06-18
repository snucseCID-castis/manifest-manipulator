const DelayLog = require("../models/DelayLog");
const DownLog = require("../models/DownLog");
const PerfLog = require("../models/PerfLog");

class Logger {
	totalDelayLogs = [];
	delayLogs = [];
	downLogs = [];
	perfLogs = [];

	// convert UTC time to Korea time
	KoreaTime(time) {
		const offset = 9 * 60 * 60 * 1000;
		return new Date(time + offset);
	}

	appendDelayLog(prevCdnName, newCdnName, connectionId, time) {
		const krTime = this.KoreaTime(time);
		const delayLog = new DelayLog({
			prevCdnName: prevCdnName | "",
			newCdnName: newCdnName,
			connection: connectionId,
			time: new Date(time),
		});
		this.delayLogs.push(delayLog);
		global.io.emit("delayLog", delayLog);

		let message = `[Delay] ${krTime.toISOString()}\n`;
		message += `prev CDN: ${prevCdnName} -> new CDN: ${newCdnName}\n`;
		console.log(message);
	}

	appendDownLog(downCdnNames, distributedConnCounts, prevCdnConnCount, time) {
		const krTime = this.KoreaTime(time);
		const downLog = new DownLog({
			downCdnNames: downCdnNames,
			distributedConnCounts: distributedConnCounts,
			prevCdnConnCount: prevCdnConnCount,
			time: new Date(time),
		});
		this.downLogs.push(downLog);
		global.io.emit("downLog", downLog);

		let message = `[Down] ${krTime.toISOString()}\n`;
		message += `${downCdnNames.join(
			", ",
		)}: total ${prevCdnConnCount} clients\n`;

		for (const [cdnName, count] of distributedConnCounts) {
			message += `\t -> ${cdnName}: ${count} clients\n`;
		}
		console.log(message);
	}

	appendPerfLog(cost, costLimit, maxCost, perfMap, time) {
		const krTime = this.KoreaTime(time);
		const perfLog = new PerfLog({
			currentCost: cost,
			costLimit: costLimit,
			maximumCost: maxCost,
			performanceMap: perfMap,
			time: new Date(time),
		});
		this.perfLogs.push(perfLog);
		global.io.emit("perfLog", perfLog);

		let message = `[Performance] ${krTime.toISOString()}\n`;
		message += `(cost) ${cost} / ${maxCost} | limit: ${costLimit}\n`;
		for (const [cdnName, perf] of perfMap) {
			if (perf.isDown) {
				message += `${cdnName}: DOWN!!!\n`;
			} else {
				message += `${cdnName}: connecting ${perf.clientCount} | delayed ${perf.delayCount} \n`;
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
