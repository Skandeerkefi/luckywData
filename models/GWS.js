const mongoose = require("mongoose");

const gwsSchema = new mongoose.Schema({
	title: { type: String, required: true },
	entryRequirement: {
		type: String,
		enum: ["leaderboard_wager", "no_wager_requirement"],
		default: "leaderboard_wager",
	},
	requiredWagerAmount: {
		type: Number,
		default: 0,
		min: 0,
	},
	totalParticipants: { type: Number, default: 0 },
	endTime: { type: Date, required: true },
	totalEntries: { type: Number, default: 0 },
	winner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
	state: {
		type: String,
		enum: ["active", "complete"],
		default: "active",
	},
	participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
});

module.exports = mongoose.model("GWS", gwsSchema);
