const tournamentService = require("../services/tournament.service");

const createTournament = async (req, res) => {
	try {
		const tournament = await tournamentService.createTournament({
			payload: req.body,
			adminUserId: req.user.id,
		});
		res.status(201).json({ message: "Tournament created.", tournament });
	} catch (error) {
		res
			.status(error.statusCode || 500)
			.json({ message: error.message || "Failed to create tournament." });
	}
};

const listTournaments = async (_req, res) => {
	try {
		const tournaments = await tournamentService.listTournaments();
		res.status(200).json({ data: tournaments });
	} catch (error) {
		res.status(500).json({ message: "Failed to fetch tournaments." });
	}
};

const getTournamentById = async (req, res) => {
	try {
		const data = await tournamentService.getTournamentById(req.params.id);
		res.status(200).json(data);
	} catch (error) {
		res
			.status(error.statusCode || 500)
			.json({ message: error.message || "Failed to fetch tournament." });
	}
};

const joinTournament = async (req, res) => {
	try {
		const result = await tournamentService.joinTournament({
			tournamentId: req.params.id,
			userId: req.user.id,
			userRole: req.user.role,
			payload: req.body,
		});
		res.status(200).json({ message: "Joined tournament.", ...result });
	} catch (error) {
		res
			.status(error.statusCode || 500)
			.json({ message: error.message || "Failed to join tournament." });
	}
};

const startTournament = async (req, res) => {
	try {
		const tournament = await tournamentService.startTournament(req.params.id);
		res.status(200).json({ message: "Tournament started.", tournament });
	} catch (error) {
		res
			.status(error.statusCode || 500)
			.json({ message: error.message || "Failed to start tournament." });
	}
};

const deleteTournament = async (req, res) => {
	try {
		await tournamentService.deleteTournament(req.params.id);
		res.status(200).json({ message: "Tournament deleted." });
	} catch (error) {
		res
			.status(error.statusCode || 500)
			.json({ message: error.message || "Failed to delete tournament." });
	}
};

const listTournamentHistory = async (_req, res) => {
	try {
		const history = await tournamentService.listTournamentHistory();
		res.status(200).json({ data: history });
	} catch (error) {
		res.status(500).json({ message: "Failed to fetch tournament history." });
	}
};

module.exports = {
	createTournament,
	listTournaments,
	getTournamentById,
	joinTournament,
	startTournament,
	deleteTournament,
	listTournamentHistory,
};
