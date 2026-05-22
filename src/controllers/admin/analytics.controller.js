const User = require("../../models/User.model");
const Signal = require("../../models/Signal.model");
const Alert = require("../../models/Alert.model");
const WatchedCompany = require("../../models/WatchedCompany.model");

// GET /api/admin/analytics
const getPlatformAnalytics = async (req, res) => {
  try {
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // Aggregation: Users
    const [userStats] = await User.aggregate([
      {
        $facet: {
          totalUsers: [{ $count: "count" }],
          thisMonthUsers: [
            { $match: { createdAt: { $gte: firstDayOfMonth } } },
            { $count: "count" }
          ]
        }
      }
    ]);
    const totalUsers = userStats.totalUsers[0]?.count || 0;
    const thisMonthUsers = userStats.thisMonthUsers[0]?.count || 0;

    // Aggregation: Signals today
    const startOfToday = new Date();
    startOfToday.setHours(0,0,0,0);
    const [signalStats] = await Signal.aggregate([
      {
        $facet: {
          totalSignals: [{ $count: "count" }],
          todaySignals: [
            { $match: { createdAt: { $gte: startOfToday } } },
            { $count: "count" }
          ]
        }
      }
    ]);
    const totalSignals = signalStats.totalSignals[0]?.count || 0;
    const todaySignals = signalStats.todaySignals[0]?.count || 0;

    // Aggregation: Alerts this week
    const startOfWeek = new Date();
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0,0,0,0);
    const [alertStats] = await Alert.aggregate([
      {
        $facet: {
          totalAlerts: [{ $count: "count" }],
          thisWeekAlerts: [
            { $match: { createdAt: { $gte: startOfWeek } } },
            { $count: "count" }
          ]
        }
      }
    ]);
    const totalAlerts = alertStats.totalAlerts[0]?.count || 0;
    const thisWeekAlerts = alertStats.thisWeekAlerts[0]?.count || 0;

    // Aggregation: Top 10 most-watched companies
    const topWatchedCompanies = await WatchedCompany.aggregate([
      {
        $group: {
          _id: { $toLower: "$companyName" },
          originalName: { $first: "$companyName" },
          watchers: { $sum: 1 }
        }
      },
      { $sort: { watchers: -1 } },
      { $limit: 10 },
      { $project: { _id: 0, companyName: "$originalName", watchers: 1 } }
    ]);

    // Aggregation: Average hire score per company
    const avgHireScore = await Signal.aggregate([
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$companyId",
          latestScore: { $first: "$hireScore" }
        }
      },
      {
        $lookup: {
          from: "watchedcompanies",
          localField: "_id",
          foreignField: "_id",
          as: "company"
        }
      },
      { $unwind: "$company" },
      {
        $group: {
          _id: { $toLower: "$company.companyName" },
          originalName: { $first: "$company.companyName" },
          avgScore: { $avg: "$latestScore" }
        }
      },
      { $sort: { avgScore: -1 } },
      { $project: { _id: 0, companyName: "$originalName", avgScore: { $round: ["$avgScore", 1] } } }
    ]);

    res.json({
      users: { total: totalUsers, thisMonth: thisMonthUsers },
      signals: { total: totalSignals, today: todaySignals },
      alerts: { total: totalAlerts, thisWeek: thisWeekAlerts },
      topWatchedCompanies,
      avgHireScore
    });

  } catch (error) {
    console.error("Analytics Error:", error);
    res.status(500).json({ message: "Failed to load platform analytics" });
  }
};

module.exports = { getPlatformAnalytics };
