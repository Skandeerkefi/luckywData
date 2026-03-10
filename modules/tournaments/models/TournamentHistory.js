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
		slotGameName: { type: String, required: true, trim: true },
		prizeAmount: { type: Number, required: true },
		maxPlayers: { type: Number, required: true },
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
