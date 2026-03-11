const axios = require("axios");

const DEFAULT_ROOBET_BASE_URL = "https://roobetconnect.com";

// Dynamically calculates the current leaderboard period (10th-to-10th, UTC noon)
const getCurrentLeaderboardPeriod = () => {
	const now = new Date();
	const year = now.getUTCFullYear();
	const month = now.getUTCMonth();
	const day = now.getUTCDate();

	let startYear = year;
	let startMonth = month;
	if (day < 10) {
		startMonth = month - 1;
		if (startMonth < 0) { startMonth = 11; startYear = year - 1; }
	}

	const start = new Date(Date.UTC(startYear, startMonth, 10, 12, 0, 0, 0));
	const end = new Date(Date.UTC(startYear, startMonth + 1, 10, 12, 0, 0, 0));

	return {
		startDate: start.toISOString(),
		endDate: end.toISOString(),
	};
};

const getGwsFixedMonthlyPeriod = getCurrentLeaderboardPeriod;

exports.getGwsFixedMonthlyPeriod = getGwsFixedMonthlyPeriod;

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
		gameIdentifiers: "-housegames:dice",
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
