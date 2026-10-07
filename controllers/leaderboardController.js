const axios = require("axios");

const LEADERBOARD_DISCLOSURE =
  "Leaderboard wager amounts may differ from your statistics on Roobet, depending on the games you are playing:\n" +
  "- Games with RTP of 97% or lower → 100% of wager is counted\n" +
  "- Games with RTP between 97.01% and 98.99% → 50% of wager is counted\n" +
  "- Games with RTP of 99% and over → 10% of wager is counted";

const BASE_PARAMS = {
  userId: process.env.USER_ID,
  categories: "slots,provably fair",
  // Exclude housegames:dice from every player's wagered totals via the API.
  // The '-' prefix tells Roobot to omit those wagers without removing the player.
  gameIdentifiers: "-housegames:dice",
};

// Date-only "YYYY-MM-DD" params normalize to UTC day boundaries. Full ISO
// datetimes (length > 10) pass through untouched, so clients can query the
// exact scheduled window ([startAt, statsEndAt]) instead of day approximations.
function toStartInstant(dateStr) {
  return dateStr.length > 10 ? dateStr : `${dateStr}T00:00:00.000Z`;
}

function toEndInstant(dateStr) {
  // End-of-day so the last day of a period is included in the stats.
  return dateStr.length > 10 ? dateStr : `${dateStr}T23:59:59.999Z`;
}

// Legacy "previous" leaderboard normalization at noon UTC.
function toPreviousInstant(dateStr) {
  return dateStr.length > 10 ? dateStr : `${dateStr}T12:00:00.000Z`;
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

      if (startDate) params.startDate = toStartInstant(startDate);
      if (endDate) params.endDate = toEndInstant(endDate);

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

      if (startDate) params.startDate = toStartInstant(startDate);
      if (endDate) params.endDate = toEndInstant(endDate);

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

      if (startDate) params.startDate = toPreviousInstant(startDate);
      if (endDate) params.endDate = toPreviousInstant(endDate);

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