const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const connectionSchema = new Schema(
	{
		cdn: { type: Schema.Types.ObjectId, ref: "CDN", required: false },
		expiry: { type: Date, default: () => new Date(Date.now() + 10000) }, // currently set to 10 seconds from now. TODO: adjust according to media playlist request rate
		requestLogs: { type: Map, of: [Date], default: {} },
		prevs: {
			type: Map,
			of: {
				type: Map,
				of: {
					lastSegment: { type: String, required: false, default: null },
					lastUpdated: { type: Date, required: false, default: Date.now() },
				},
			},
			default: {},
		},
	},
	{ optimisticConcurrency: true },
);

connectionSchema.index({ cdn: 1 });
connectionSchema.index({ expiry: 1 }, { expireAfterSeconds: 60 });

module.exports = mongoose.model("Connection", connectionSchema);
