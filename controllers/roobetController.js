const axios = require("axios");

const DEFAULT_ROOBET_BASE_URL = "https://roobetconnect.com";
const GWS_FIXED_MONTHLY_START = "2026-03-10T00:00:00.000Z";
const GWS_FIXED_MONTHLY_END = "2026-04-10T23:59:59.999Z";

const getGwsFixedMonthlyPeriod = () => ({
	startDate: GWS_FIXED_MONTHLY_START,
	endDate: GWS_FIXED_MONTHLY_END,
});

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
	return fetchRoobetAffiliateStats({
		startDate: GWS_FIXED_MONTHLY_START,
		endDate: GWS_FIXED_MONTHLY_END,
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
