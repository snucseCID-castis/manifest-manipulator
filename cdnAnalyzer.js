const CDN = require("./model/CDN");
const axios = require("axios");

class CDNAnalyzer {
	constructor() {
		this.availableCDNs = CDN.find(); // fetch all CDNs from DB
	}
}

module.exports = CDNAnalyzer;
