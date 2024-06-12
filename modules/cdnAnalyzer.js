const axios = require("axios");
const CDN = require("../models/CDN");
const Connection = require("../models/Connection");
const logger = require("./logger");

async function retrieveCDNStatus(cdn) {
	if (cdn.type === "cache") {
		try {
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
				isDown: false,
			};
		} catch (error) {
			return {
				isDown: true,
			};
		}
	}
}

async function getAllCDNs() {
	return await CDN.find({ type: "cache" });
}

const optimalCDNCriteria = {
	BPS: "bps",
	TPS: "tps",
	ConnectionCount: "connection_count",
	BPSperConn: "bps_per_connection",
	TPSperConn: "tps_per_connection",
	BPSperClient: "bps_per_client",
	TPSperClient: "tps_per_client",
	BPSMMperClient: "bps_mm_per_client",
	TPSMMperClient: "tps_mm_per_client",
};

class CDNAnalyzer {
	optimalCDN = null;
	logger = logger;

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
			// await cdn.save();
		}
		if (newlyDownCDNs.length !== 0) {
			const currTime = Date.now();
			const connections = await Connection.find({
				cdn: { $in: newlyDownCDNs.map((cdn) => cdn._id) },
			});
			const downCdnNames = newlyDownCDNs.map((cdn) => cdn.name);
			const prevCdnConnCount = connections.length;
			if (prevCdnConnCount === 0) {
				return;
			}

			let minimumCost = Math.min(
				...this.availableCDNs
					.filter((cdn) => cdn.status.isDown !== true)
					.map((cdn) => cdn.cost),
			);
			if (minimumCost < this.targetCost) {
				minimumCost += (this.targetCost - minimumCost) * this.triggerRatio;
			}

			const distributedConnCounts = await dynamicSelector.distributeConnections(
				connections,
				this.availableCDNs,
				minimumCost,
			);

			this.logger.appendDownLog(
				downCdnNames,
				distributedConnCounts,
				prevCdnConnCount,
				currTime,
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
		const unit = criterion.endsWith("client")
			? "CLIENT"
			: criterion.endsWith("connection")
				? "CONNECTION"
				: null;
		const metricForMM = criterion.includes("_mm_");

		return { metric, unit, metricForMM };
	}

	async scoreCDN(CDN, parsedCriterion) {
		// if CDN is down, return negative infinity
		let score;
		if (CDN.status.isDown) {
			score = Number.NEGATIVE_INFINITY;
			return { score, clientCount: 0 };
		}

		// calculate client
		const clientCount = await Connection.countDocuments({
			cdn: CDN._id,
			expiry: { $gt: new Date() },
		});

		const { metric, unit, metricForMM } = parsedCriterion;

		// if unit is null, only use metric of CDN: case 1, 2, 3
		if (!unit) {
			score = -1 * CDN.status[metric];
			return { score, clientCount };
		}

		// if unit is CONNECTION, use connection count of CDN: case 4, 5
		if (unit === "CONNECTION") {
			if (CDN.status.connection_count === 0) {
				score = Number.POSITIVE_INFINITY;
				return { score, clientCount: 0 };
			}
			score = CDN.status[metric] / CDN.status.connection_count;
			return { score, clientCount: clientCount };
		}

		// if unit is CLIENT: case 6, 7
		if (clientCount === 0) {
			score = Number.POSITIVE_INFINITY;
			return { score, clientCount: 0 };
		}

		let currentMetric = CDN.status[metric];
		// if metric is for MM, calculate the metric of MM: case 8, 9
		if (metricForMM) {
			let currentLoadCount = CDN.status.connection_count - clientCount;
			if (currentLoadCount < 0) {
				currentLoadCount = 0;
			}
			const lastClientCount = CDN.lastStatus.client_count;	// TODO:
			const lastLoadCount = CDN.lastStatus.connection_count - lastClientCount;

			// [ currentMetric      [ clientCount, currentLoadCount        [  metricForMM(currentMetric)
			//	  lastMetric  ]  =    lastClientCount, lastLoadCount ]  @          metricForLoad        ]
			const det =
				clientCount * lastLoadCount - currentLoadCount * lastClientCount;
			const lastMetric = CDN.lastStatus[metric];

			if (det !== 0) {
				currentMetric =
					(currentMetric * lastLoadCount - lastMetric * lastClientCount) / det; // metric for MM
			} else {
				// if det = 0, connection counts for MM and load are the same / or load is zero.
				// Assume that the change of metric is evenly distributed to MM and load.
				const metricDiff = currentMetric - lastMetric;
				const metricDiffPerConn =
					metricDiff / (clientCount + currentLoadCount);
				currentMetric =
					CDN.lastStatus.metric_for_mm + metricDiffPerConn * clientCount;
			}
		}
		CDN.lastStatus = {
			bps: CDN.status.bps,
			tps: CDN.status.tps,
			connection_count: CDN.status.connection_count,
			client_count: clientCount,
			metric_for_mm: currentMetric,
		};
		await CDN.save();
		score = currentMetric / clientCount;
		return { score, clientCount };
	}

	async updateOptimalCDN(criterion) {
		this.availableCDNs = await getAllCDNs(); // TODO: remove this for performance
		// find the optimal CDN based on criterion and sort the list
		if (!criterion) {
			return;
		}
		// parse the criterion
		const parsedCriterion = this.parseCriterion(criterion);

		const scoredCDNs = await Promise.all(
			this.availableCDNs.map(async (CDN) => {
				const { score, clientCount } = await this.scoreCDN(
					CDN,
					parsedCriterion,
				);
				return { CDN, score, clientCount };
			}),
		);

		// for performance logging
		const currTime = Date.now();
		const delayMap = this.logger.getDelayCount();
		const performanceMap = new Map();

		for (const { CDN, clientCount } of scoredCDNs) {
			const cdnName = CDN.name;
			const delayCount = delayMap.get(cdnName) || 0;
			const isDown = CDN.status.isDown;
			performanceMap.set(cdnName, {
				isDown,
				clientCount,
				delayCount,
			});
		}

		const clientCountCF = await Connection.countDocuments({
			cdn: this.lastResort._id,
			expiry: { $gt: new Date() },
		});
		const delayCountCF = delayMap.get("CloudFront") || 0;
		performanceMap.set("CloudFront", {
			isDown: false,
			clientCount: clientCountCF,
			delayCount: delayCountCF,
		});

		this.logger.appendPerfLog(performanceMap, currTime);

		// sort availableCDNs based on score
		scoredCDNs.sort((a, b) => b.score - a.score);

		this.availableCDNs = scoredCDNs.map((scoredCDN) => scoredCDN.CDN);
		this.optimalCDN = this.availableCDNs[0];
	}
	async handleCostExceedance() {
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
			let totalCost = 0;
			let totalConnections = 0;
			for (const cdn of this.availableCDNs) {
				const count = connectionCountMap[cdn.id] || 0;
				totalCost += cdn.cost * count;
				totalConnections += count;
			}
			const minimumCost = Math.min(
				...this.availableCDNs
					.filter((cdn) => cdn.status.isDown !== true)
					.map((cdn) => cdn.cost),
			);
			if (
				totalConnections &&
				totalCost / totalConnections >
					minimumCost + (this.targetCost - minimumCost) * this.triggerRatio
			) {
				if (minimumCost < this.targetCost) {
					this.dynamicSelector.changeCostLimit(
						minimumCost + (this.targetCost - minimumCost) * this.setRatio,
					);
				} else {
					this.dynamicSelector.changeCostLimit(minimumCost);
				}
			} else {
				this.dynamicSelector.changeCostLimit(null);
			}

			// console.log(totalConnections)
			// console.log("Cost: ", totalCost / totalConnections, " / ", this.targetCost);
			// console.log("minimumCost: ", minimumCost);
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
			client_count: 0,
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
