const mongoose = require("mongoose");

const tournamentSchema = new mongoose.Schema(
	{
		name: { type: String, required: true, trim: true },
		slotGameName: { type: String, required: true, trim: true },
		prizeAmount: { type: Number, required: true, min: 0 },
		maxPlayers: { type: Number, enum: [8, 16], required: true },
		status: {
			type: String,
			enum: ["upcoming", "live", "finished"],
			default: "upcoming",
			index: true,
		},
		startDate: { type: Date, required: true },
		createdBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
			index: true,
		},
		champion: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			default: null,
		},
		bracketGenerated: { type: Boolean, default: false },
		roundsCount: { type: Number, default: 0 },
		historyMoved: { type: Boolean, default: false },
	},
	{ timestamps: true }
);

tournamentSchema.index({ status: 1, startDate: -1 });

const Tournament =
	mongoose.models.Tournament ||
	mongoose.model("Tournament", tournamentSchema);

module.exports = { Tournament };
