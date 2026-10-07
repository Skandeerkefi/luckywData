const axios = require("axios");
const { LeaderboardConfig } = require("../models/LeaderboardConfig");
const {
	DEFAULT_SCHEDULE,
	normalizeSchedule,
	computeLeaderboardWindows,
} = require("../utils/leaderboardSchedule");

const DEFAULT_ROOBET_BASE_URL = "https://roobetconnect.com";

// Bi-weekly (15-day) Roobet leaderboard — boundaries follow the admin schedule
// (reset time + timezone + cooldown, default 00:00:00 UTC + 24h cooldown)
// anchored at 09/08/2026.
const getCurrentLeaderboardPeriod = async () => {
	let schedule = DEFAULT_SCHEDULE;
	try {
		const doc = await LeaderboardConfig.findOne({ key: "roobet" });
		schedule = normalizeSchedule(doc?.schedule ?? DEFAULT_SCHEDULE);
	} catch (error) {
		console.error(
			"Failed to load leaderboard schedule, using defaults:",
			error.message
		);
		schedule = DEFAULT_SCHEDULE;
	}

	const windows = computeLeaderboardWindows(schedule, Date.now());
	return {
		startDate: windows.current.startAt,
		endDate: windows.current.statsEndAt,
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
	const { startDate, endDate } = await getCurrentLeaderboardPeriod();
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
