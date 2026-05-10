require("express-async-errors");
const express = require("express");
const http = require("http");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app); // needed for Socket.io

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(express.json());

// Routes will go here
app.get("/", (req, res) => res.json({ message: "Career Spy API running" }));

const authRoutes = require("./routes/auth.routes");
app.use("/api/auth", authRoutes);

const resumeRoutes = require("./routes/resume.routes");
app.use("/api/resume", resumeRoutes);

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