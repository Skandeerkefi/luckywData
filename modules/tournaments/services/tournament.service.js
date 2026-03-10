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

const TEAM_SIZE_3V3 = 3;
const MIN_3V3_TEAM_COUNT = 2;
const MAX_3V3_TEAM_COUNT = 12;

const buildTeamKeys = (teamCount) =>
	Array.from({ length: teamCount }, (_, index) => `team-${index + 1}`);

const buildDefaultTeamNames = (teamCount) =>
	Array.from({ length: teamCount }, (_, index) => `Team ${index + 1}`);

const parseTeamIndex = (teamKey) => {
	if (typeof teamKey !== "string") return -1;
	const match = /^team-(\d+)$/.exec(teamKey);
	if (!match) return -1;
	return Number(match[1]) - 1;
};

const getTeamCount = (tournament) =>
	Number(tournament.teamCount) ||
	(tournament.teamSize > 1 ? Math.floor(tournament.maxPlayers / tournament.teamSize) : 0);

const getTournamentTeamKey = (position, teamSize, teamCount) => {
	const normalizedTeamSize = Number(teamSize) || TEAM_SIZE_3V3;
	const index = Math.floor((position - 1) / normalizedTeamSize);
	if (index < 0 || index >= teamCount) return null;
	return `team-${index + 1}`;
	};

	const mapTeamName = (tournament, teamKey) => {
	const index = parseTeamIndex(teamKey);
	if (index < 0) return teamKey;
	return tournament.teamNames?.[index] || `Team ${index + 1}`;
	};

	const resolveCreateFormat = (payload) => {
	const maxPlayers = Number(payload.maxPlayers);
	const teamCount = Number(payload.teamCount);
	if (typeof payload.format === "string" && payload.format.trim().length > 0) {
		return payload.format;
	}
	if (Number.isInteger(teamCount) && teamCount > 0) {
		return "3v3";
	}
	if (Number.isInteger(maxPlayers) && maxPlayers % TEAM_SIZE_3V3 === 0 && maxPlayers >= 6) {
		return "3v3";
	}
	return "1v1";
};

	const resolveTeamCount = (payload) => {
	const provided = Number(payload.teamCount);
	if (Number.isInteger(provided) && provided >= MIN_3V3_TEAM_COUNT && provided <= MAX_3V3_TEAM_COUNT) {
		return provided;
	}
	const inferred = Math.floor(Number(payload.maxPlayers) / TEAM_SIZE_3V3);
	if (Number.isInteger(inferred) && inferred >= MIN_3V3_TEAM_COUNT && inferred <= MAX_3V3_TEAM_COUNT) {
		return inferred;
	}
	return null;
};

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
				format: tournament.format,
				slotGameName: tournament.slotGameName,
				prizeAmount: tournament.prizeAmount,
				maxPlayers: tournament.maxPlayers,
				teamSize: tournament.teamSize,
				teamCount: tournament.teamCount,
				teamNames: tournament.teamNames,
				winningTeamName: tournament.winningTeamName,
				winningReason: tournament.winningReason,
				stealTriggered: tournament.stealTriggered,
				teamResults: tournament.teamResults || [],
				startDate: tournament.startDate,
				createdBy: tournament.createdBy,
				championUserId: tournament.champion || null,
				championKickUsername: championUser?.kickUsername || null,
				players: players.map((p) => ({
					id: p._id,
					userId: p.userId?._id || p.userId,
					kickUsername: p.userId?.kickUsername || null,
					position: p.position,
					teamKey: p.teamKey,
					slotName: p.slotName,
					slotDisplayName: p.slotDisplayName,
					provider: p.provider,
					slotImage: p.slotImage,
					multiplier: p.multiplier,
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

	const normalizedMaxPlayers = Number(payload.maxPlayers);
	const normalizedFormat = resolveCreateFormat(payload);
	const normalizedTeamCount =
		normalizedFormat === "3v3" ? resolveTeamCount(payload) : 1;
	if (normalizedFormat === "3v3" && !normalizedTeamCount) {
		throw createError("Invalid teamCount for 3v3 tournament.", 400);
	}
	const computedMaxPlayers =
		normalizedFormat === "3v3"
			? normalizedTeamCount * TEAM_SIZE_3V3
			: normalizedMaxPlayers;

	const tournament = await Tournament.create({
		name: payload.name.trim(),
		format: normalizedFormat,
		slotGameName: payload.slotGameName.trim(),
		prizeAmount: payload.prizeAmount,
		maxPlayers: computedMaxPlayers,
		teamSize: normalizedFormat === "3v3" ? TEAM_SIZE_3V3 : 1,
		teamCount: normalizedFormat === "3v3" ? normalizedTeamCount : 1,
		teamNames:
			normalizedFormat === "3v3"
				? buildDefaultTeamNames(normalizedTeamCount)
				: [],
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

			const [existingJoin, existingPosition, existingSlot] = await Promise.all([
				TournamentPlayer.findOne({ tournament: tournament._id, userId }).session(session),
				TournamentPlayer.findOne({
					tournament: tournament._id,
					position: payload.position,
				}).session(session),
				TournamentPlayer.findOne({
					tournament: tournament._id,
					slotName: payload.slotName,
					provider: payload.provider,
				}).session(session),
			]);

			if (existingJoin) {
				throw createError("You already joined this tournament.", 409);
			}

			if (existingPosition) {
				throw createError("This bracket position is already taken.", 409);
			}

			if (existingSlot) {
				throw createError("This slot is already chosen by another player.", 409);
			}

			try {
				await TournamentPlayer.create(
					[
						{
							tournament: tournament._id,
							userId,
							position: payload.position,
							teamKey:
								tournament.format === "3v3"
									? getTournamentTeamKey(
										payload.position,
										tournament.teamSize,
										getTeamCount(tournament)
									)
									: null,
							slotName: payload.slotName,
							slotDisplayName: payload.slotDisplayName,
							provider: payload.provider,
							slotImage: payload.slotImage,
						},
					],
					{ session }
				);
			} catch (error) {
				if (error?.code === 11000) {
					throw createError("This slot is already chosen by another player.", 409);
				}
				throw error;
			}

			const joinedCount = await TournamentPlayer.countDocuments({
				tournament: tournament._id,
			}).session(session);

			if (
				tournament.format === "1v1" &&
				joinedCount === tournament.maxPlayers &&
				!tournament.bracketGenerated
			) {
				const bracket = await generateBracketForTournament({ tournament, session });
				tournament.bracketGenerated = true;
				tournament.roundsCount = bracket.roundsCount;
				await tournament.save({ session });
			}

			responseData = {
				tournamentId: tournament._id,
				joinedCount,
				maxPlayers: tournament.maxPlayers,
				format: tournament.format,
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

			if (tournament.format === "1v1" && !tournament.bracketGenerated) {
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

const submitTeamResults = async ({ tournamentId, payload }) => {
	const results = Array.isArray(payload?.results) ? payload.results : null;
	if (!results || results.length === 0) {
		throw createError("results must be a non-empty array.", 400);
	}

	const session = await mongoose.startSession();
	try {
		let responseData = null;
		await session.withTransaction(async () => {
			const tournament = await ensureTournamentExists(tournamentId, session);
			if (tournament.format !== "3v3") {
				throw createError("Team results are only available for 3v3 tournaments.", 400);
			}
			if (tournament.status !== "live") {
				throw createError("3v3 tournament must be live before submitting results.", 400);
			}

			const players = await TournamentPlayer.find({ tournament: tournament._id })
				.sort({ position: 1 })
				.session(session);

			if (players.length !== tournament.maxPlayers) {
				throw createError("Tournament must have all team members joined before scoring.", 400);
			}

			const playerMap = new Map(players.map((player) => [String(player._id), player]));
			for (const result of results) {
				const multiplier = Number(result?.multiplier);
				const player = playerMap.get(String(result?.playerId || ""));
				if (!player) {
					throw createError("One or more submitted players do not belong to this tournament.", 400);
				}
				if (Number.isNaN(multiplier) || multiplier < 0) {
					throw createError("All multipliers must be non-negative numbers.", 400);
				}
				player.multiplier = multiplier;
				await player.save({ session });
			}

			const refreshedPlayers = await TournamentPlayer.find({ tournament: tournament._id })
				.sort({ position: 1 })
				.session(session);

			if (refreshedPlayers.some((player) => player.multiplier == null)) {
				throw createError(
					`All ${tournament.maxPlayers} team members need a multiplier before results can finalize.`,
					400
				);
			}

			const teamKeys = buildTeamKeys(getTeamCount(tournament));
			const teamResults = teamKeys.map((teamKey) => {
				const teamPlayers = refreshedPlayers.filter((player) => player.teamKey === teamKey);
				const sortedByMultiplier = [...teamPlayers].sort(
					(a, b) => Number(b.multiplier || 0) - Number(a.multiplier || 0)
				);
				return {
					teamKey,
					teamName: mapTeamName(tournament, teamKey),
					totalMultiplier: teamPlayers.reduce(
						(sum, player) => sum + Number(player.multiplier || 0),
						0
					),
					highestMultiplier: Number(sortedByMultiplier[0]?.multiplier || 0),
					highestMultiplierPlayerId: sortedByMultiplier[0]?._id || null,
				};
			});

			const sortedByTotal = [...teamResults].sort(
				(a, b) => b.totalMultiplier - a.totalMultiplier
			);
			const highestTotalTeam = sortedByTotal[0];
			const lowestTotalTeam = sortedByTotal[sortedByTotal.length - 1];
			const overallHighestMultiplier = Math.max(
				...teamResults.map((team) => team.highestMultiplier)
			);

			const stealTriggered =
				lowestTotalTeam.highestMultiplier === overallHighestMultiplier &&
				lowestTotalTeam.teamKey !== highestTotalTeam.teamKey;
			const winningTeam = stealTriggered ? lowestTotalTeam : highestTotalTeam;

			tournament.teamResults = teamResults;
			tournament.stealTriggered = stealTriggered;
			tournament.winningTeamName = winningTeam.teamName;
			tournament.winningReason = stealTriggered
				? `${winningTeam.teamName} stole the prize by landing the highest multiplier of the day from the lowest team total.`
				: `${winningTeam.teamName} won with the highest collective multiplier.`;
			tournament.status = "finished";
			await tournament.save({ session });
			await moveTournamentToHistory({ tournament, session });

			responseData = {
				tournamentId: tournament._id,
				winningTeamName: tournament.winningTeamName,
				winningReason: tournament.winningReason,
				stealTriggered: tournament.stealTriggered,
				teamResults,
			};
		});

		return responseData;
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
	submitTeamResults,
	deleteTournament,
	listTournamentHistory,
	moveTournamentToHistory,
};
