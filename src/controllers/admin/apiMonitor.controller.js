const ApiLog = require("../../models/ApiLog.model");

// GET /api/admin/api-usage
const getApiUsageStats = async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0,0,0,0);

    // Get today's counts
    const geminiCount = await ApiLog.countDocuments({
      apiName: "Gemini",
      createdAt: { $gte: startOfToday }
    });

    const newsCount = await ApiLog.countDocuments({
      apiName: "NewsAPI",
      createdAt: { $gte: startOfToday }
    });

    const adzunaCount = await ApiLog.countDocuments({
      apiName: "Adzuna",
      createdAt: { $gte: startOfToday }
    });

    const githubCount = await ApiLog.countDocuments({
      apiName: "GitHub",
      createdAt: { $gte: startOfToday }
    });

    // Check if above 80% of limits
    // NewsAPI Limit: 100
    // Gemini Limit: 1500
    const newsLimit = 100;
    const geminiLimit = 1500;

    const newsWarning = newsCount >= (newsLimit * 0.8);
    const geminiWarning = geminiCount >= (geminiLimit * 0.8);

    // Fetch recent failed API calls
    const failedLogs = await ApiLog.find({ status: "failed" })
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({
      usage: {
        Gemini: { count: geminiCount, limit: geminiLimit, warning: geminiWarning },
        NewsAPI: { count: newsCount, limit: newsLimit, warning: newsWarning },
        Adzuna: { count: adzunaCount, limit: null, warning: false },
        GitHub: { count: githubCount, limit: 5000, warning: false }
      },
      warningsActive: newsWarning || geminiWarning,
      failedLogs
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch API usage details" });
  }
};

module.exports = {
  getApiUsageStats
};
