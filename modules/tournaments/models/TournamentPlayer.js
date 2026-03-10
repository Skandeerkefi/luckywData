const mongoose = require("mongoose");

const tournamentPlayerSchema = new mongoose.Schema(
	{
		tournament: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Tournament",
			required: true,
			index: true,
		},
		userId: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		position: { type: Number, required: true, min: 1 },
		slotName: { type: String, required: true, trim: true },
		slotDisplayName: { type: String, required: true, trim: true },
		provider: { type: String, required: true, trim: true },
		slotImage: { type: String, required: true, trim: true },
		isEliminated: { type: Boolean, default: false },
		eliminatedInRound: { type: Number, default: null },
	},
	{ timestamps: true }
);

tournamentPlayerSchema.index({ tournament: 1, userId: 1 }, { unique: true });
tournamentPlayerSchema.index({ tournament: 1, position: 1 }, { unique: true });

const TournamentPlayer =
	mongoose.models.TournamentPlayer ||
	mongoose.model("TournamentPlayer", tournamentPlayerSchema);

module.exports = { TournamentPlayer };
