const axios = require("axios");

// Helper function to get start of day in ISO format
function getStartOfDay(dateStr) {
  return new Date(dateStr + "T00:00:00.000Z").toISOString();
}

// Helper function to get end of day in ISO format
function getEndOfDay(dateStr) {
  return new Date(dateStr + "T23:59:59.999Z").toISOString();
}

function normalizeStartDate(value) {
  if (!value) return undefined;
  return value.includes("T") ? new Date(value).toISOString() : getStartOfDay(value);
}

function normalizeEndDate(value) {
  if (!value) return undefined;
  return value.includes("T") ? new Date(value).toISOString() : getEndOfDay(value);
}

function buildRoobetStatsParams({ startDate, endDate }) {
  const params = {
    userId: process.env.USER_ID,
    categories: "slots,provably fair",
    gameIdentifiers: "-housegames:dice",
    sortBy: "wagered",
  };

  const normalizedStart = normalizeStartDate(startDate);
  const normalizedEnd = normalizeEndDate(endDate);
  if (normalizedStart) params.startDate = normalizedStart;
  if (normalizedEnd) params.endDate = normalizedEnd;

  return params;
}

async function fetchRoobetStats(params) {
  const response = await axios.get(`${process.env.API_BASE_URL}/affiliate/v2/stats`, {
    params,
    headers: {
      Authorization: `Bearer ${process.env.ROOBET_API_KEY}`,
      "Content-Type": "application/json",
    },
  });

  return response.data;
}

function mapAndSortLeaderboardData(rows) {
  const processedData = rows
    .map((player) => ({
      uid: player.uid,
      username: player.username,
      wagered: player.wagered,
      weightedWagered: player.weightedWagered,
      favoriteGameId: player.favoriteGameId,
      favoriteGameTitle: player.favoriteGameTitle,
      rankLevel: player.rankLevel,
      rankLevelImage: player.rankLevelImage,
      highestMultiplier: player.highestMultiplier,
    }));

  processedData.sort((a, b) => b.weightedWagered - a.weightedWagered);
  return processedData;
}

const leaderboardController = {
  // Get full leaderboard with optional query params
  getLeaderboard: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const params = buildRoobetStatsParams({ startDate, endDate });
      const rows = await fetchRoobetStats(params);
      const processedData = mapAndSortLeaderboardData(rows);

      res.json({
        disclosure:
          "Your wagers on Roobet count toward the leaderboard with weighted rules to prevent abuse: RTP <= 97% contributes 100%, RTP > 97% contributes 50%, RTP >= 98% contributes 10%. Only Slots and Provably Fair (house games) count, and Dice is excluded.",
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

      const params = buildRoobetStatsParams({ startDate, endDate });
      const rows = await fetchRoobetStats(params);
      const processedData = mapAndSortLeaderboardData(rows);

      res.json({
        disclosure:
          "Your wagers on Roobet count toward the leaderboard with weighted rules to prevent abuse: RTP <= 97% contributes 100%, RTP > 97% contributes 50%, RTP >= 98% contributes 10%. Only Slots and Provably Fair (house games) count, and Dice is excluded.",
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
