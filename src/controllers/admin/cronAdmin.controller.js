const CronLog = require("../../models/CronLog.model");
const WatchedCompany = require("../../models/WatchedCompany.model");
const { runSpyCron, processCompany, toggleCron, getGlobalCronStatus } = require("../../cron/spyCron");

// GET /api/admin/cron/status
const getCronStatus = async (req, res) => {
  try {
    const lastRun = await CronLog.findOne().sort({ createdAt: -1 });
    const isEnabled = getGlobalCronStatus();
    res.json({
      isEnabled,
      lastRun
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch cron status" });
  }
};

// GET /api/admin/cron/logs
const getCronLogs = async (req, res) => {
  try {
    const logs = await CronLog.find().sort({ runAt: -1 }).limit(100);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch cron logs" });
  }
};

// POST /api/admin/cron/trigger
const triggerCronForAll = async (req, res) => {
  try {
    // Run asynchronously to prevent API timeout
    runSpyCron();
    res.json({ message: "Cron job manually triggered for all companies in background" });
  } catch (error) {
    res.status(500).json({ message: "Failed to trigger cron" });
  }
};

// POST /api/admin/cron/trigger/:companyId
const triggerCronForSingle = async (req, res) => {
  try {
    const company = await WatchedCompany.findById(req.params.companyId);
    if (!company) return res.status(404).json({ message: "Watched company not found" });

    const result = await processCompany(company);
    if (result.success) {
      res.json({ message: `Successfully scanned ${company.companyName}`, result });
    } else {
      res.status(500).json({ message: `Failed to scan ${company.companyName}`, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ message: "Failed to manually scan company" });
  }
};

// PATCH /api/admin/cron/toggle
const toggleGlobalCron = async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== "boolean") {
      return res.status(400).json({ message: "enabled field must be boolean" });
    }

    toggleCron(enabled);
    res.json({ message: `Global cron schedule is now ${enabled ? "enabled" : "disabled"}`, isEnabled: enabled });
  } catch (error) {
    res.status(500).json({ message: "Failed to toggle global cron status" });
  }
};

module.exports = {
  getCronStatus,
  getCronLogs,
  triggerCronForAll,
  triggerCronForSingle,
  toggleGlobalCron
};
