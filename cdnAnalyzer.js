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
	return await CDN.find({ type: "cache" });
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

	constructor(
		CDNs,
		lastResort,
		criterion,
		targetCost,
		dynamicSelector,
		triggerRatio,
		setRatio,
	) {
		this.availableCDNs = CDNs;
		this.lastResort = lastResort;
		this.criterion = criterion;
		this.targetCost = targetCost;
		this.dynamicSelector = dynamicSelector;
		this.triggerRatio = triggerRatio; // threshold of checking cost exceedance
		this.setRatio = setRatio; // setting point of cost when the cost exceedance
		this.intervalID = setInterval(async () => {
			await this.saveCDNStatus(this.dynamicSelector);
			await this.updateOptimalCDN(this.criterion);
			await this.handleCostExceedance();
		}, 1000);
	}

	async saveCDNStatus(dynamicSelector) {
		const newlyDownCDNs = [];
		for (const cdn of this.availableCDNs) {
			const wasDown = cdn.status.isDown;
			const status = await retrieveCDNStatus(cdn);
			if (!wasDown && status.isDown) {
				newlyDownCDNs.push(cdn);
			}
			cdn.status = status;
			await cdn.save();
		}
		const connections = await Connection.find({ cdn: { $in: newlyDownCDNs } });
		const minimumCost = Math.min(
			...this.availableCDNs
				.filter((cdn) => cdn.status.isDown !== true)
				.map((cdn) => cdn.cost),
		);
		if (minimumCost >= this.targetCost) {
			dynamicSelector.distributeConnections(
				connections,
				this.availableCDNs,
				minimumCost,
			);
		} else {
			dynamicSelector.distributeConnections(
				connections,
				this.availableCDNs,
				minimumCost + (this.targetCost - minimumCost) * this.triggerRatio,
			);
		}
	}

	updateCriterion(criterion) {
		this.criterion = criterion;
	}

	updateTargetCost(cost) {
		this.targetCost = cost;
	}

	parseCriterion(criterion) {
		const metric = criterion.split("_")[0];
		const unit = criterion.endsWith("mm")
			? "MM"
			: criterion.includes("per")
				? "CDN"
				: null;
		const metricForMM = criterion.includes("_mm_");

		return { metric, unit, metricForMM };
	}

	async scoreCDN(CDN, parsedCriterion) {
		// if CDN is down, return negative infinity
		if (CDN.status.isDown) {
			return Number.NEGATIVE_INFINITY;
		}

		const { metric, unit, metricForMM } = parsedCriterion;

		// if unit is null, only use metric of CDN: case 1, 2, 3
		if (!unit) {
			return -1 * CDN.status[metric];
		}

		// if unit is CDN, use connection count of CDN: case 4, 5
		if (unit === "CDN") {
			if (CDN.status.connection_count === 0) {
				return Number.POSITIVE_INFINITY;
			}
			return CDN.status[metric] / CDN.status.connection_count;
		}

		// if unit is MM, should calculate connection count of MM: case 6, 7
		const currentConnections = await Connection.find({
			cdn: CDN._id,
			expiry: { $gt: new Date() },
		});
		const mmConnectionCount = currentConnections.length;

		if (mmConnectionCount === 0) {
			return Number.POSITIVE_INFINITY;
		}

		let currentMetric = CDN.status[metric];
		// if metric is for MM, calculate the metric of MM: case 8, 9
		if (metricForMM) {
			const currentLoadCount = CDN.status.connection_count - mmConnectionCount;
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
				// Assume that the change of metric is evenly distributed to MM and load.
				const metricDiff = currentMetric - lastMetric;
				const metricDiffPerConn =
					metricDiff / (mmConnectionCount + currentLoadCount);
				currentMetric =
					CDN.lastStatus.metric_for_mm + metricDiffPerConn * mmConnectionCount;
			}
		}

		CDN.lastStatus = {
			bps: CDN.status.bps,
			tps: CDN.status.tps,
			connection_count: CDN.status.connection_count,
			mm_connection_count: mmConnectionCount,
			metric_for_mm: currentMetric,
		};
		await CDN.save();

		return currentMetric / mmConnectionCount;
	}

	async updateOptimalCDN(criterion) {
		// find the optimal CDN based on criterion and sort the list
		if (!criterion) {
			return;
		}
		// parse the criterion
		const parsedCriterion = this.parseCriterion(criterion);

		const scoredCDNs = await Promise.all(
			this.availableCDNs.map(async (CDN) => {
				const score = await this.scoreCDN(CDN, parsedCriterion);
				return { CDN, score };
			}),
		);

		// sort availableCDNs based on score
		scoredCDNs.sort((a, b) => b.score - a.score);

		this.availableCDNs = scoredCDNs.map((scoredCDN) => scoredCDN.CDN);
		this.optimalCDN = this.availableCDNs[0];
	}
	async handleCostExceedance() {
		//console.log("###########################################");
		try {
			const now = new Date();
			const connectionCounts = await Connection.aggregate([
				{ $match: { expiry: { $gt: now } } },
				{ $group: { _id: "$cdn", count: { $sum: 1 } } },
			]);
			const connectionCountMap = {};
			for (const item of connectionCounts) {
				connectionCountMap[item._id] = item.count;
			}
			//console.log("CountMap:", connectionCountMap);
			let totalCost = 0;
			let totalConnections = 0;
			for (const cdn of this.availableCDNs) {
				const count = connectionCountMap[cdn.id] || 0;
				totalCost += cdn.cost * count;
				totalConnections += count;
			}
			//console.log("Cost, Connections:", totalCost, totalConnections);
			const minimumCost = Math.min(
				...this.availableCDNs
					.filter((cdn) => cdn.status.isDown !== true)
					.map((cdn) => cdn.cost),
			);
			//console.log("##################################");
			//console.log(totalConnections, totalCost, minimumCost, this.targetCost);
			if (
				totalConnections &&
				totalCost / totalConnections >
					minimumCost + (this.targetCost - minimumCost) * this.triggerRatio
			) {
				//console.log("Exceedance detected");
				if (minimumCost < this.targetCost) {
					this.dynamicSelector.changeCostLimit(
						minimumCost + (this.targetCost - minimumCost) * this.setRatio,
					);
				} else {
					this.dynamicSelector.changeCostLimit(minimumCost);
				}
			}
		} catch (error) {
			console.error("Error calculating average cost:", error);
			return;
		}
	}
}

async function CDNAnalyzerFactory(
	criterion,
	targetCost,
	dynamicSelector,
	triggerRatio,
	setRatio,
) {
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
	const lastResort = await CDN.findOne({ type: "cloudfront" });
	const cdnAnalyzer = new CDNAnalyzer(
		CDNs,
		lastResort,
		criterion,
		targetCost,
		dynamicSelector,
		triggerRatio,
		setRatio,
	);
	return cdnAnalyzer;
}

module.exports = { CDNAnalyzerFactory, optimalCDNCriteria };
