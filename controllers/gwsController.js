const GWS = require("../models/GWS");
const { User } = require("../models/User");
const {
	fetchRoobetAffiliateStatsFixedMonthly,
	getGwsFixedMonthlyPeriod,
} = require("./roobetController");

const matchesMaskedUsername = (entryUsername, targetUsername) => {
	const source = String(entryUsername || "").trim().toLowerCase();
	const target = String(targetUsername || "").trim().toLowerCase();
	if (!source || !target) return false;
	if (!source.includes("*")) return source === target;

	// Convert masked usernames like B***v to a regex: ^b.*v$
	const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const wildcardPattern = `^${escaped.replace(/\*/g, ".*")}$`;
	try {
		return new RegExp(wildcardPattern).test(target);
	} catch {
		return false;
	}
};

const buildResolvedWagerList = async () => {
	const leaderboard = await fetchRoobetAffiliateStatsFixedMonthly();

	return leaderboard.map((entry) => {
		const wagered = Number(entry.wagered || 0);
		const weightedWagered = Number(entry.weightedWagered || 0);
		return {
			uid: String(entry?.uid || ""),
			rawUsername: String(entry?.username || ""),
			username: String(entry?.username || ""),
			wagered,
			weightedWagered,
			effectiveWager: weightedWagered,
		};
	});
};

exports.createGWS = async (req, res) => {
	const { title, endTime, entryRequirement, requiredWagerAmount } = req.body;
	const requirement =
		entryRequirement === "no_wager_requirement"
			? "no_wager_requirement"
			: "leaderboard_wager";
	const parsedRequiredWager = Number(requiredWagerAmount);
	const effectiveRequiredWager =
		requirement === "leaderboard_wager"
			? Number.isFinite(parsedRequiredWager) && parsedRequiredWager > 0
				? parsedRequiredWager
				: 1
			: 0;

	try {
		const gws = new GWS({
			title,
			endTime,
			entryRequirement: requirement,
			requiredWagerAmount: effectiveRequiredWager,
			state: "active",
		});
		await gws.save();
		res.status(201).json({ message: "GWS created", gws });
	} catch (error) {
		res.status(500).json({ error: "Create GWS failed" });
	}
};

exports.joinGWS = async (req, res) => {
	try {
		const user = await User.findById(req.user.id);
		if (!user || !user.rainbetUsername) {
			return res.status(400).json({
				message: "Roobet username is required to join giveaways.",
			});
		}

		const gws = await GWS.findById(req.params.id);
		if (!gws) return res.status(404).json({ message: "GWS not found" });

		if (gws.entryRequirement === "leaderboard_wager") {
			const minRequiredWager = Number(gws.requiredWagerAmount || 0);
			try {
				const wagerList = await buildResolvedWagerList();
				const userName = String(user.rainbetUsername || "").toLowerCase();

				const isEligible = wagerList.some((entry) => {
					const entryName = entry.username;
					const usernameMatches = matchesMaskedUsername(entryName, userName);
					return usernameMatches && entry.effectiveWager >= minRequiredWager;
				});

				if (!isEligible) {
					return res.status(403).json({
						message: `This giveaway requires at least ${minRequiredWager} wager on the current Roobet leaderboard.`,
					});
				}
			} catch (error) {
				console.error("Roobet leaderboard check failed:", error.message || error);
				return res.status(403).json({
					message: `This giveaway requires at least ${minRequiredWager} wager on the monthly leaderboard.`,
				});
			}
		}

		const updated = await GWS.findOneAndUpdate(
			{ _id: gws._id, participants: { $ne: req.user.id } },
			{
				$addToSet: { participants: req.user.id },
				$inc: { totalParticipants: 1, totalEntries: 1 },
			},
			{ new: true }
		).populate("participants", "kickUsername");

		if (!updated) {
			return res.status(400).json({ message: "Already joined" });
		}

		res.json({ message: "Joined GWS", gws: updated });
	} catch (error) {
		console.error("GWS join failed:", error);
		res.status(500).json({ message: "Join failed" });
	}
};

