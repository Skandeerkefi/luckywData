const isNonEmptyString = (value) =>
	typeof value === "string" && value.trim().length > 0;

const validateCreateTournamentPayload = (payload) => {
	const { name, slotGameName, prizeAmount, maxPlayers, startDate } = payload;

	if (!isNonEmptyString(name)) {
		return "Tournament name is required.";
	}

	if (!isNonEmptyString(slotGameName)) {
		return "slotGameName is required.";
	}

	if (typeof prizeAmount !== "number" || Number.isNaN(prizeAmount) || prizeAmount < 0) {
		return "prizeAmount must be a non-negative number.";
	}

	if (![8, 16].includes(maxPlayers)) {
		return "maxPlayers must be 8 or 16.";
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
