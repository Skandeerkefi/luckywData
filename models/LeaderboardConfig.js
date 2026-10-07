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

const scheduleSchema = new mongoose.Schema(
	{
		// HH:MM:SS at which each cycle boundary (stats end + cooldown start) is reached
		resetTime: { type: String, default: "00:00:00" },
		// IANA timezone the reset time is expressed in ("UTC", "Europe/Paris", ...)
		timezone: { type: String, default: "UTC" },
		// Cooldown after stats close, before the next cycle starts (hours)
		cooldownHours: { type: Number, default: 24 },
	},
	{ _id: false }
);

const leaderboardConfigSchema = new mongoose.Schema(
	{
		key: { type: String, required: true, unique: true, default: "roobet" },
		current: { type: leaderboardWindowSchema, default: null },
		previous: { type: leaderboardWindowSchema, default: null },
		schedule: { type: scheduleSchema, default: () => ({}) },
	},
	{ timestamps: true }
);

const LeaderboardConfig = mongoose.model(
	"LeaderboardConfig",
	leaderboardConfigSchema
);

module.exports = { LeaderboardConfig };