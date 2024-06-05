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
		// find the optimal CDN based on bps per connection.
		// TODO: implement check for other criterion to eliminate outliers

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
		const metricOfMM = criterion.includes("mm_");

		// determine the optimal CDN based on the criterion
		let optimalCDN = this.availableCDNs[0];
		let mmConnectionCountOfOptimalCDN = 0;
		for (const CDN of this.availableCDNs) {
			if (CDN.status.isDown) {
				continue;
			}

			// if unit is null, only use metric of CDN: case 1, 2, 3
			// TODO: weighting when CDN is almost full (user's delay is too high)
			if (!unit) {
				optimalCDN =
					CDN.status[metric] < optimalCDN.status[metric] ? CDN : optimalCDN;
				continue;
			}

			// if unit is CDN, use connection count of CDN: case 6, 7
			if (unit === "CDN") {
				if (CDN.status.connection_count === 0) {
					optimalCDN = CDN;
					continue;
				}
				optimalCDN =
					CDN.status[metric] / CDN.status.connection_count >
					optimalCDN.status[metric] / optimalCDN.status.connection_count
						? CDN
						: optimalCDN;
				continue;
			}
		}

		this.optimalCDN = optimalCDN;
	}
}

async function CDNAnalyzerFactory(criterion) {
	const CDNs = await getAllCDNs();
	const cdnAnalyzer = new CDNAnalyzer(CDNs, criterion);
	return cdnAnalyzer;
}

module.exports = { CDNAnalyzerFactory, optimalCDNCriteria };
