const express = require("express");
const { searchSlotController } = require("../controllers/slot.controller");
const { slotSearchRateLimiter } = require("../slot.service");

const router = express.Router();

router.get("/search", slotSearchRateLimiter, searchSlotController);

module.exports = router;
