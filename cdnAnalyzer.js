const CDN = require("./models/CDN");
const axios = require("axios");
const Connection = require("./models/Connection");

async function retrieveCDNStatus(cdn) {
	if (cdn.type === "cache") {
		const response = await axios.get(cdn.apiUrl);
		if (response.status !== 200) {
			// TODO: proper health check
			return {
				isDown: true,
			};
		}
		const data = response.data;
		return {
			connection_count: data.currentConnectionCount,
			tps: data.currentTps,
			bps: data.bitsPerSecond,
		};
	}
	// TODO: status retrieval for cloudfront
	if (cdn.type === "cloudfront") {
		// const response = await axios.get(cdnURL + selectedCDN.traffic_uri);
		// const data = response.data;
		// return {
		//   connection_count: data.ConnectionCount,
		//   tps: data.TPS,
		//   bps: data.BPS,
		// };
		return cdn.status;
	}
}

async function getAllCDNs() {
	return await CDN.find({});
}

const optimalCDNCriteria = {
	BPS: "bps",
	TPS: "tps",
	ConnectionCount: "connection_count",
	BPSperConnCnt: "bps_per_connection_count",
	TPSperConnCnt: "tps_per_connection_count",
	BPSperConnCntMM: "bps_per_connection_count_mm",
	TPSperConnCntMM: "tps_per_connection_count_mm",
	BPSMMperConnCntMM: "bps_mm_per_connection_count_mm",
	TPSMMperConnCntMM: "tps_mm_per_connection_count_mm",
};

class CDNAnalyzer {
	optimalCDN = null;

	constructor(CDNs, criterion) {
		this.availableCDNs = CDNs;
		this.criterion = criterion;
		this.intervalID = setInterval(async () => {
			await this.saveCDNStatus();
			await this.updateOptimalCDN(this.criterion);
		}, 1000);
	}

	async saveCDNStatus() {
		for (const cdn of this.availableCDNs) {
			const status = await retrieveCDNStatus(cdn);
			cdn.status = status;
			// console.log(cdn)
			await cdn.save();
		}
	}

	updateCriterion(criterion) {
		this.criterion = criterion;
	}

	async updateOptimalCDN(criterion) {
		// find the optimal CDN based on criterion
		if (!criterion) {
			return;
		}

		// parse the criterion
		const metric = criterion.split("_")[0];
		const unit = criterion.endsWith("mm")
			? "MM"
			: criterion.includes("per")
				? "CDN"
				: null;
		const metricForMM = criterion.includes("_mm_");

		// determine the optimal CDN based on the criterion
		let optimalCDN = null;
		let optimalCDNPoint = 0;
		for (const CDN of this.availableCDNs) {
			if (CDN.status.isDown) {
				continue;
			}

			// TODO: weighting when CDN is almost full (user's delay is too high)
			// if unit is null, only use metric of CDN: case 1, 2, 3
			if (!unit) {
				const point = -1 * CDN.status[metric];
				if (!optimalCDN || point > optimalCDNPoint) {
					optimalCDN = CDN;
					optimalCDNPoint = point;
				}
				continue;
			}

			// if unit is CDN, use connection count of CDN: case 4, 5
			if (unit === "CDN") {
				if (CDN.status.connection_count === 0) {
					optimalCDN = CDN;
					optimalCDNPoint = Number.Infinity;
					continue;
				}

				const point = CDN.status[metric] / CDN.status.connection_count;
				if (!optimalCDN || point > optimalCDNPoint) {
					optimalCDN = CDN;
					optimalCDNPoint = point;
				}
				continue;
			}

			// if unit is MM, should calculate connection count of MM: case 6, 7
			const currentTime = new Date();
			const currentConnections = await Connection.find({
				cdn: CDN._id,
				expiry: { $gt: currentTime },
			});
			const mmConnectionCount = currentConnections.length;

			if (mmConnectionCount === 0) {
				optimalCDN = CDN;
				optimalCDNPoint = Number.Infinity;
				continue;
			}

			let currentMetric = CDN.status[metric];
			// if metric is for MM, calculate the metric of MM: case 8, 9
			if (metricForMM) {
				const currentLoadCount =
					CDN.status.connection_count - mmConnectionCount;
				const lastMMCount = CDN.lastStatus.mm_connection_count;
				const lastLoadCount = CDN.lastStatus.connection_count - lastMMCount;

				// [ currentMetric      [  mmConnectionCount, currentLoadCount         [  metricForMM(currentMetric)
				//	  lastMetric  ]  =      lastMMCount,     lastLoadCount    ]    @     metricForLoad ]
				const det =
					mmConnectionCount * lastLoadCount - currentLoadCount * lastMMCount;
				const lastMetric = CDN.lastStatus[metric];
				
				if (det !== 0) {
					currentMetric =
						(currentMetric * lastLoadCount - lastMetric * lastMMCount) / det; // metric for MM
				} else {
					// if det = 0, connection counts for MM and load are the same / or load is zero.
					// assume that the metric for load is the same as before,
					// so the change of metric is the change of metric for MM.
					const metricDiff = currentMetric - lastMetric;
					currentMetric = CDN.lastStatus.metric_for_mm + metricDiff;
				}
			}

			const point = currentMetric / mmConnectionCount;
			// console.log(optimalCDN);
			// console.log(CDN);
			// console.log(currentMetric, mmConnectionCount, point);
			if (!optimalCDN || point > optimalCDNPoint) {
				optimalCDN = CDN;
				optimalCDNPoint = point;
			}
			CDN.lastStatus = {
				bps: CDN.status.bps,
				tps: CDN.status.tps,
				connection_count: CDN.status.connection_count,
				mm_connection_count: mmConnectionCount,
				metric_for_mm: currentMetric,
			};
			await CDN.save();
		}

		this.optimalCDN = optimalCDN;
	}
}

async function CDNAnalyzerFactory(criterion) {
	const CDNs = await getAllCDNs();
	for (const CDN of CDNs) {
		CDN.status = {
			isDown: false,
			bps: 0,
			tps: 0,
			connection_count: 0,
		};
		CDN.lastStatus = {
			bps: 0,
			tps: 0,
			connection_count: 0,
			mm_connection_count: 0,
			metric_for_mm: 0,
		};
		await CDN.save();
	}
	const cdnAnalyzer = new CDNAnalyzer(CDNs, criterion);
	return cdnAnalyzer;
}

module.exports = { CDNAnalyzerFactory, optimalCDNCriteria };
