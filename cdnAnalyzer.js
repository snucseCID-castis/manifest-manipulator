const CDN = require("./models/CDN");
const axios = require("axios");

async function retrieveCDNStatus(cdnURL) {
	const selectedCDN = await CDN.findOne({ url: cdnURL });
	if (!selectedCDN) {
		throw new Error("CDN not found");
	}
	if (selectedCDN.type === "cache") {
		const response = await axios.get(cdnURL + selectedCDN.traffic_uri);
		const data = response.data;
		return {
			connection_count: data.currentConnectionCount,
			tps: data.currentTps,
			bps: data.bitsPerSecond,
		};
	}
	// TODO: status retrieval for cloudfront
	if (selectedCDN.type === "cloudfront") {
		// const response = await axios.get(cdnURL + selectedCDN.traffic_uri);
		// const data = response.data;
		// return {
		//   connection_count: data.ConnectionCount,
		//   tps: data.TPS,
		//   bps: data.BPS,
		// };
		return selectedCDN.status;
	}
}

async function getAllCDNs() {
	return await CDN.find({});
}

class CDNAnalyzer {
	constructor(CDNs) {
		this.availableCDNs = CDNs;
		this.intervalID = setInterval(async () => {
			await this.saveCDNStatus();
		}, 2000);
	}

	async saveCDNStatus() {
		for (const cdn of this.availableCDNs) {
			const status = await retrieveCDNStatus(cdn.url);
			cdn.status = status;
			// console.log(cdn)
			await cdn.save();
		}
	}
}

async function CDNAnalyzerFactory() {
	const CDNs = await getAllCDNs();
	const cdnAnalyzer = new CDNAnalyzer(CDNs);
	return cdnAnalyzer;
}

module.exports = CDNAnalyzerFactory;
