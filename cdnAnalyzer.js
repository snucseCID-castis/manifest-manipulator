const CDN = require("./models/CDN");
const axios = require("axios");

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

class CDNAnalyzer {
	optimalCDN = null;

	constructor(CDNs) {
		this.availableCDNs = CDNs;
		this.intervalID = setInterval(async () => {
			await this.saveCDNStatus();
			await this.updateOptimalCDN();
		}, 2000);
	}

	async saveCDNStatus() {
		for (const cdn of this.availableCDNs) {
			const status = await retrieveCDNStatus(cdn);
			cdn.status = status;
			// console.log(cdn)
			await cdn.save();
		}
	}

	async updateOptimalCDN() {
		// find the optimal CDN based on bps per connection.
		// TODO: implement check for other criterion to eliminate outliers
		const optimalCDN = this.availableCDNs.reduce((largest, current) => {
			return (!current.status.isDown &&
				current.status.bps / current.status.connection_count) >=
				largest.status.bps / largest.status.connection_count
				? current
				: largest;
		});
		this.optimalCDN = optimalCDN;
	}
}

async function CDNAnalyzerFactory() {
	const CDNs = await getAllCDNs();
	const cdnAnalyzer = new CDNAnalyzer(CDNs);
	return cdnAnalyzer;
}

module.exports = CDNAnalyzerFactory;
