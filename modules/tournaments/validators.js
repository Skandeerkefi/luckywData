const isNonEmptyString = (value) =>
	typeof value === "string" && value.trim().length > 0;

const TEAM_SIZE_3V3 = 3;
const MIN_3V3_TEAM_COUNT = 2;
const MAX_3V3_TEAM_COUNT = 12;

const validateCreateTournamentPayload = (payload) => {
	const { name, slotGameName, prizeAmount, maxPlayers, startDate, format, teamCount } = payload;
	const normalizedMaxPlayers = Number(maxPlayers);
	const normalizedTeamCount = Number(teamCount);
	const normalizedFormat =
		typeof format === "string" && format.trim().length > 0
			? format
			: Number.isInteger(normalizedTeamCount) && normalizedTeamCount > 0
				? "3v3"
				: Number.isInteger(normalizedMaxPlayers) &&
					normalizedMaxPlayers % TEAM_SIZE_3V3 === 0 &&
					normalizedMaxPlayers >= TEAM_SIZE_3V3 * MIN_3V3_TEAM_COUNT
					? "3v3"
				: "1v1";

	if (!isNonEmptyString(name)) {
		return "Tournament name is required.";
	}

	if (!isNonEmptyString(slotGameName)) {
		return "slotGameName is required.";
	}

	if (typeof prizeAmount !== "number" || Number.isNaN(prizeAmount) || prizeAmount < 0) {
		return "prizeAmount must be a non-negative number.";
	}

		if (!["1v1", "3v3"].includes(normalizedFormat)) {
		return "format must be 1v1 or 3v3.";
	}

	if (!Number.isInteger(normalizedMaxPlayers) || normalizedMaxPlayers <= 0) {
		return "maxPlayers must be a positive integer.";
	}

	if (normalizedFormat === "1v1" && ![8, 16].includes(normalizedMaxPlayers)) {
		return "maxPlayers must be 8 or 16 for 1v1 tournaments.";
	}

	if (normalizedFormat === "3v3") {
		const effectiveTeamCount =
			Number.isInteger(normalizedTeamCount) && normalizedTeamCount > 0
				? normalizedTeamCount
				: Math.floor(normalizedMaxPlayers / TEAM_SIZE_3V3);

		if (
			!Number.isInteger(effectiveTeamCount) ||
			effectiveTeamCount < MIN_3V3_TEAM_COUNT ||
			effectiveTeamCount > MAX_3V3_TEAM_COUNT
		) {
			return `teamCount must be between ${MIN_3V3_TEAM_COUNT} and ${MAX_3V3_TEAM_COUNT} for 3v3 tournaments.`;
		}

		const expectedPlayers = effectiveTeamCount * TEAM_SIZE_3V3;
		if (normalizedMaxPlayers !== expectedPlayers) {
			return `maxPlayers must equal teamCount * ${TEAM_SIZE_3V3} for 3v3 tournaments.`;
		}
	}

	const parsedStartDate = new Date(startDate);
	if (!startDate || Number.isNaN(parsedStartDate.getTime())) {
		return "startDate must be a valid date.";
	}

	return null;
};

const validateJoinPayload = (payload) => {
	const { position, slotName, slotDisplayName, provider, slotImage } = payload;

	if (!Number.isInteger(position) || position < 1) {
		return "position must be a positive integer.";
	}

	if (!isNonEmptyString(slotName)) {
		return "slotName is required.";
	}

	if (!isNonEmptyString(slotDisplayName)) {
		return "slotDisplayName is required.";
	}

	if (!isNonEmptyString(provider)) {
		return "provider is required.";
	}

	if (!isNonEmptyString(slotImage)) {
		return "slotImage is required.";
	}

	return null;
};

const validateMatchResultPayload = (payload) => {
	const { multiplier1, multiplier2 } = payload;

	if (typeof multiplier1 !== "number" || Number.isNaN(multiplier1) || multiplier1 < 0) {
		return "multiplier1 must be a non-negative number.";
	}

	if (typeof multiplier2 !== "number" || Number.isNaN(multiplier2) || multiplier2 < 0) {
		return "multiplier2 must be a non-negative number.";
	}

	if (multiplier1 === multiplier2) {
		return "Ties are not allowed. Multipliers must be different.";
	}

	return null;
};

module.exports = {
	validateCreateTournamentPayload,
	validateJoinPayload,
	validateMatchResultPayload,
};
