const mongoose = require("mongoose");
const { Tournament } = require("../models/Tournament");
const { TournamentPlayer } = require("../models/TournamentPlayer");
const { Match } = require("../models/Match");
const { TournamentHistory } = require("../models/TournamentHistory");
const { User } = require("../../../models/User");
const { generateBracketForTournament } = require("../logic/bracket.logic");
const {
	validateCreateTournamentPayload,
	validateJoinPayload,
} = require("../validators");
const { validateSlotSelection } = require("../slot.service");

const createError = (message, statusCode = 400) => {
	const error = new Error(message);
	error.statusCode = statusCode;
	return error;
};

const ensureTournamentExists = async (tournamentId, session) => {
	const tournament = await Tournament.findById(tournamentId).session(session || null);
	if (!tournament) {
		throw createError("Tournament not found.", 404);
	}
	return tournament;
};

const moveTournamentToHistory = async ({ tournament, session }) => {
	if (tournament.historyMoved) return;

	const [players, matches, championUser] = await Promise.all([
		TournamentPlayer.find({ tournament: tournament._id })
			.populate("userId", "kickUsername")
			.session(session),
		Match.find({ tournament: tournament._id })
			.sort({ roundNumber: 1, matchNumber: 1 })
			.populate("player1 player2 winner")
			.session(session),
		tournament.champion ? User.findById(tournament.champion).session(session) : null,
	]);

	await TournamentHistory.updateOne(
		{ tournamentId: tournament._id },
		{
			$setOnInsert: {
				tournamentId: tournament._id,
				name: tournament.name,
				slotGameName: tournament.slotGameName,
				prizeAmount: tournament.prizeAmount,
				maxPlayers: tournament.maxPlayers,
				startDate: tournament.startDate,
				createdBy: tournament.createdBy,
				championUserId: tournament.champion || null,
				championKickUsername: championUser?.kickUsername || null,
				players: players.map((p) => ({
					id: p._id,
					userId: p.userId?._id || p.userId,
					kickUsername: p.userId?.kickUsername || null,
					position: p.position,
					slotName: p.slotName,
					slotDisplayName: p.slotDisplayName,
					provider: p.provider,
					slotImage: p.slotImage,
					isEliminated: p.isEliminated,
					eliminatedInRound: p.eliminatedInRound,
				})),
				matches: matches.map((m) => ({
					id: m._id,
					roundNumber: m.roundNumber,
					matchNumber: m.matchNumber,
					player1: m.player1,
					player2: m.player2,
					multiplier1: m.multiplier1,
					multiplier2: m.multiplier2,
					winner: m.winner,
					nextMatchId: m.nextMatchId,
					status: m.status,
				})),
				finishedAt: new Date(),
			},
		},
		{ upsert: true, session }
	);

	tournament.historyMoved = true;
	await tournament.save({ session });
};

const createTournament = async ({ payload, adminUserId }) => {
	const validationError = validateCreateTournamentPayload(payload);
	if (validationError) throw createError(validationError, 400);

	const tournament = await Tournament.create({
		name: payload.name.trim(),
		slotGameName: payload.slotGameName.trim(),
		prizeAmount: payload.prizeAmount,
		maxPlayers: payload.maxPlayers,
		status: "upcoming",
		startDate: new Date(payload.startDate),
		createdBy: adminUserId,
	});

	return tournament;
};

const listTournaments = async () => {
	const tournaments = await Tournament.find({ status: { $ne: "finished" } })
		.sort({ startDate: 1, createdAt: -1 })
		.lean();

	const ids = tournaments.map((t) => t._id);
	const counts = await TournamentPlayer.aggregate([
		{ $match: { tournament: { $in: ids } } },
		{ $group: { _id: "$tournament", count: { $sum: 1 } } },
	]);

	const countMap = new Map(counts.map((c) => [String(c._id), c.count]));

	return tournaments.map((t) => ({
		...t,
		joinedPlayers: countMap.get(String(t._id)) || 0,
	}));
};

const getTournamentById = async (tournamentId) => {
	const tournament = await Tournament.findById(tournamentId)
		.populate("createdBy", "kickUsername")
		.populate("champion", "kickUsername")
		.lean();

	if (!tournament) throw createError("Tournament not found.", 404);

	const [players, matches] = await Promise.all([
		TournamentPlayer.find({ tournament: tournamentId })
			.populate("userId", "kickUsername")
			.sort({ position: 1 })
			.lean(),
		Match.find({ tournament: tournamentId })
			.populate({
				path: "player1 player2 winner",
				populate: { path: "userId", select: "kickUsername" },
			})
			.sort({ roundNumber: 1, matchNumber: 1 })
			.lean(),
	]);

	return { tournament, players, matches };
};

