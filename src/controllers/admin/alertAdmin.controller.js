const Alert = require("../../models/Alert.model");
const WatchedCompany = require("../../models/WatchedCompany.model");
const Signal = require("../../models/Signal.model");
const User = require("../../models/User.model");
const { transporter } = require("../../services/emailService");

// GET /api/admin/alerts
const getAlerts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const total = await Alert.countDocuments();
    const alerts = await Alert.find()
      .populate("userId", "name email")
      .populate("companyId", "companyName targetRole")
      .populate("signalId", "aiSummary aiAction outreachMessage")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    // Calculate statistics
    const now = new Date();
    
    const startOfToday = new Date(now);
    startOfToday.setHours(0,0,0,0);

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0,0,0,0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const sentToday = await Alert.countDocuments({ createdAt: { $gte: startOfToday } });
    const sentThisWeek = await Alert.countDocuments({ createdAt: { $gte: startOfWeek } });
    const sentThisMonth = await Alert.countDocuments({ createdAt: { $gte: startOfMonth } });

    res.json({
      alerts,
      total,
      pages: Math.ceil(total / limit),
      page,
      stats: {
        today: sentToday,
        week: sentThisWeek,
        month: sentThisMonth
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch alerts" });
  }
};

// POST /api/admin/alerts/:id/resend
const resendAlert = async (req, res) => {
  try {
    const alert = await Alert.findById(req.params.id)
      .populate("userId")
      .populate("companyId")
      .populate("signalId");

    if (!alert) return res.status(404).json({ message: "Alert not found" });

    const recipientEmail = alert.userId?.email || process.env.EMAIL_USER;
    const companyName = alert.companyId?.companyName || "Your Dream Company";

    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #1e3a8a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px; text-align: center;">🕵️ Career Spy Alert (Resent)</h2>
        <p style="font-size: 16px; color: #374151;">Hello, this is a manually resent alert for <strong>${companyName}</strong>.</p>
        
        <div style="margin: 20px 0; background-color: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; display: inline-block; width: 100%; box-sizing: border-box;">
          <div style="float: left; font-size: 28px; font-weight: bold; color: ${alert.verdict === 'HOT' ? '#ef4444' : '#f59e0b'}; padding-right: 20px; border-right: 1px solid #e2e8f0; margin-right: 20px; line-height: 1;">
            ${alert.hireScore}
          </div>
          <div style="float: left;">
            <span style="display: inline-block; background-color: ${alert.verdict === 'HOT' ? '#fecaca' : '#fef3c7'}; color: ${alert.verdict === 'HOT' ? '#991b1b' : '#92400e'}; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: bold; text-transform: uppercase;">
              ${alert.verdict}
            </span>
            <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">AI Hire Score Verdict</p>
          </div>
          <div style="clear: both;"></div>
        </div>

        <div style="margin-bottom: 20px;">
          <h3 style="color: #1e293b; font-size: 15px; margin-bottom: 8px;">AI Signal Summary:</h3>
          <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.5; background-color: #f1f5f9; padding: 12px; border-radius: 6px;">
            ${alert.signalId?.aiSummary || "Signals gathered show high hiring intent."}
          </p>
        </div>

        <div style="margin-bottom: 20px;">
          <h3 style="color: #1e293b; font-size: 15px; margin-bottom: 8px;">Actionable Advice:</h3>
          <p style="margin: 0; color: #475569; font-size: 14px; line-height: 1.5; background-color: #f1f5f9; padding: 12px; border-radius: 6px;">
            ${alert.signalId?.aiAction || "We recommend reaching out to hiring managers."}
          </p>
        </div>

        ${alert.signalId?.outreachMessage ? `
        <div style="margin-bottom: 25px;">
          <h3 style="color: #1e293b; font-size: 15px; margin-bottom: 8px;">Tailored Outreach Message:</h3>
          <div style="margin: 0; color: #0f172a; font-size: 13px; line-height: 1.6; background-color: #fafafa; border: 1px dashed #cbd5e1; border-left: 4px solid #1e3a8a; padding: 15px; border-radius: 6px; white-space: pre-wrap; font-family: monospace;">
${alert.signalId?.outreachMessage}
          </div>
        </div>
        ` : ""}

        <p style="font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 15px; margin: 20px 0 0 0;">
          This is an automated alert resent by the system administrator.
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Career Spy 🕵️" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
      subject: `🔥 [RESENT ALERT] ${companyName} is hiring soon! (Hire Score: ${alert.hireScore})`,
      html: emailHtml
    });

    alert.emailStatus = "sent";
    alert.sentAt = new Date();
    await alert.save();

    res.json({ message: "Alert resent successfully", alert });
  } catch (error) {
    console.error("Resend alert error:", error);
    res.status(500).json({ message: "Failed to resend alert" });
  }
};

module.exports = {
  getAlerts,
  resendAlert
};
