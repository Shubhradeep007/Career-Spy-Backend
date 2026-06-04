const express = require("express");
const { protect } = require("../middleware/auth.middleware");
const Signal = require("../models/Signal.model");
const { transporter } = require("../services/emailService");

const router = express.Router();

router.use(protect);

// POST /api/signals/test-alert-email
// Sends a sample hiring alert email to the logged-in user's own email
router.post("/test-alert-email", async (req, res) => {
  try {
    const user = req.user;
    const plan = user.subscriptionStatus || "free";

    if (!["basic", "pro"].includes(plan)) {
      return res.status(403).json({
        message: `Email alerts are not available on the ${plan.toUpperCase()} plan. Upgrade to Basic or Pro to receive email alerts.`
      });
    }

    const sampleHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #1e3a8a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px; text-align: center;">🕵️ Career Spy Alert — TEST EMAIL</h2>
        <p style="font-size: 16px; color: #374151;">Hi <strong>${user.name || user.email}</strong>! This is a <strong>test alert email</strong> from Career Spy.</p>
        <div style="margin: 20px 0; background-color: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0;">
          <span style="font-size: 28px; font-weight: bold; color: #ef4444;">87</span>
          <span style="display: inline-block; background-color: #fecaca; color: #991b1b; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: bold; text-transform: uppercase; margin-left: 12px;">HOT</span>
          <p style="margin: 8px 0 0 0; color: #64748b; font-size: 13px;">AI Hire Score Verdict for <strong>Google India</strong> (Sample)</p>
        </div>
        <p style="color: #475569; font-size: 14px; background: #f1f5f9; padding: 12px; border-radius: 6px;">
          Google India is showing high hiring signals based on recent job postings, news activity, and GitHub commits. Now is the right time to apply.
        </p>
        <p style="font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 15px; margin: 20px 0 0 0;">
          ✅ Your email is correctly configured. Real alerts will arrive when a tracked company reaches a Hire Score ≥ 70.
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: `"Career Spy 🕵️" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: `✅ Career Spy — Test Alert Email (Your setup is working!)`,
      html: sampleHtml
    });

    res.json({
      success: true,
      message: `Test alert email sent to ${user.email}. Check your inbox (and spam folder).`
    });
  } catch (err) {
    console.error("Test email error:", err.message);
    res.status(500).json({ message: "Failed to send test email: " + err.message });
  }
});

// GET /api/signals/:companyId
router.get("/:companyId", async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const signals = await Signal.find({
      companyId: req.params.companyId,
      createdAt: { $gte: sevenDaysAgo }
    }).sort({ createdAt: 1 });

    res.json(signals);
  } catch (err) {
    res.status(500).json({ message: "Error fetching signals" });
  }
});

module.exports = router;