exports.updateGWS = async (req, res) => {
	const { winnerId, state } = req.body;

	try {
		const gws = await GWS.findById(req.params.id);
		if (!gws) return res.status(404).json({ message: "GWS not found" });

		if (winnerId) gws.winner = winnerId;
		if (state && ["active", "complete"].includes(state)) gws.state = state;

		await gws.save();
		res.json({ message: "GWS updated", gws });
	} catch {
		res.status(500).json({ error: "Failed to update GWS" });
	}
};
exports.drawWinner = async (req, res) => {
	try {
		const gws = await GWS.findById(req.params.id).populate("participants");
		if (!gws || gws.participants.length === 0) {
			return res.status(400).json({ message: "No participants to draw from." });
		}

		const randomIndex = Math.floor(Math.random() * gws.participants.length);
		const winner = gws.participants[randomIndex];

		gws.winner = winner._id;
		gws.state = "complete";
		await gws.save();

		const winnerProfile = await User.findById(winner._id).select(
			"kickUsername rainbetUsername discordUsername"
		);
		const resolvedWinner = winnerProfile || winner;

		res.json({
			message: "Winner selected",
			winner: {
				id: resolvedWinner._id,
				kickUsername: resolvedWinner.kickUsername,
				rainbetUsername: resolvedWinner.rainbetUsername,
				discordUsername: resolvedWinner.discordUsername,
			},
			gws,
		});
	} catch (error) {
		console.error(error);
		res.status(500).json({ message: "Failed to draw winner." });
	}
};
exports.getAllGWS = async (req, res) => {
	try {
		const giveaways = await GWS.find()
			.populate("winner", "kickUsername rainbetUsername discordUsername")
			.populate("participants", "kickUsername rainbetUsername discordUsername");

		const normalized = giveaways.map((doc) => {
			const item = doc.toObject();
			const winnerObj =
				item.winner && typeof item.winner === "object" ? item.winner : null;
			const winnerId = winnerObj?._id ? String(winnerObj._id) : null;

			if (!winnerObj || !winnerId) {
				return item;
			}

			const hasFullWinnerDetails =
				Boolean(winnerObj.rainbetUsername) && Boolean(winnerObj.discordUsername);
			if (hasFullWinnerDetails) {
				return item;
			}

			const fallbackFromParticipants = Array.isArray(item.participants)
				? item.participants.find((p) => String(p?._id) === winnerId)
				: null;

			if (fallbackFromParticipants) {
				item.winner = {
					_id: winnerObj._id,
					kickUsername:
						winnerObj.kickUsername || fallbackFromParticipants.kickUsername,
					rainbetUsername:
						winnerObj.rainbetUsername || fallbackFromParticipants.rainbetUsername,
					discordUsername:
						winnerObj.discordUsername || fallbackFromParticipants.discordUsername,
				};
			}

			return item;
		});

		res.json(normalized);
	} catch (err) {
		console.error("❌ getAllGWS error:", err);
		res.status(500).json({ message: "Failed to fetch giveaways." });
	}
};

exports.getWagerDebugList = async (req, res) => {
	try {
		const period = getGwsFixedMonthlyPeriod();
		const wagerList = await buildResolvedWagerList();
		const sorted = wagerList.sort((a, b) => b.effectiveWager - a.effectiveWager);
		res.json({
			periodType: "monthly",
			startDate: period.startDate,
			endDate: period.endDate,
			count: sorted.length,
			data: sorted,
		});
	} catch (error) {
		console.error("❌ getWagerDebugList error:", error.message || error);
		res.status(500).json({ message: "Failed to fetch wager debug list." });
	}
};

exports.getGwsPlayers = async (req, res) => {
	try {
		const gws = await GWS.findById(req.params.id)
			.select("title participants totalParticipants")
			.populate("participants", "kickUsername rainbetUsername discordUsername");

		if (!gws) {
			return res.status(404).json({ message: "GWS not found" });
		}

		res.json({
			gwsId: gws._id,
			title: gws.title,
			totalParticipants: gws.totalParticipants,
			players: gws.participants || [],
		});
	} catch (error) {
		console.error("❌ getGwsPlayers error:", error.message || error);
		res.status(500).json({ message: "Failed to fetch giveaway players." });
	}
};
// Helper to auto-draw winner and update state
exports.drawWinnerAuto = async (gws) => {
	if (!gws.participants || gws.participants.length === 0) {
		gws.state = "complete";
		await gws.save();
		return;
	}

	const randomIndex = Math.floor(Math.random() * gws.participants.length);
	const winner = gws.participants[randomIndex];

	gws.winner = winner;
	gws.state = "complete"; // IMPORTANT: set state to complete here
	await gws.save();
};
