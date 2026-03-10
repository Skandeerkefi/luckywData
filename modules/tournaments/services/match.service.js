const mongoose = require("mongoose");
const { Match } = require("../models/Match");
const { Tournament } = require("../models/Tournament");
const { TournamentPlayer } = require("../models/TournamentPlayer");
const { validateMatchResultPayload } = require("../validators");
const { moveTournamentToHistory } = require("./tournament.service");

const createError = (message, statusCode = 400) => {
	const error = new Error(message);
	error.statusCode = statusCode;
	return error;
};

const submitMatchResult = async ({ matchId, payload }) => {
	const validationError = validateMatchResultPayload(payload);
	if (validationError) throw createError(validationError, 400);

	const session = await mongoose.startSession();
	try {
		let responseData = null;
		await session.withTransaction(async () => {
			const match = await Match.findById(matchId).session(session);
			if (!match) throw createError("Match not found.", 404);

			if (match.status === "completed") {
				throw createError("Result already submitted for this match.", 409);
			}

			if (!match.player1 || !match.player2) {
				throw createError("Both players must exist in the match.", 400);
			}

			const winnerPlayerId =
				payload.multiplier1 > payload.multiplier2 ? match.player1 : match.player2;
			const loserPlayerId =
				String(winnerPlayerId) === String(match.player1)
					? match.player2
					: match.player1;

			match.multiplier1 = payload.multiplier1;
			match.multiplier2 = payload.multiplier2;
			match.winner = winnerPlayerId;
			match.status = "completed";
			await match.save({ session });

			await TournamentPlayer.updateOne(
				{ _id: loserPlayerId },
				{ $set: { isEliminated: true, eliminatedInRound: match.roundNumber } },
				{ session }
			);

			if (match.nextMatchId) {
				const nextMatch = await Match.findById(match.nextMatchId).session(session);
				if (!nextMatch) {
					throw createError("Next match not found for bracket progression.", 500);
				}

				if (!nextMatch.player1) {
					nextMatch.player1 = winnerPlayerId;
				} else if (!nextMatch.player2) {
					nextMatch.player2 = winnerPlayerId;
				} else {
					throw createError("Next match already has two players.", 409);
				}

				await nextMatch.save({ session });
			}

			const tournament = await Tournament.findById(match.tournament).session(session);
			if (!tournament) {
				throw createError("Tournament not found.", 404);
			}

			if (!match.nextMatchId) {
				const winnerPlayer = await TournamentPlayer.findById(winnerPlayerId)
					.select("userId")
					.session(session);
				if (!winnerPlayer) {
					throw createError("Winner player not found.", 500);
				}

				tournament.champion = winnerPlayer.userId;
				tournament.status = "finished";
				await tournament.save({ session });
				await moveTournamentToHistory({ tournament, session });
			}

			responseData = {
				matchId: match._id,
				winnerPlayerId,
				nextMatchId: match.nextMatchId || null,
				tournamentStatus: tournament.status,
				champion: tournament.champion || null,
			};
		});

		return responseData;
	} finally {
		session.endSession();
	}
};

module.exports = {
	submitMatchResult,
};
