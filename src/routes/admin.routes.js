const express = require("express");
const { protect, adminProtect } = require("../middleware/auth.middleware");
const { getPlatformAnalytics } = require("../controllers/admin/analytics.controller");

const router = express.Router();

router.use(protect);
router.use(adminProtect);

router.get("/analytics", getPlatformAnalytics);

const { getUsers, getCompanies } = require("../controllers/admin/data.controller");

router.get("/users", getUsers);
router.get("/companies", getCompanies);

// Placeholder for other admin routes
// router.post("/cron/trigger", triggerCron);

module.exports = router;
