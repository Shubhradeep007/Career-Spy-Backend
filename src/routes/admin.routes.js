const express = require("express");
const { protect, adminProtect } = require("../middleware/auth.middleware");

// Controllers
const { getPlatformAnalytics } = require("../controllers/admin/analytics.controller");
const {
  getUsers,
  getUserDetails,
  banUser,
  deleteUser,
  resetUserPassword,
  getCompanies,
  cancelUserSubscription
} = require("../controllers/admin/data.controller");
const {
  getCronStatus,
  getCronLogs,
  triggerCronForAll,
  triggerCronForSingle,
  toggleGlobalCron
} = require("../controllers/admin/cronAdmin.controller");
const {
  getAlerts,
  resendAlert
} = require("../controllers/admin/alertAdmin.controller");
const {
  getApiUsageStats
} = require("../controllers/admin/apiMonitor.controller");
const {
  getNoticesAdmin,
  createNotice,
  updateNotice,
  deleteNotice
} = require("../controllers/admin/noticeAdmin.controller");
const {
  getConversationsAdmin,
  sendReplyAdmin,
  updateStatusAdmin,
  markReadAdmin,
  getUnreadCountAdmin
} = require("../controllers/support.controller");

const router = express.Router();

// Role validation middleware
router.use(protect);
router.use(adminProtect);

// Platform Analytics
router.get("/analytics", getPlatformAnalytics);

// User Management
router.get("/users", getUsers);
router.get("/users/:id", getUserDetails);
router.patch("/users/:id/ban", banUser);
router.delete("/users/:id", deleteUser);
router.patch("/users/:id/reset-password", resetUserPassword);
router.patch("/users/:id/cancel-subscription", cancelUserSubscription);

// Company Watchlist Overview
router.get("/companies", getCompanies);

// Cron & Signal Control
router.get("/cron/status", getCronStatus);
router.get("/cron/logs", getCronLogs);
router.post("/cron/trigger", triggerCronForAll);
router.post("/cron/trigger/:companyId", triggerCronForSingle);
router.patch("/cron/toggle", toggleGlobalCron);

// Alert Management
router.get("/alerts", getAlerts);
router.post("/alerts/:id/resend", resendAlert);

// API Usage Monitor
router.get("/api-usage", getApiUsageStats);

// Announcement / Notice Board CRUD
router.get("/notices", getNoticesAdmin);
router.post("/notices", createNotice);
router.patch("/notices/:id", updateNotice);
router.delete("/notices/:id", deleteNotice);

// Support Chat Inbox
router.get("/support/conversations", getConversationsAdmin);
router.post("/support/conversations/:id/messages", sendReplyAdmin);
router.patch("/support/conversations/:id/status", updateStatusAdmin);
router.patch("/support/conversations/:id/read", markReadAdmin);
router.get("/support/unread-count", getUnreadCountAdmin);

module.exports = router;
