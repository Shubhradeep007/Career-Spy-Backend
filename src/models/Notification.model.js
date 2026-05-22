const mongoose = require("mongoose");

const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["hire_alert", "cron_done", "system", "admin_reply"], required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "WatchedCompany" },
  hireScore: { type: Number },
  isRead: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model("Notification", NotificationSchema);
