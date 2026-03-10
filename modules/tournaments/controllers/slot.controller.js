const { searchSlots } = require("../slot.service");

const searchSlotController = async (req, res) => {
	try {
		const slots = await searchSlots(req.query.q);
		res.status(200).json({ data: slots });
	} catch (error) {
		const statusCode = error.statusCode || 500;
		res.status(statusCode).json({
			message: error.message || "Slot search failed.",
			details: error.details || undefined,
		});
	}
};

module.exports = {
	searchSlotController,
};
