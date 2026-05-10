const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // false for port 587 (TLS), true for 465 (SSL)
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Test connection on server start
transporter.verify((err, success) => {
  if (err) console.error("❌ Email connection failed:", err.message);
  else console.log("✅ Email server connected");
});

const sendVerificationEmail = async (to, name, token) => {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

  await transporter.sendMail({
    from: `"Career Spy 🕵️" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Verify your Career Spy account",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;">
        <h2>Hey ${name} 👋</h2>
        <p>Thanks for signing up! Click the button below to verify your email.</p>
        <a href="${verifyUrl}" style="
          background:#1F3864;color:white;padding:12px 24px;
          border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0;
        ">Verify Email</a>
        <p>This link expires in <strong>24 hours</strong>.</p>
        <p style="color:#999;font-size:12px;">If you did not sign up for Career Spy, ignore this email.</p>
      </div>
    `,
  });
};

const sendPasswordResetEmail = async (to, name, token) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: `"Career Spy 🕵️" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Reset your Career Spy password",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;">
        <h2>Hey ${name} 👋</h2>
        <p>Click the button below to reset your password.</p>
        <a href="${resetUrl}" style="
          background:#1F3864;color:white;padding:12px 24px;
          border-radius:6px;text-decoration:none;display:inline-block;margin:16px 0;
        ">Reset Password</a>
        <p>This link expires in <strong>1 hour</strong>.</p>
        <p style="color:#999;font-size:12px;">If you did not request this, ignore this email.</p>
      </div>
    `,
  });
};

module.exports = { transporter, sendVerificationEmail, sendPasswordResetEmail };