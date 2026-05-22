const express = require("express");
const { protect } = require("../middleware/auth.middleware");
const { getActiveNoticesUser } = require("../controllers/admin/noticeAdmin.controller");

const router = express.Router();

router.get("/", protect, getActiveNoticesUser);

module.exports = router;
