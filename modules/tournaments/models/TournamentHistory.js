const mongoose = require("mongoose");

const tournamentHistorySchema = new mongoose.Schema(
	{
		tournamentId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Tournament",
			required: true,
			index: true,
			unique: true,
		},
		name: { type: String, required: true, trim: true },
		format: {
			type: String,
			enum: ["1v1", "3v3"],
			default: "1v1",
		},
		slotGameName: { type: String, required: true, trim: true },
		prizeAmount: { type: Number, required: true },
		maxPlayers: { type: Number, required: true },
		teamSize: { type: Number, default: 1 },
		teamCount: { type: Number, default: 1 },
		teamNames: { type: [String], default: [] },
		winningTeamName: { type: String, default: null },
		winningReason: { type: String, default: null },
		stealTriggered: { type: Boolean, default: false },
		teamResults: { type: Array, default: [] },
		startDate: { type: Date, required: true },
		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		championUserId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			default: null,
		},
		championKickUsername: { type: String, default: null },
		players: { type: Array, default: [] },
		matches: { type: Array, default: [] },
		finishedAt: { type: Date, required: true },
	},
	{ timestamps: true }
);

const TournamentHistory =
	mongoose.models.TournamentHistory ||
	mongoose.model("TournamentHistory", tournamentHistorySchema);

module.exports = { TournamentHistory };
