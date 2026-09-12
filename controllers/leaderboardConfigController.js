const { LeaderboardConfig } = require("../models/LeaderboardConfig");

const CONFIG_KEY = "roobet";

// Bi-weekly (15-day) Roobet leaderboard prize split — $3,000 total across top 15
const DEFAULT_PRIZE_SPLIT = [
	{ rank: 1, amount: 600 },
	{ rank: 2, amount: 450 },
	{ rank: 3, amount: 350 },
	{ rank: 4, amount: 275 },
	{ rank: 5, amount: 225 },
	{ rank: 6, amount: 200 },
	{ rank: 7, amount: 175 },
	{ rank: 8, amount: 150 },
	{ rank: 9, amount: 125 },
	{ rank: 10, amount: 100 },
	{ rank: 11, amount: 90 },
	{ rank: 12, amount: 80 },
	{ rank: 13, amount: 70 },
	{ rank: 14, amount: 65 },
	{ rank: 15, amount: 45 },
];

const CYCLE_START_DATE = new Date(Date.UTC(2026, 8, 8)); // 09/08/2026
const CYCLE_LENGTH_DAYS = 15;

const toDateOnlyUtc = (date) => date.toISOString().split("T")[0];

const buildDefaultCurrentWindow = () => {
	const now = new Date();
	const nowMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
	const diff = nowMs - CYCLE_START_DATE.getTime();
	const cycleNum = Math.floor(diff / (CYCLE_LENGTH_DAYS * 86400000));
	const start = new Date(CYCLE_START_DATE.getTime() + cycleNum * CYCLE_LENGTH_DAYS * 86400000);
	const end = new Date(start.getTime() + (CYCLE_LENGTH_DAYS - 1) * 86400000);

	return {
		startDate: toDateOnlyUtc(start),
		endDate: toDateOnlyUtc(end),
		prizeSplit: DEFAULT_PRIZE_SPLIT,
	};
};

const buildDefaultPreviousWindow = () => {
	const current = buildDefaultCurrentWindow();
	const currentStart = new Date(`${current.startDate}T00:00:00.000Z`);
	const previousEnd = new Date(currentStart);
	previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
	const previousStart = new Date(previousEnd);
	previousStart.setUTCDate(previousStart.getUTCDate() - CYCLE_LENGTH_DAYS + 1);

	return {
		startDate: toDateOnlyUtc(previousStart),
		endDate: toDateOnlyUtc(previousEnd),
		prizeSplit: DEFAULT_PRIZE_SPLIT.map((entry) => ({ ...entry })),
	};
};

const normalizePrizeSplit = (prizeSplit) => {
	if (!Array.isArray(prizeSplit) || prizeSplit.length === 0) {
		return DEFAULT_PRIZE_SPLIT.map((entry) => ({ ...entry }));
	}

	return prizeSplit
		.map((entry, index) => ({
			rank: Number(entry?.rank ?? index + 1),
			amount: Number(entry?.amount ?? 0),
		}))
		.filter((entry) => Number.isFinite(entry.rank) && entry.rank > 0)
		.sort((a, b) => a.rank - b.rank);
};

const normalizeWindow = (windowValue) => {
	if (!windowValue?.startDate || !windowValue?.endDate) {
		throw new Error("startDate and endDate are required");
	}

	return {
		startDate: String(windowValue.startDate).slice(0, 10),
		endDate: String(windowValue.endDate).slice(0, 10),
		prizeSplit: normalizePrizeSplit(windowValue.prizeSplit),
	};
};

const mergeWindow = (existingWindow, windowValue) => {
	if (!windowValue) {
		return existingWindow || null;
	}

	const normalized = normalizeWindow({
		startDate: windowValue.startDate,
		endDate: windowValue.endDate,
		prizeSplit: windowValue.prizeSplit ?? existingWindow?.prizeSplit,
	});

	return normalized;
};

const serializeConfig = (doc) => ({
	current: doc?.current || buildDefaultCurrentWindow(),
	previous: doc?.previous || buildDefaultPreviousWindow(),
	updatedAt: doc?.updatedAt || null,
});

exports.getLeaderboardConfig = async (req, res) => {
	try {
		const doc = await LeaderboardConfig.findOne({ key: CONFIG_KEY });
		res.json(serializeConfig(doc));
	} catch (error) {
		console.error("Failed to fetch leaderboard config:", error.message);
		res.status(500).json({ error: "Failed to fetch leaderboard config" });
	}
};

exports.saveLeaderboardConfig = async (req, res) => {
	try {
		const { current, previous, archiveCurrent } = req.body || {};

		let doc = await LeaderboardConfig.findOne({ key: CONFIG_KEY });
		if (!doc) {
			doc = new LeaderboardConfig({ key: CONFIG_KEY });
		}

		const normalizedCurrent = normalizeWindow(current);
		const normalizedPrevious = mergeWindow(
			doc.previous,
			previous || (archiveCurrent ? doc.current : undefined)
		);

		doc.current = normalizedCurrent;
		if (normalizedPrevious) {
			doc.previous = normalizedPrevious;
		}
		await doc.save();

		res.json({
			message: "Leaderboard config saved",
			...serializeConfig(doc),
		});
	} catch (error) {
		console.error("Failed to save leaderboard config:", error.message);
		res.status(400).json({
			error: error.message || "Failed to save leaderboard config",
		});
	}
};