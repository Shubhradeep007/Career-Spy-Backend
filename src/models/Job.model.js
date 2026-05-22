const mongoose = require("mongoose");

const JobSchema = new mongoose.Schema(
  {
    source: { type: String, default: "other" },
    sourceJobId: { type: String, required: true, unique: true },
    jobUrl: { type: String, required: true },
    title: { type: String, required: true },
    companyName: { type: String, required: true },
    location: { type: String, default: "" },
    isRemote: { type: Boolean, default: false },
    jobType: { type: String, default: "full-time" },
    salaryMin: { type: Number, default: null },
    salaryMax: { type: Number, default: null },
    salaryCurrency: { type: String, default: "INR" },
    salaryRaw: { type: String, default: null },
    description: { type: String, default: "" },
    skills: [{ type: String }],
    experienceMin: { type: Number, default: null },
    postedAt: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    matchScores: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        score: { type: Number, required: true },
        recommendation: { type: String, required: true },
        matchedSkills: [{ type: String }],
        missingSkills: [{ type: String }],
        reason: { type: String },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Job", JobSchema);
