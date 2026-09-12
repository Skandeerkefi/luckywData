const axios = require("axios");

const DEFAULT_ROOBET_BASE_URL = "https://roobetconnect.com";

// Bi-weekly (15-day) Roobet leaderboard — auto-rotates every 15 days from 09/08/2026
const getCurrentLeaderboardPeriod = () => {
	const now = new Date();
	const nowMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
	const cycleStart = new Date(Date.UTC(2026, 8, 8)); // 09/08/2026
	const cycleLength = 15 * 86400000;

	const diff = nowMs - cycleStart.getTime();
	const cycleNum = Math.floor(diff / cycleLength);
	const start = new Date(cycleStart.getTime() + cycleNum * cycleLength);
	const end = new Date(start.getTime() + (15 - 1) * 86400000);

	return {
		startDate: start.toISOString(),
		endDate: end.toISOString(),
	};
};

const getGwsFixedBiWeeklyPeriod = getCurrentLeaderboardPeriod;

exports.getGwsFixedBiWeeklyPeriod = getGwsFixedBiWeeklyPeriod;

const getRoobetBaseUrl = () => {
	const configured = String(process.env.API_BASE_URL || "").trim();
	const base = configured || DEFAULT_ROOBET_BASE_URL;
	return base.replace(/\/+$/, "");
};

const fetchRoobetAffiliateStats = async ({
	userId,
	startDate,
	endDate,
	gameIdentifiers,
	categories,
	providers,
	sortBy,
} = {}) => {
	const effectiveUserId = userId || process.env.USER_ID;
	if (!effectiveUserId) {
		throw new Error("Missing USER_ID for Roobet affiliate stats");
	}

	const params = { userId: effectiveUserId };
	if (startDate) params.startDate = startDate;
	if (endDate) params.endDate = endDate;
	if (gameIdentifiers) params.gameIdentifiers = gameIdentifiers;
	if (categories) params.categories = categories;
	if (providers) params.providers = providers;
	if (sortBy) params.sortBy = sortBy;

	const response = await axios.get(`${getRoobetBaseUrl()}/affiliate/v2/stats`, {
		params,
		headers: {
			Authorization: `Bearer ${process.env.ROOBET_API_KEY}`,
		},
		timeout: 10000,
	});

	if (!Array.isArray(response.data)) {
		throw new Error("Invalid Roobet affiliate stats response");
	}

	return response.data;
};

exports.fetchRoobetAffiliateStats = fetchRoobetAffiliateStats;

const fetchRoobetAffiliateStatsFixedMonthly = async () => {
	const { startDate, endDate } = getCurrentLeaderboardPeriod();
	return fetchRoobetAffiliateStats({
		startDate,
		endDate,
		categories: "slots,provably fair",
		sortBy: "wagered",
	});
};

exports.fetchRoobetAffiliateStatsFixedMonthly =
	fetchRoobetAffiliateStatsFixedMonthly;

exports.getRoobetAffiliates = async (req, res) => {
	const {
		userId,
		startDate,
		endDate,
		gameIdentifiers,
		categories,
		providers,
		sortBy,
	} = req.query;

	try {
		const data = await fetchRoobetAffiliateStats({
			userId,
			startDate,
			endDate,
			gameIdentifiers,
			categories,
			providers,
			sortBy,
		});
		res.json(data);
	} catch (error) {
		console.error("Roobet API error:", error.message);
		res.status(500).json({ error: "Failed to fetch Roobet affiliate stats" });
	}
};
