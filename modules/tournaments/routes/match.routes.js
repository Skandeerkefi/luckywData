const express = require("express");
const { submitResultController } = require("../controllers/match.controller");
const { verifyToken, isAdmin } = require("../../../middleware/auth");

const router = express.Router();

router.post("/:id/result", verifyToken, isAdmin, submitResultController);

module.exports = router;
