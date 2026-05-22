const mongoose = require("mongoose");

const CronLogSchema = new mongoose.Schema({
  runAt: { type: Date, required: true },
  status: { type: String, enum: ["success", "failed", "partial"], required: true },
  companiesProcessed: { type: Number, default: 0 },
  alertsTriggered: { type: Number, default: 0 },
  errorMessages: { type: [String], default: [] },
  durationMs: { type: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model("CronLog", CronLogSchema);
