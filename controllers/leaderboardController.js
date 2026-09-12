const axios = require("axios");

const LEADERBOARD_DISCLOSURE =
  "Leaderboard wager amounts may differ from your statistics on Roobet, depending on the games you are playing:\n" +
  "- Games with RTP of 97% or lower → 100% of wager is counted\n" +
  "- Games with RTP between 97.01% and 98.99% → 50% of wager is counted\n" +
  "- Games with RTP of 99% and over → 10% of wager is counted";

const BASE_PARAMS = {
  userId: process.env.USER_ID,
  categories: "slots,provably fair",
};

// Helper for current leaderboard normalization at midnight UTC.
function getNoonUTC(dateStr) {
  return new Date(dateStr + "T00:00:00.000Z").toISOString();
}

// Helper for previous leaderboard normalization at noon UTC.
function getNoonUTCPrevious(dateStr) {
  return new Date(dateStr + "T12:00:00.000Z").toISOString();
}

async function fetchLeaderboardData(params) {
  const response = await axios.get(`${process.env.API_BASE_URL}/affiliate/v2/stats`, {
    params,
    headers: {
      Authorization: `Bearer ${process.env.ROOBET_API_KEY}`,
    },
  });

  return response.data
    .map((player) => ({
      uid: player.uid,
      username: player.username,
      wagered: Number(player.wagered || 0),
      weightedWagered: Number(player.weightedWagered || 0),
      favoriteGameId: player.favoriteGameId,
      favoriteGameTitle: player.favoriteGameTitle,
      rankLevelImage: player.rankLevelImage,
      highestMultiplier: player.highestMultiplier,
    }))
    .sort((a, b) => b.wagered - a.wagered)
    .map((player, index) => ({
      ...player,
      rankLevel: index + 1,
    }));
}

const leaderboardController = {
  // Get full leaderboard with optional query params
  getLeaderboard: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const params = { ...BASE_PARAMS };

      if (startDate) params.startDate = getNoonUTC(startDate);
      if (endDate) params.endDate = getNoonUTC(endDate);

      const processedData = await fetchLeaderboardData(params);

      res.json({
        disclosure: LEADERBOARD_DISCLOSURE,
        data: processedData,
      });
    } catch (error) {
      console.error("Error fetching leaderboard data:", error.message);
      res.status(500).json({
        error: "Failed to fetch leaderboard data",
        details: error.response?.data || error.message,
      });
    }
  },

  // Get leaderboard by date range (via route params)
  getLeaderboardByDate: async (req, res) => {
    try {
      const { startDate, endDate } = req.params;

      const params = { ...BASE_PARAMS };

      if (startDate) params.startDate = getNoonUTC(startDate);
      if (endDate) params.endDate = getNoonUTC(endDate);

      const processedData = await fetchLeaderboardData(params);

      res.json({
        disclosure: LEADERBOARD_DISCLOSURE,
        data: processedData,
      });
    } catch (error) {
      console.error("Error fetching leaderboard data:", error.message);
      res.status(500).json({
        error: "Failed to fetch leaderboard data",
        details: error.response?.data || error.message,
      });
    }
  },

  // Get previous leaderboard with optional query params (uses noon UTC normalization)
  getPreviousLeaderboard: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const params = { ...BASE_PARAMS };

      if (startDate) params.startDate = getNoonUTCPrevious(startDate);
      if (endDate) params.endDate = getNoonUTCPrevious(endDate);

      const processedData = await fetchLeaderboardData(params);

      res.json({
        disclosure: LEADERBOARD_DISCLOSURE,
        data: processedData,
      });
    } catch (error) {
      console.error("Error fetching leaderboard data:", error.message);
      res.status(500).json({
        error: "Failed to fetch leaderboard data",
        details: error.response?.data || error.message,
      });
    }
  },
};

module.exports = leaderboardController;