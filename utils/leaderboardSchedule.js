// Timezone-aware scheduler for the Roobet leaderboard.
// A cycle = CYCLE_DAYS of live wagers followed by a configurable cooldown.
// Cycle boundaries fall on ANCHOR_DATE + k * period, all at the configured
// resetTime in the configured timezone (default: 00:00:00 UTC).

const DAY_MS = 86400000;
const ANCHOR_DATE_DEFAULT = "2026-10-08";
const CYCLE_DAYS_DEFAULT = 15;

const DEFAULT_SCHEDULE = { resetTime: "00:00:00", timezone: "UTC", cooldownHours: 24, cycleDays: 15 };

const TIME_RE = /^(?:[01][0-9]|2[0-3]):[0-5][0-9](?::[0-5][0-9])?$/;

const isKnownTimezone = (timezone) => {
	try { new Intl.DateTimeFormat("en-US", { timeZone: String(timezone).trim() }); return true; }
	catch { return false; }
};

const tzOffsetMsAt = (ms, timezone) => {
	const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", year: "numeric", month: "2-digit", day: "2-digit", hour12: false }).formatToParts(new Date(ms));
	const grab = (type) => Number(parts.find((p) => p.type === type)?.value ?? 0);
	return Date.UTC(grab("year"), grab("month") - 1, grab("day"), grab("hour") % 24, grab("minute"), grab("second")) - ms;
};

const zonedDateAtTimeToUtc = (dateStr, timeStr, timezone) => {
	const guess = Date.parse(`${dateStr}T${timeStr}Z`);
	let offset = tzOffsetMsAt(guess, timezone);
	let candidate = guess - offset;
	for (let i = 0; i < 2; i++) { const next = tzOffsetMsAt(candidate, timezone); if (next === offset) break; offset = next; candidate = guess - offset; }
	return candidate;
};

const zonedDateOf = (ms, timezone) => {
	const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(ms));
	const grab = (type) => parts.find((p) => p.type === type)?.value ?? "00";
	return `${grab("year")}-${grab("month")}-${grab("day")}`;
};

const normalizeSchedule = (input) => {
	const source = input && typeof input === "object" ? input : {};
	let timezone = String(source.timezone ?? DEFAULT_SCHEDULE.timezone).trim() || DEFAULT_SCHEDULE.timezone;
	if (!isKnownTimezone(timezone)) timezone = DEFAULT_SCHEDULE.timezone;
	let resetTime = String(source.resetTime ?? DEFAULT_SCHEDULE.resetTime).trim();
	if (!TIME_RE.test(resetTime)) resetTime = DEFAULT_SCHEDULE.resetTime;
	if (resetTime.length === 5) resetTime = `${resetTime}:00`;
	let cooldownHours = Number(source.cooldownHours ?? DEFAULT_SCHEDULE.cooldownHours);
	if (!Number.isFinite(cooldownHours) || cooldownHours < 0) cooldownHours = DEFAULT_SCHEDULE.cooldownHours;
	cooldownHours = Math.min(Math.round(cooldownHours * 10) / 10, 336);
	let cycleDays = Number(source.cycleDays ?? DEFAULT_SCHEDULE.cycleDays);
	if (!Number.isFinite(cycleDays) || cycleDays < 1) cycleDays = DEFAULT_SCHEDULE.cycleDays;
	cycleDays = Math.min(Math.max(Math.round(cycleDays), 1), 60);
	let anchorDate = String(source.anchorDate ?? ANCHOR_DATE_DEFAULT).trim();
	if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate)) anchorDate = ANCHOR_DATE_DEFAULT;
	let startDate = String(source.startDate ?? "").trim();
	if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) startDate = "";
	let endDate = String(source.endDate ?? "").trim();
	if (endDate && !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) endDate = "";
	return { resetTime, timezone, cooldownHours, cycleDays, anchorDate, startDate, endDate };
};

const computeLeaderboardWindows = (rawSchedule, nowMs = Date.now()) => {
	const schedule = normalizeSchedule(rawSchedule);
	const periodMs = schedule.cycleDays * DAY_MS + schedule.cooldownHours * 3600 * 1000;
	const anchorMs = zonedDateAtTimeToUtc(schedule.anchorDate, schedule.resetTime, schedule.timezone);
	let cycleStartMs;
	let cycleDurationMs = schedule.cycleDays * DAY_MS;
	if (schedule.startDate) cycleStartMs = zonedDateAtTimeToUtc(schedule.startDate, schedule.resetTime, schedule.timezone);
	else { const index = Math.max(0, Math.floor((nowMs - anchorMs) / periodMs)); cycleStartMs = anchorMs + index * periodMs; }
	if (schedule.endDate) cycleDurationMs = zonedDateAtTimeToUtc(schedule.endDate, "23:59:59", schedule.timezone) - cycleStartMs + DAY_MS;
	const buildWindow = (startMs, statsEndMs, resetMs) => ({
		startDate: zonedDateOf(startMs, schedule.timezone),
		endDate: zonedDateOf(statsEndMs - 1, schedule.timezone),
		startAt: new Date(startMs).toISOString(),
		statsEndAt: new Date(statsEndMs).toISOString(),
		resetAt: new Date(resetMs).toISOString(),
		phase: nowMs < startMs ? "upcoming" : nowMs < statsEndMs ? "active" : "cooldown",
	});
	return {
		current: buildWindow(cycleStartMs, cycleStartMs + cycleDurationMs, cycleStartMs + periodMs),
		previous: buildWindow(cycleStartMs - periodMs, cycleStartMs - periodMs + schedule.cycleDays * DAY_MS, cycleStartMs),
		schedule: { ...schedule, anchor: ANCHOR_DATE_DEFAULT, cycleDays: schedule.cycleDays },
	};
};

module.exports = { DAY_MS, ANCHOR_DATE_DEFAULT, CYCLE_DAYS_DEFAULT, DEFAULT_SCHEDULE, normalizeSchedule, computeLeaderboardWindows, zonedDateAtTimeToUtc, zonedDateOf };
