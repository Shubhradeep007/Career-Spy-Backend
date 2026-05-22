const mongoose = require("mongoose");

const WatchedCompanySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  companyName: { type: String, required: true },
  careerUrl: { type: String, default: "" },
  githubOrg: { type: String, default: "" },
  targetRole: { type: String, default: "" },
  alertActive: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model("WatchedCompany", WatchedCompanySchema);
