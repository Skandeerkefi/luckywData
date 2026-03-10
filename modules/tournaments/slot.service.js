const axios = require("axios");

const SLOT_CACHE_TTL_MS = 5 * 60 * 1000;
const SLOT_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const SLOT_RATE_LIMIT_MAX = 60;

const slotSearchCache = new Map();
const rateLimitBuckets = new Map();

const normalize = (value) => String(value || "").trim().toLowerCase();
const normalizeLoose = (value) => normalize(value).replace(/[\s_-]+/g, "");

const pickSlotFields = (slot) => ({
	name: slot.name || "",
	slotName: slot.slotName || "",
	provider: slot.provider || "",
	image: slot.image || "",
});

const buildApiUrl = (query) =>
	`https://bonushunt.gg/api/slots?q=${encodeURIComponent(query)}&site=Stake`;

const cleanupExpiredCache = () => {
	const now = Date.now();
	for (const [key, value] of slotSearchCache.entries()) {
		if (value.expiresAt <= now) {
			slotSearchCache.delete(key);
		}
	}
};

const cleanupRateBuckets = () => {
	const now = Date.now();
	for (const [ip, bucket] of rateLimitBuckets.entries()) {
		if (!bucket.length) {
			rateLimitBuckets.delete(ip);
			continue;
		}
		if (now - bucket[bucket.length - 1] > SLOT_RATE_LIMIT_WINDOW_MS) {
			rateLimitBuckets.delete(ip);
		}
	}
};

const slotSearchRateLimiter = (req, res, next) => {
	cleanupRateBuckets();

	const key = req.ip || req.headers["x-forwarded-for"] || "global";
	const now = Date.now();
	const bucket = rateLimitBuckets.get(key) || [];
	const recent = bucket.filter((ts) => now - ts < SLOT_RATE_LIMIT_WINDOW_MS);

	if (recent.length >= SLOT_RATE_LIMIT_MAX) {
		return res.status(429).json({
			message: "Too many slot search requests. Please retry shortly.",
		});
	}

	recent.push(now);
	rateLimitBuckets.set(key, recent);
	next();
};

const searchSlots = async (query) => {
	const trimmed = String(query || "").trim();
	if (trimmed.length < 2) {
		const error = new Error("Query must be at least 2 characters.");
		error.statusCode = 400;
		throw error;
	}

	cleanupExpiredCache();
	const cacheKey = normalize(trimmed);
	const cached = slotSearchCache.get(cacheKey);
	if (cached && cached.expiresAt > Date.now()) {
		return cached.data;
	}

	try {
		const response = await axios.get(buildApiUrl(trimmed), { timeout: 8000 });
		const rawSlots = Array.isArray(response.data)
			? response.data
			: Array.isArray(response.data?.results)
			? response.data.results
			: [];

		const simplified = rawSlots.map(pickSlotFields).filter((slot) => slot.name || slot.slotName);

		slotSearchCache.set(cacheKey, {
			data: simplified,
			expiresAt: Date.now() + SLOT_CACHE_TTL_MS,
		});

		return simplified;
	} catch (error) {
		const wrapped = new Error("Failed to fetch slots from external provider.");
		wrapped.statusCode = 502;
		wrapped.details = error.response?.data || error.message;
		throw wrapped;
	}
};

const getImageFileName = (value) => {
	try {
		const input = String(value || "").trim();
		if (!input) return "";
		const url = new URL(input);
		return normalize(url.pathname.split("/").pop() || "");
	} catch {
		const parts = String(value || "").split("?")[0].split("/");
		return normalize(parts[parts.length - 1] || "");
	}
};

const isSlotMatch = (slot, wanted) => {
	const slotNameExact = normalizeLoose(slot.slotName) === normalizeLoose(wanted.slotName);
	const displayNameExact = normalizeLoose(slot.name) === normalizeLoose(wanted.slotDisplayName);
	const providerExact = normalize(slot.provider) === normalize(wanted.provider);

	const wantedImage = getImageFileName(wanted.slotImage);
	const slotImage = getImageFileName(slot.image);
	const imageMatch = Boolean(wantedImage && slotImage && wantedImage === slotImage);

	if (slotNameExact && (providerExact || displayNameExact || imageMatch)) return true;
	if (displayNameExact && (providerExact || imageMatch)) return true;

	return false;
};

const validateSlotSelection = async ({ slotName, slotDisplayName, provider, slotImage }) => {
	const queries = [slotDisplayName, slotName]
		.map((q) => String(q || "").trim())
		.filter((q, idx, arr) => q.length >= 2 && arr.indexOf(q) === idx);

	const slotsByKey = new Map();
	for (const query of queries) {
		try {
			const found = await searchSlots(query);
			for (const slot of found) {
				const key = `${normalize(slot.slotName)}|${normalize(slot.provider)}|${getImageFileName(slot.image)}`;
				slotsByKey.set(key, slot);
			}
		} catch {
			// Keep trying alternate query terms before failing validation.
		}
	}

	const slots = Array.from(slotsByKey.values());
	if (!slots.length) return false;

	return slots.some((slot) =>
		isSlotMatch(slot, { slotName, slotDisplayName, provider, slotImage })
	);
};

module.exports = {
	searchSlots,
	validateSlotSelection,
	slotSearchRateLimiter,
};
