const cron = require("node-cron");
const WatchedCompany = require("../models/WatchedCompany.model");
const Signal = require("../models/Signal.model");
const Alert = require("../models/Alert.model");
const CronLog = require("../models/CronLog.model");
const Notification = require("../models/Notification.model");
const User = require("../models/User.model");

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
      // Check if we recently alerted today
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const existingAlert = await Alert.findOne({
        companyId: company._id,
        createdAt: { $gte: startOfDay }
      });

      if (!existingAlert) {
        // Fetch recipient email dynamically
        const userObj = await User.findById(company.userId);
        const recipientEmail = userObj?.email || process.env.EMAIL_USER;

        // Build premium HTML content
        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <h2 style="color: #1e3a8a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px; text-align: center;">🕵️ Career Spy Alert</h2>
            <p style="font-size: 16px; color: #374151;">Great news! <strong>${company.companyName}</strong> is displaying high hiring signals.</p>
            
            <div style="margin: 20px 0; background-color: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; display: inline-block; width: 100%; box-sizing: border-box;">
              <div style="float: left; font-size: 28px; font-weight: bold; color: ${aiInsight.verdict === 'HOT' ? '#ef4444' : '#f59e0b'}; padding-right: 20px; border-right: 1px solid #e2e8f0; margin-right: 20px; line-height: 1;">
                ${aiInsight.hireScore}
              </div>
              <div style="float: left;">
                <span style="display: inline-block; background-color: ${aiInsight.verdict === 'HOT' ? '#fecaca' : '#fef3c7'}; color: ${aiInsight.verdict === 'HOT' ? '#991b1b' : '#92400e'}; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: bold; text-transform: uppercase;">
                  ${aiInsight.verdict}
                </span>
                <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">AI Hire Score Verdict</p>
              </div>
              <div style="clear: both;"></div>
            </div>

            <div style="margin-bottom: 20px;">
              <h3 style="color: #1e293b; font-size: 15px; margin-bottom: 8px;">AI Signal Summary:</h3>
              <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.5; background-color: #f1f5f9; padding: 12px; border-radius: 6px;">
                ${aiInsight.aiSummary}
              </p>
            </div>

            <div style="margin-bottom: 20px;">
              <h3 style="color: #1e293b; font-size: 15px; margin-bottom: 8px;">Actionable Advice:</h3>
              <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.5; background-color: #f1f5f9; padding: 12px; border-radius: 6px;">
                ${aiInsight.aiAction}
              </p>
            </div>

            ${aiInsight.outreachMessage ? `
            <div style="margin-bottom: 25px;">
              <h3 style="color: #1e293b; font-size: 15px; margin-bottom: 8px;">Tailored Outreach Message:</h3>
              <div style="margin: 0; color: #0f172a; font-size: 13px; line-height: 1.6; background-color: #fafafa; border: 1px dashed #cbd5e1; border-left: 4px solid #1e3a8a; padding: 15px; border-radius: 6px; white-space: pre-wrap; font-family: monospace;">
${aiInsight.outreachMessage}
              </div>
            </div>
            ` : ""}

            <p style="font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 15px; margin: 20px 0 0 0;">
              This is an automated alert based on monitored data signals for ${company.companyName}. You can manage notifications under Company Settings on your Career Spy Dashboard.
            </p>
          </div>
        `;

        try {
          await transporter.sendMail({
            from: `"Career Spy 🕵️" <${process.env.EMAIL_USER}>`,
            to: recipientEmail,
            subject: `🔥 ${company.companyName} is hiring soon! (Hire Score: ${aiInsight.hireScore})`,
            html: emailHtml
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
        } catch (mailErr) {
          console.error("❌ Failed to send alert email:", mailErr.message);
          await Alert.create({
            userId: company.userId,
            companyId: company._id,
            signalId: newSignal._id,
            hireScore: aiInsight.hireScore,
            verdict: aiInsight.verdict,
            emailStatus: "failed"
          });
        }

        await Notification.create({
          userId: company.userId,
          type: "hire_alert",
          title: `${company.companyName} Alert!`,
          message: `${company.companyName} reached a HOT score of ${aiInsight.hireScore}. Action: ${aiInsight.aiAction}`,
          companyId: company._id,
          hireScore: aiInsight.hireScore
        });

        io.to(`user_${company.userId}`).emit("notification:new", {
          type: "hire_alert",
          title: `${company.companyName} Alert!`,
          message: `${company.companyName} reached a HOT score of ${aiInsight.hireScore}.`,
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
      
      // Add delay to respect Gemini RPM limits (15 TPM for free tier)
      if (companies.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 4000));
      }
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

const getGlobalCronStatus = () => isGlobalCronEnabled;

module.exports = { startSpyCron, runSpyCron, toggleCron, processCompany, getGlobalCronStatus };
