require("express-async-errors");
const express = require("express");
const http = require("http");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();

// Globally sanitize environment variable URLs to prevent trailing slash issues
if (process.env.FRONTEND_URL) {
  process.env.FRONTEND_URL = process.env.FRONTEND_URL.replace(/\/$/, "");
}
if (process.env.BACKEND_URL) {
  process.env.BACKEND_URL = process.env.BACKEND_URL.replace(/\/$/, "");
}
if (process.env.CLIENT_URL) {
  process.env.CLIENT_URL = process.env.CLIENT_URL.replace(/\/$/, "");
}


const { startSpyCron } = require("./cron/spyCron");
const connectDB = require("./config/db");

connectDB();

const app = express();
const server = http.createServer(app); // needed for Socket.io
const { initSocket } = require("./socket");
const io = initSocket(server);

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());

const passport = require("./config/passport");
app.use(passport.initialize());


// Routes will go here
app.get("/", (req, res) => res.json({ message: "Career Spy API running" }));

startSpyCron();

const authRoutes = require("./routes/auth.routes");
app.use("/api/auth", authRoutes);

const companyRoutes = require("./routes/company.routes");
app.use("/api/companies", companyRoutes);
const signalRoutes = require("./routes/signal.routes");
app.use("/api/signals", signalRoutes);

const notificationRoutes = require("./routes/notification.routes");
app.use("/api/notifications", notificationRoutes);
const noticeRoutes = require("./routes/notice.routes");
app.use("/api/notices", noticeRoutes);
const supportRoutes = require("./routes/support.routes");
app.use("/api/support", supportRoutes);
const chatRoutes = require("./routes/chat.routes");
app.use("/api/chat", chatRoutes);
const adminRoutes = require("./routes/admin.routes");
app.use("/api/admin", adminRoutes);
const resumeRoutes = require("./routes/resume.routes");
app.use("/api/resume", resumeRoutes);
const jobRoutes = require("./routes/job.routes");
app.use("/api/jobs", jobRoutes);
const paymentRoutes = require("./routes/payment.routes");
app.use("/api/payments", paymentRoutes);


// Global error handler
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ message: err.message || "Server Error" });
});

const { transporter } = require("./services/emailService");

app.get("/test-email", async (req, res) => {
  await transporter.sendMail({
    from: `"Career Spy" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER, // sends to yourself
    subject: "Test Email",
    html: "<h2>Email is working ✅</h2>",
  });
  res.json({ message: "Test email sent — check your inbox" });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = { app, server }; // export for Socket.io