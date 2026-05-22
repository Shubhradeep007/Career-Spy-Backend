const mongoose = require("mongoose");

const AlertSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "WatchedCompany", required: true },
  signalId: { type: mongoose.Schema.Types.ObjectId, ref: "Signal", required: true },
  hireScore: { type: Number, required: true },
  verdict: { type: String, required: true },
  emailStatus: { type: String, enum: ["sent", "failed", "pending"], default: "pending" },
  sentAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model("Alert", AlertSchema);
