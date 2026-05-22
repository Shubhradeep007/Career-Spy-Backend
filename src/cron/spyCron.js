const cron = require("node-cron");
const WatchedCompany = require("../models/WatchedCompany.model");
const Signal = require("../models/Signal.model");
const Alert = require("../models/Alert.model");
const CronLog = require("../models/CronLog.model");
const Notification = require("../models/Notification.model");

const { getAdzunaJobCount } = require("../services/adzunaService");
const { getNewsCount } = require("../services/newsApiService");
const { getGithubActivity } = require("../services/githubService");
const { getCareerPageScore } = require("../services/cheerioService");
const { getGeminiHireScore } = require("../services/geminiScoreService");
const { transporter } = require("../services/emailService");
const { getIo } = require("../socket");

let isGlobalCronEnabled = true;

const processCompany = async (company) => {
  try {
    // 1. Collect Signals in Parallel
    const [jobsPosted, newsCount, githubActivity, careerPageScore] = await Promise.all([
      getAdzunaJobCount(company.companyName),
      getNewsCount(company.companyName),
      getGithubActivity(company.githubOrg),
      getCareerPageScore(company.careerUrl)
    ]);

    const signalData = { jobsPosted, newsCount, githubActivity, careerPageScore };

    // 2. Get AI Score
    const aiInsight = await getGeminiHireScore(company.companyName, signalData, company.targetRole);

    // 3. Save Signal
    const newSignal = await Signal.create({
      companyId: company._id,
      ...signalData,
      ...aiInsight
    });

    // 4. Emit real-time update
    const io = getIo();
    io.to(`user_${company.userId}`).emit("signal:updated", {
      companyId: company._id,
      hireScore: aiInsight.hireScore,
      verdict: aiInsight.verdict
    });

    let alertTriggered = false;

    // 5. Alert Logic
    if (aiInsight.hireScore >= 70 && company.alertActive) {
      // check if we recently sent an alert for this signal (simplified: check if an alert exists for this signalId)
      // actually we check if we already alerted today
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const existingAlert = await Alert.findOne({
        companyId: company._id,
        createdAt: { $gte: startOfDay }
      });

      if (!existingAlert) {
        // Send email
        await transporter.sendMail({
          from: `"Career Spy 🕵️" <${process.env.EMAIL_USER}>`,
          to: process.env.EMAIL_USER, // Ideally we populate user email here, but for now we fallback or need to fetch user
          subject: `🔥 ${company.companyName} is hiring! Score: ${aiInsight.hireScore}`,
          html: `<p><strong>${company.companyName}</strong> has a hire score of ${aiInsight.hireScore}.</p>
                 <p><strong>Summary:</strong> ${aiInsight.aiSummary}</p>
                 <p><strong>Action:</strong> ${aiInsight.aiAction}</p>`
        });

        await Alert.create({
          userId: company.userId,
          companyId: company._id,
          signalId: newSignal._id,
          hireScore: aiInsight.hireScore,
          verdict: aiInsight.verdict,
          emailStatus: "sent",
          sentAt: new Date()
        });

        await Notification.create({
          userId: company.userId,
          type: "hire_alert",
          title: `${company.companyName} is hiring!`,
          message: aiInsight.aiSummary,
          companyId: company._id,
          hireScore: aiInsight.hireScore
        });

        io.to(`user_${company.userId}`).emit("notification:new", {
          type: "hire_alert",
          title: `${company.companyName} is hiring!`,
          message: aiInsight.aiSummary,
          score: aiInsight.hireScore,
          companyName: company.companyName,
          createdAt: new Date()
        });

        alertTriggered = true;
      }
    }

    return { success: true, alertTriggered };
  } catch (error) {
    console.error(`Error processing ${company.companyName}:`, error.message);
    return { success: false, error: error.message };
  }
};

const runSpyCron = async () => {
  if (!isGlobalCronEnabled) return;
  const startTime = Date.now();
  const errors = [];
  let companiesProcessed = 0;
  let alertsTriggered = 0;

  try {
    const companies = await WatchedCompany.find();
    companiesProcessed = companies.length;

    for (const company of companies) {
      const result = await processCompany(company);
      if (result.success && result.alertTriggered) alertsTriggered++;
      if (!result.success) errors.push(result.error);
    }

    await CronLog.create({
      runAt: new Date(),
      status: errors.length === 0 ? "success" : (errors.length < companiesProcessed ? "partial" : "failed"),
      companiesProcessed,
      alertsTriggered,
      errorMessages: errors,
      durationMs: Date.now() - startTime
    });

    const io = getIo();
    io.emit("cron:status", {
      status: errors.length === 0 ? "success" : "partial",
      companiesProcessed,
      time: new Date()
    });

  } catch (error) {
    console.error("Cron Error:", error.message);
    await CronLog.create({
      runAt: new Date(),
      status: "failed",
      companiesProcessed: 0,
      alertsTriggered: 0,
      errorMessages: [error.message],
      durationMs: Date.now() - startTime
    });
    
    getIo().to("admin_room").emit("admin:cron_failed", {
      error: error.message,
      time: new Date()
    });
  }
};

const startSpyCron = () => {
  cron.schedule("0 * * * *", () => {
    console.log("⏰ Running hourly Spy Cron...");
    runSpyCron();
  });
  console.log("⏰ Spy Cron scheduled to run hourly");
};

const toggleCron = (status) => {
  isGlobalCronEnabled = status;
};

module.exports = { startSpyCron, runSpyCron, toggleCron, processCompany };
