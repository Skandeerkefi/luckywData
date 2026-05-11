const express = require("express");
const router = express.Router();
const leaderboardController = require("../controllers/leaderboardController.js");
const leaderboardConfigController = require("../controllers/leaderboardConfigController.js");
const { verifyToken, isAdmin } = require("../middleware/auth");

// Get leaderboard with optional date range
router.get("/", leaderboardController.getLeaderboard);

// Get previous leaderboard with optional date range (uses noon UTC normalization)
router.get("/previous", leaderboardController.getPreviousLeaderboard);

router.get("/config", leaderboardConfigController.getLeaderboardConfig);
router.put(
	"/config",
	verifyToken,
	isAdmin,
	leaderboardConfigController.saveLeaderboardConfig
);

// Get leaderboard for a specific date range
router.get("/:startDate/:endDate", leaderboardController.getLeaderboardByDate);

module.exports = router;
