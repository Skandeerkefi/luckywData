const mongoose = require("mongoose");

const prizeSplitSchema = new mongoose.Schema(
	{
		rank: { type: Number, required: true },
		amount: { type: Number, required: true, default: 0 },
	},
	{ _id: false }
);

const leaderboardWindowSchema = new mongoose.Schema(
	{
		startDate: { type: String, required: true },
		endDate: { type: String, required: true },
		prizeSplit: { type: [prizeSplitSchema], default: [] },
	},
	{ _id: false }
);

const leaderboardConfigSchema = new mongoose.Schema(
	{
		key: { type: String, required: true, unique: true, default: "roobet" },
		current: { type: leaderboardWindowSchema, default: null },
		previous: { type: leaderboardWindowSchema, default: null },
	},
	{ timestamps: true }
);

const LeaderboardConfig = mongoose.model(
	"LeaderboardConfig",
	leaderboardConfigSchema
);

module.exports = { LeaderboardConfig };