const mongoose = require("mongoose");

const SignalSchema = new mongoose.Schema({
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "WatchedCompany", required: true },
  jobsPosted: { type: Number, default: 0 },
  newsCount: { type: Number, default: 0 },
  githubActivity: { type: Number, default: 0 },
  careerPageScore: { type: Number, default: 0 },
  hireScore: { type: Number, default: 0 },
  verdict: { type: String, enum: ["HOT", "WARM", "COLD"], default: "COLD" },
  aiSummary: { type: String, default: "" },
  aiAction: { type: String, default: "" },
  outreachMessage: { type: String, default: "" },
  alertSent: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model("Signal", SignalSchema);
