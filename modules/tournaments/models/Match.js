const mongoose = require("mongoose");

const matchSchema = new mongoose.Schema(
	{
		tournament: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Tournament",
			required: true,
			index: true,
		},
		roundNumber: { type: Number, required: true, min: 1 },
		matchNumber: { type: Number, required: true, min: 1 },
		player1: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "TournamentPlayer",
			default: null,
		},
		player2: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "TournamentPlayer",
			default: null,
		},
		multiplier1: { type: Number, default: null, min: 0 },
		multiplier2: { type: Number, default: null, min: 0 },
		winner: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "TournamentPlayer",
			default: null,
		},
		nextMatchId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Match",
			default: null,
		},
		status: {
			type: String,
			enum: ["pending", "completed"],
			default: "pending",
			index: true,
		},
	},
	{ timestamps: true }
);

matchSchema.index({ tournament: 1, roundNumber: 1, matchNumber: 1 }, { unique: true });

const Match = mongoose.models.Match || mongoose.model("Match", matchSchema);

module.exports = { Match };
