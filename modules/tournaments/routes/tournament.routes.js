const express = require("express");
const {
	createTournament,
	listTournaments,
	getTournamentById,
	joinTournament,
	startTournament,
	deleteTournament,
	listTournamentHistory,
} = require("../controllers/tournament.controller");
const { verifyToken, isAdmin } = require("../../../middleware/auth");

const router = express.Router();

router.get("/history", listTournamentHistory);
router.get("/", listTournaments);
router.get("/:id", getTournamentById);

router.post("/", verifyToken, isAdmin, createTournament);
router.patch("/:id/start", verifyToken, isAdmin, startTournament);
router.delete("/:id", verifyToken, isAdmin, deleteTournament);

router.post("/:id/join", verifyToken, joinTournament);

module.exports = router;
