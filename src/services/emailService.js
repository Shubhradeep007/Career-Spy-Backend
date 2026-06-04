const nodemailer = require("nodemailer");

const port = parseInt(process.env.EMAIL_PORT, 10) || 587;
const secure = port === 465;

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: port,
  secure: secure, 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Patch sendMail to automatically rewrite sender to EMAIL_FROM when apikey/resend is used
const originalSendMail = transporter.sendMail.bind(transporter);
transporter.sendMail = function (mailOptions, callback) {
  const fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  
  if (mailOptions.from) {
    if (mailOptions.from.includes("<apikey>") || mailOptions.from.includes("<resend>")) {
      mailOptions.from = mailOptions.from.replace(/<apikey>/, `<${fromEmail}>`).replace(/<resend>/, `<${fromEmail}>`);
    } else if (process.env.EMAIL_USER && mailOptions.from.includes(`<${process.env.EMAIL_USER}>`)) {
      mailOptions.from = mailOptions.from.replace(new RegExp(`<${process.env.EMAIL_USER}>`), `<${fromEmail}>`);
    }
  } else {
    mailOptions.from = `"Career Spy" <${fromEmail}>`;
  }

  return originalSendMail(mailOptions, callback);
};

// Test connection on server start
transporter.verify((err, success) => {
  if (err) console.error("❌ Email connection failed:", err.message);
  else console.log("✅ Email server connected");
});

const fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER;

const sendVerificationEmail = async (to, name, token) => {
  const verifyUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

  await transporter.sendMail({
    from: `"Career Spy 🕵️" <${fromEmail}>`,
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
    from: `"Career Spy 🕵️" <${fromEmail}>`,
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