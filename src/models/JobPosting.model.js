const mongoose = require("mongoose");

const JobPostingSchema = new mongoose.Schema({
    // ── Source ────────────────────────────────────────────
    source: {
        type: String,
        enum: ["naukri", "foundit", "linkedin", "company_site", "internshala", "other"],
        required: true,
    },
    sourceJobId: { type: String, default: null },  // Original job ID from the source platform
    jobUrl: { type: String, required: true },  // Direct link to the job posting

    // ── Job Details ───────────────────────────────────────
    title: { type: String, required: true },  // "Backend Engineer"
    company: { type: String, required: true },  // "Razorpay"
    companyRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Company",
        default: null,                               // Set if company is in any user's watchlist
    },
    location: { type: String, default: null },   // "Bangalore / Remote"
    isRemote: { type: Boolean, default: false },
    jobType: {
        type: String,
        enum: ["full-time", "part-time", "contract", "internship", "freelance"],
        default: "full-time",
    },

    // ── Salary ────────────────────────────────────────────
    salaryMin: { type: Number, default: null },   // In LPA (e.g. 12)
    salaryMax: { type: Number, default: null },   // In LPA (e.g. 18)
    salaryCurrency: { type: String, default: "INR" },
    salaryRaw: { type: String, default: null },   // "12-18 LPA" (raw string from source)

    // ── Requirements ──────────────────────────────────────
    description: { type: String, default: null },   // Full JD text
    skills: { type: [String], default: [] },   // ["Node.js", "MongoDB", "AWS"]
    experienceMin: { type: Number, default: null },  // In years
    experienceMax: { type: Number, default: null },
    educationRequired: { type: String, default: null }, // "B.Tech / MCA"

    // ── AI Match Score (per user) ─────────────────────────
    // Stored separately in a sub-collection for scalability
    // But we cache the top score here for quick filtering
    matchScores: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        score: { type: Number, min: 0, max: 100 },  // 0–100
        recommendation: {
            type: String,
            enum: ["highly_recommended", "good_match", "partial_match", "low_match"],
        },
        matchedSkills: { type: [String], default: [] },   // Skills that matched
        missingSkills: { type: [String], default: [] },   // Skills user lacks
        scoredAt: { type: Date, default: Date.now },
    }],

    // ── Status ────────────────────────────────────────────
    isActive: { type: Boolean, default: true },   // false = job no longer available
    postedAt: { type: Date, default: null },       // When the job was posted on source
    expiresAt: { type: Date, default: null },       // When the job listing expires

}, { timestamps: true });

// ── Indexes for fast querying ──────────────────────────────
JobPostingSchema.index({ source: 1, sourceJobId: 1 }, { unique: true, sparse: true }); // Prevent duplicates
JobPostingSchema.index({ company: 1 });
JobPostingSchema.index({ skills: 1 });
JobPostingSchema.index({ isActive: 1, postedAt: -1 });
JobPostingSchema.index({ "matchScores.user": 1, "matchScores.score": -1 });

module.exports = mongoose.model("JobPosting", JobPostingSchema);