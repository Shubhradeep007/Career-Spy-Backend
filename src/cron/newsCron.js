const cron = require("node-cron");
const { scrapeAllCompaniesNews } = require("../utils/newsScraper");

/**
 * Runs every day at 7:00 AM IST (1:30 AM UTC)
 * Refreshes news for all active companies across all users.
 *
 * Cron format: second(optional) minute hour day month weekday
 */
const startNewsCron = () => {
    cron.schedule("30 1 * * *", async () => {
        console.log("⏰ [CRON] Daily news refresh started...");
        try {
            await scrapeAllCompaniesNews();
            console.log("⏰ [CRON] Daily news refresh completed");
        } catch (err) {
            console.error("⏰ [CRON] News refresh failed:", err.message);
        }
    }, {
        timezone: "UTC",
    });

    console.log("⏰ News cron job scheduled — runs daily at 7:00 AM IST");
};

module.exports = { startNewsCron };