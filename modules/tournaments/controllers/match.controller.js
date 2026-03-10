const { submitMatchResult } = require("../services/match.service");

const submitResultController = async (req, res) => {
	try {
		const result = await submitMatchResult({
			matchId: req.params.id,
			payload: req.body,
		});
		res.status(200).json({ message: "Match result submitted.", ...result });
	} catch (error) {
		res
			.status(error.statusCode || 500)
			.json({ message: error.message || "Failed to submit match result." });
	}
};

module.exports = {
	submitResultController,
};
