const { LeaderboardConfig } = require("../models/LeaderboardConfig");
const {
	DEFAULT_SCHEDULE,
	normalizeSchedule,
	computeLeaderboardWindows,
} = require("../utils/leaderboardSchedule");

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
	{ rank: 14, amount: 60 },
	{ rank: 15, amount: 50 },
];

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

const serializeConfig = (doc) => {
	// Windows are always computed fresh from the admin-configured schedule
	// (reset time + timezone + cooldown) so stale DB dates can never win.
	const schedule = normalizeSchedule(doc?.schedule ?? DEFAULT_SCHEDULE);
	const windows = computeLeaderboardWindows(schedule, Date.now());

	// Keep admin-customized prize splits from the DB.
	const currentPrizeSplit = normalizePrizeSplit(doc?.current?.prizeSplit);
	const previousPrizeSplit = normalizePrizeSplit(
		doc?.previous?.prizeSplit ?? doc?.current?.prizeSplit
	);

	return {
		current: { ...windows.current, prizeSplit: currentPrizeSplit },
		previous: doc?.previous?.startDate
			? { startDate: doc.previous.startDate, endDate: doc.previous.endDate, prizeSplit: previousPrizeSplit }
			: { ...windows.previous, prizeSplit: previousPrizeSplit },
		schedule: windows.schedule,
		updatedAt: doc?.updatedAt || null,
	};
};

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
		const { current, previous, archiveCurrent, schedule } = req.body || {};

		let doc = await LeaderboardConfig.findOne({ key: CONFIG_KEY });
		if (!doc) {
			doc = new LeaderboardConfig({ key: CONFIG_KEY });
		}

		// `current` is optional — when omitted the existing window is kept, so
		// admins can save just the schedule settings (reset time/timezone/cooldown).
		if (current) {
			doc.current = normalizeWindow(current);
		}

		const normalizedPrevious = mergeWindow(
			doc.previous,
			previous || (archiveCurrent ? doc.current : undefined)
		);

		if (normalizedPrevious) {
			doc.previous = normalizedPrevious;
		}

		// Admin may change the LB reset time / timezone / cooldown.
		if (schedule !== undefined) {
			doc.schedule = normalizeSchedule(schedule);
		} else if (!doc.schedule) {
			doc.schedule = normalizeSchedule(DEFAULT_SCHEDULE);
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