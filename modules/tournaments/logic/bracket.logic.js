const { Match } = require("../models/Match");
const { TournamentPlayer } = require("../models/TournamentPlayer");

const ensurePowerOfTwo = (value) => {
	if (value <= 0 || (value & (value - 1)) !== 0) {
		throw new Error("maxPlayers must be a power of two.");
	}
};

const generateBracketForTournament = async ({ tournament, session }) => {
	ensurePowerOfTwo(tournament.maxPlayers);

	const players = await TournamentPlayer.find({ tournament: tournament._id })
		.sort({ position: 1 })
		.session(session);

	if (players.length !== tournament.maxPlayers) {
		throw new Error("Tournament must be full before bracket generation.");
	}

	const roundsCount = Math.log2(tournament.maxPlayers);
	const matchesByRound = [];

	for (let roundNumber = 1; roundNumber <= roundsCount; roundNumber += 1) {
		const matchesCount = tournament.maxPlayers / Math.pow(2, roundNumber);
		const roundMatches = [];

		for (let matchNumber = 1; matchNumber <= matchesCount; matchNumber += 1) {
			const match = await Match.create(
				[
					{
						tournament: tournament._id,
						roundNumber,
						matchNumber,
					},
				],
				{ session }
			);
			roundMatches.push(match[0]);
		}

		matchesByRound.push(roundMatches);
	}

	for (let roundIndex = 0; roundIndex < matchesByRound.length - 1; roundIndex += 1) {
		const currentRound = matchesByRound[roundIndex];
		const nextRound = matchesByRound[roundIndex + 1];

		for (let i = 0; i < currentRound.length; i += 1) {
			const nextMatch = nextRound[Math.floor(i / 2)];
			currentRound[i].nextMatchId = nextMatch._id;
			await currentRound[i].save({ session });
		}
	}

	const firstRound = matchesByRound[0];
	for (let i = 0; i < players.length; i += 2) {
		const match = firstRound[i / 2];
		match.player1 = players[i]._id;
		match.player2 = players[i + 1]._id;
		await match.save({ session });
	}

	return {
		roundsCount,
		matchesCreated: matchesByRound.flat().length,
	};
};

module.exports = {
	generateBracketForTournament,
};
