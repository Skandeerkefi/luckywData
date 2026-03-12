const axios = require("axios");

const LEADERBOARD_DISCLOSURE =
  "Your wagers on Roobet will count towards the leaderboard at the following weights based on the games you are playing. This helps prevent leaderboard abuse:\n" +
  "- Games with an RTP of 97% or less will contribute 100% of the amount wagered to the leaderboard.\n" +
  "- Games with an RTP above 97% will contribute 50% of the amount wagered to the leaderboard.\n" +
  "- Games with an RTP of 98% and above will contribute 10% of the amount wagered to the leaderboard.\n" +
  "- Only Slots and Housegames count (Dice excluded).\n" +
  "- Only the categories of slots and provably fair are included.";

const BASE_PARAMS = {
  userId: process.env.USER_ID,
  categories: "slots,provably fair",
  gameIdentifiers: "-housegames:dice",
};

// Helper function to normalize date to noon UTC (T12:00:00.000Z)
function getNoonUTC(dateStr) {
  return new Date(dateStr + "T10:00:00.000Z").toISOString();
}

const leaderboardController = {
  // Get full leaderboard with optional query params
  getLeaderboard: async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const params = { ...BASE_PARAMS };

      if (startDate) params.startDate = getNoonUTC(startDate);
      if (endDate) params.endDate = getNoonUTC(endDate);

      const response = await axios.get(
        `${process.env.API_BASE_URL}/affiliate/v2/stats`,
        {
          params,
          headers: {
            Authorization: `Bearer ${process.env.ROOBET_API_KEY}`,
          },
        }
      );

      const processedData = response.data
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
        .sort((a, b) => b.weightedWagered - a.weightedWagered)
        .map((player, index) => ({
          ...player,
          rankLevel: index + 1,
        }));

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

      const response = await axios.get(
        `${process.env.API_BASE_URL}/affiliate/v2/stats`,
        {
          params,
          headers: {
            Authorization: `Bearer ${process.env.ROOBET_API_KEY}`,
          },
        }
      );

      const processedData = response.data
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
        .sort((a, b) => b.weightedWagered - a.weightedWagered)
        .map((player, index) => ({
          ...player,
          rankLevel: index + 1,
        }));

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