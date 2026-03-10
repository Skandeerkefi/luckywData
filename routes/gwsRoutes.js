const express = require("express");
const {
	createGWS,
	joinGWS,
	updateGWS,
	drawWinner,
	getAllGWS,
	getWagerDebugList,
	getGwsPlayers,
} = require("../controllers/gwsController");

const { verifyToken, isAdmin } = require("../middleware/auth");

const router = express.Router();

router.get("/", getAllGWS);
router.get("/wager-debug", getWagerDebugList);
router.get("/:id/players", verifyToken, isAdmin, getGwsPlayers);
router.post("/", verifyToken, isAdmin, createGWS);
router.post("/:id/join", verifyToken, joinGWS);
router.patch("/:id", verifyToken, isAdmin, updateGWS);
router.post("/:id/draw", verifyToken, isAdmin, drawWinner);

module.exports = router;
