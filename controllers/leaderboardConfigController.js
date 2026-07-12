const { LeaderboardConfig } = require("../models/LeaderboardConfig");

const CONFIG_KEY = "roobet";

const DEFAULT_PRIZE_SPLIT = [
	{ rank: 1, amount: 800 },
	{ rank: 2, amount: 550 },
	{ rank: 3, amount: 325 },
	{ rank: 4, amount: 200 },
	{ rank: 5, amount: 150 },
	{ rank: 6, amount: 125 },
	{ rank: 7, amount: 125 },
	{ rank: 8, amount: 100 },
	{ rank: 9, amount: 75 },
	{ rank: 10, amount: 50 },
	{ rank: 11, amount: 50 },
	{ rank: 12, amount: 50 },
];

const toDateOnlyUtc = (date) => date.toISOString().split("T")[0];

const buildDefaultCurrentWindow = () => {
	const now = new Date();
	const year = now.getUTCFullYear();
	const month = now.getUTCMonth();
	const day = now.getUTCDate();

	const start =
		day >= 11
			? new Date(Date.UTC(year, month, 11, 0, 0, 0, 0))
			: new Date(Date.UTC(year, month - 1, 11, 0, 0, 0, 0));
	const end = new Date(start);
	end.setUTCMonth(end.getUTCMonth() + 1);

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
	previousStart.setUTCMonth(previousStart.getUTCMonth() - 1);

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