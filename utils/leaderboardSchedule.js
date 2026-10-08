// Timezone-aware scheduler for the bi-weekly Roobet leaderboard.
//
// A cycle = CYCLE_DAYS of live wagers followed by a configurable cooldown.
// Cycle boundaries fall on ANCHOR_DATE + k * period, all at the configured
// resetTime in the configured timezone (default: 00:00:00 UTC).
//
// Phase model:
//   active   -> now < statsEndAt  (wagers still count, leaderboard is live)
//   cooldown -> statsEndAt <= now < resetAt (stats are final, still displayed)
//   upcoming -> now < startAt (before the very first cycle)

const DAY_MS = 86400000;

const ANCHOR_DATE_DEFAULT = "2026-10-08"; // first cycle start date (in the schedule timezone)
const CYCLE_DAYS = 15;

const DEFAULT_SCHEDULE = {
	resetTime: "00:00:00",
	timezone: "UTC",
	cooldownHours: 24,
};

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

const isKnownTimezone = (timezone) => {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: String(timezone).trim() });
		return true;
	} catch {
		return false;
	}
};

// Offset of `timezone` at a given instant, in ms (local = utc + offset).
const tzOffsetMsAt = (ms, timezone) => {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour12: false,
	}).formatToParts(new Date(ms));

	const grab = (type) => Number(parts.find((p) => p.type === type)?.value ?? 0);
	const wallAsUtc = Date.UTC(
		grab("year"),
		grab("month") - 1,
		grab("day"),
		grab("hour") % 24,
		grab("minute"),
		grab("second")
	);
	return wallAsUtc - ms;
};

// "YYYY-MM-DD" + "HH:MM:SS" in `timezone` -> UTC ms (iterative, DST-safe).
const zonedDateAtTimeToUtc = (dateStr, timeStr, timezone) => {
	const guess = Date.parse(`${dateStr}T${timeStr}Z`);
	let offset = tzOffsetMsAt(guess, timezone);
	let candidate = guess - offset;
	for (let i = 0; i < 2; i += 1) {
		const next = tzOffsetMsAt(candidate, timezone);
		if (next === offset) break;
		offset = next;
		candidate = guess - offset;
	}
	return candidate;
};

// UTC ms -> "YYYY-MM-DD" as seen in the timezone.
const zonedDateOf = (ms, timezone) => {
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).formatToParts(new Date(ms));

	const grab = (type) => parts.find((p) => p.type === type)?.value ?? "00";
	return `${grab("year")}-${grab("month")}-${grab("day")}`;
};

const normalizeSchedule = (input) => {
	const source = input && typeof input === "object" ? input : {};

	let timezone =
		String(source.timezone ?? DEFAULT_SCHEDULE.timezone).trim() ||
		DEFAULT_SCHEDULE.timezone;
	if (!isKnownTimezone(timezone)) timezone = DEFAULT_SCHEDULE.timezone;

	let resetTime = String(source.resetTime ?? DEFAULT_SCHEDULE.resetTime).trim();
	if (!TIME_RE.test(resetTime)) resetTime = DEFAULT_SCHEDULE.resetTime;
	if (resetTime.length === 5) resetTime = `${resetTime}:00`; // accept "HH:MM"

	let cooldownHours = Number(source.cooldownHours ?? DEFAULT_SCHEDULE.cooldownHours);
	if (!Number.isFinite(cooldownHours) || cooldownHours < 0) {
		cooldownHours = DEFAULT_SCHEDULE.cooldownHours;
	}
	cooldownHours = Math.min(Math.round(cooldownHours * 10) / 10, 336); // 2-week cap

	let anchorDate = String(source.anchorDate ?? ANCHOR_DATE_DEFAULT).trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate)) anchorDate = ANCHOR_DATE_DEFAULT;

	let startDate = String(source.startDate ?? "").trim();
	if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) startDate = "";

	let endDate = String(source.endDate ?? "").trim();
	if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) endDate = "";

	return { resetTime, timezone, cooldownHours, anchorDate, startDate, endDate };
};

// Compute the current + previous leaderboard windows for a schedule.
const computeLeaderboardWindows = (rawSchedule, nowMs = Date.now()) => {
	const schedule = normalizeSchedule(rawSchedule);
	const periodMs =
		CYCLE_DAYS * DAY_MS + schedule.cooldownHours * 3600 * 1000;
	const anchorMs = zonedDateAtTimeToUtc(
		schedule.anchorDate,
		schedule.resetTime,
		schedule.timezone
	);

	// Admin-override: explicit start/end dates take full control of the current cycle.
	let cycleStartMs;
	let cycleDurationMs = CYCLE_DAYS * DAY_MS;
	if (schedule.startDate) {
		cycleStartMs = zonedDateAtTimeToUtc(schedule.startDate, schedule.resetTime, schedule.timezone);
	} else {
		const index = Math.max(0, Math.floor((nowMs - anchorMs) / periodMs));
		cycleStartMs = anchorMs + index * periodMs;
	}
	if (schedule.endDate) {
		cycleDurationMs = zonedDateAtTimeToUtc(schedule.endDate, "23:59:59", schedule.timezone) - cycleStartMs + DAY_MS;
	}

	const buildWindow = (startMs, statsEndMs, resetMs) => {
		const phase =
			nowMs < startMs ? "upcoming" : nowMs < statsEndMs ? "active" : "cooldown";
		return {
			// Date-only labels in the schedule timezone (display only).
			startDate: zonedDateOf(startMs, schedule.timezone),
			endDate: zonedDateOf(statsEndMs - 1, schedule.timezone),
			// Exact UTC instants (API queries + countdowns).
			startAt: new Date(startMs).toISOString(),
			statsEndAt: new Date(statsEndMs).toISOString(),
			resetAt: new Date(resetMs).toISOString(),
			phase,
		};
	};

	return {
		current: buildWindow(
			cycleStartMs,
			cycleStartMs + cycleDurationMs,
			cycleStartMs + periodMs
		),
		previous: buildWindow(
			cycleStartMs - periodMs,
			cycleStartMs - periodMs + CYCLE_DAYS * DAY_MS,
			cycleStartMs
		),
		schedule: { ...schedule, anchor: ANCHOR_DATE_DEFAULT, cycleDays: CYCLE_DAYS },
	};
};

module.exports = {
	DAY_MS,
	ANCHOR_DATE_DEFAULT,
	CYCLE_DAYS,
	DEFAULT_SCHEDULE,
	normalizeSchedule,
	computeLeaderboardWindows,
	zonedDateAtTimeToUtc,
	zonedDateOf,
};