const joinTournament = async ({ tournamentId, userId, userRole, payload }) => {
	if (userRole === "admin") {
		throw createError("Admins cannot join tournaments.", 403);
	}

	const validationError = validateJoinPayload(payload);
	if (validationError) throw createError(validationError, 400);

	const slotIsValid = await validateSlotSelection(payload);
	if (!slotIsValid) {
		throw createError(
			"Invalid slot selection. Pick a slot from /api/slots/search results.",
			400
		);
	}

	const session = await mongoose.startSession();
	try {
		let responseData = null;
		await session.withTransaction(async () => {
			const tournament = await ensureTournamentExists(tournamentId, session);

			if (tournament.status !== "upcoming") {
				throw createError("You can only join upcoming tournaments.", 400);
			}

			if (payload.position > tournament.maxPlayers) {
				throw createError(
					`Position must be between 1 and ${tournament.maxPlayers}.`,
					400
				);
			}

			const [existingJoin, existingPosition] = await Promise.all([
				TournamentPlayer.findOne({ tournament: tournament._id, userId }).session(session),
				TournamentPlayer.findOne({
					tournament: tournament._id,
					position: payload.position,
				}).session(session),
			]);

			if (existingJoin) {
				throw createError("You already joined this tournament.", 409);
			}

			if (existingPosition) {
				throw createError("This bracket position is already taken.", 409);
			}

			await TournamentPlayer.create(
				[
					{
						tournament: tournament._id,
						userId,
						position: payload.position,
						slotName: payload.slotName,
						slotDisplayName: payload.slotDisplayName,
						provider: payload.provider,
						slotImage: payload.slotImage,
					},
				],
				{ session }
			);

			const joinedCount = await TournamentPlayer.countDocuments({
				tournament: tournament._id,
			}).session(session);

			if (joinedCount === tournament.maxPlayers && !tournament.bracketGenerated) {
				const bracket = await generateBracketForTournament({ tournament, session });
				tournament.bracketGenerated = true;
				tournament.roundsCount = bracket.roundsCount;
				await tournament.save({ session });
			}

			responseData = {
				tournamentId: tournament._id,
				joinedCount,
				maxPlayers: tournament.maxPlayers,
				bracketGenerated: tournament.bracketGenerated || joinedCount === tournament.maxPlayers,
			};
		});

		return responseData;
	} finally {
		session.endSession();
	}
};

const startTournament = async (tournamentId) => {
	const session = await mongoose.startSession();
	try {
		let result = null;
		await session.withTransaction(async () => {
			const tournament = await ensureTournamentExists(tournamentId, session);
			if (tournament.status !== "upcoming") {
				throw createError("Only upcoming tournaments can be started.", 400);
			}

			const joinedCount = await TournamentPlayer.countDocuments({
				tournament: tournament._id,
			}).session(session);

			if (joinedCount !== tournament.maxPlayers) {
				throw createError("Tournament must be full before it can start.", 400);
			}

			if (!tournament.bracketGenerated) {
				const bracket = await generateBracketForTournament({ tournament, session });
				tournament.bracketGenerated = true;
				tournament.roundsCount = bracket.roundsCount;
			}

			tournament.status = "live";
			await tournament.save({ session });

			result = tournament;
		});
		return result;
	} finally {
		session.endSession();
	}
};

const deleteTournament = async (tournamentId) => {
	const session = await mongoose.startSession();
	try {
		await session.withTransaction(async () => {
			const tournament = await ensureTournamentExists(tournamentId, session);
			if (tournament.status === "finished") {
				throw createError("Finished tournaments cannot be deleted.", 400);
			}

			await Promise.all([
				TournamentPlayer.deleteMany({ tournament: tournament._id }).session(session),
				Match.deleteMany({ tournament: tournament._id }).session(session),
				Tournament.deleteOne({ _id: tournament._id }).session(session),
			]);
		});
	} finally {
		session.endSession();
	}
};

const listTournamentHistory = async () => {
	return TournamentHistory.find({})
		.sort({ finishedAt: -1 })
		.populate("championUserId", "kickUsername")
		.lean();
};

module.exports = {
	createTournament,
	listTournaments,
	getTournamentById,
	joinTournament,
	startTournament,
	deleteTournament,
	listTournamentHistory,
	moveTournamentToHistory,
};
