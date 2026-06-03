const mongoose = require("mongoose");

const ResumeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    isParsed: { type: Boolean, default: false },
    parseError: { type: String, default: null },
    fileUrl: { type: String, default: null },
    fileName: { type: String, default: "Resume" },
    isActive: { type: Boolean, default: false },
    summary: { type: String, default: "" },
    currentJobTitle: { type: String, default: "" },
    currentLocation: { type: String, default: "" },
    totalExperienceYears: { type: Number, default: 0 },
    skills: {
      frontend: [{ type: String }],
      backend: [{ type: String }],
      dbms: [{ type: String }],
      os: [{ type: String }],
      devops: [{ type: String }],
      soft: [{ type: String }],
      languages: [{ type: String }],
      tools: [{ type: String }],
    },
    experience: [
      {
        title: { type: String },
        company: { type: String },
        location: { type: String, default: null },
        startDate: { type: String, default: null },
        endDate: { type: String, default: null },
        isCurrent: { type: Boolean, default: false },
        description: { type: String, default: "" },
      },
    ],
    education: [
      {
        degree: { type: String, default: null },
        institution: { type: String },
        location: { type: String, default: null },
        startDate: { type: String, default: null },
        endDate: { type: String, default: null },
        grade: { type: String, default: null },
      },
    ],
    preferredLocations: [{ type: String }],
    desiredRoles: [{ type: String }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Resume", ResumeSchema);
