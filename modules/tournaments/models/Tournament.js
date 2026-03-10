const mongoose = require("mongoose");

const tournamentSchema = new mongoose.Schema(
	{
		name: { type: String, required: true, trim: true },
		format: {
			type: String,
			enum: ["1v1", "3v3"],
			default: "1v1",
			required: true,
			index: true,
		},
		slotGameName: { type: String, required: true, trim: true },
		prizeAmount: { type: Number, required: true, min: 0 },
		maxPlayers: { type: Number, required: true, min: 2 },
		teamSize: { type: Number, default: 1 },
		teamCount: { type: Number, default: 1, min: 1 },
		teamNames: { type: [String], default: [] },
		winningTeamName: { type: String, default: null },
		winningReason: { type: String, default: null },
		stealTriggered: { type: Boolean, default: false },
		teamResults: {
			type: [
				new mongoose.Schema(
					{
						teamKey: { type: String, required: true },
						teamName: { type: String, required: true },
						totalMultiplier: { type: Number, default: 0 },
						highestMultiplier: { type: Number, default: 0 },
						highestMultiplierPlayerId: {
							type: mongoose.Schema.Types.ObjectId,
							ref: "TournamentPlayer",
							default: null,
						},
					},
					{ _id: false }
				),
			],
			default: [],
		},
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
