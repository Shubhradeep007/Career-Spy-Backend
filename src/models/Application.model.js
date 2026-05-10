const mongoose = require("mongoose");

// Each status change is logged so user can see full history
const StatusHistorySchema = new mongoose.Schema({
    status: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
    note: { type: String, default: null },   // Optional note at this stage
}, { _id: false });

const ApplicationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },

    // ── Job Reference ─────────────────────────────────────
    // Either links to a JobPosting in our DB, or manually entered by user
    jobPosting: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "JobPosting",
        default: null,
    },

    // Manual entry fields (used when user adds a job not in our system)
    jobTitle: { type: String, required: true },  // "Senior Backend Developer"
    company: { type: String, required: true },  // "Swiggy"
    jobUrl: { type: String, default: null },
    location: { type: String, default: null },
    salaryRaw: { type: String, default: null },   // "18-24 LPA"

    // ── Pipeline Status ───────────────────────────────────
    status: {
        type: String,
        enum: [
            "saved",          // Bookmarked, not yet applied
            "applied",        // Application submitted
            "assessment",     // Online test / assignment received
            "interview_1",    // First round
            "interview_2",    // Second round
            "interview_3",    // Third round / final
            "offer",          // Offer received
            "accepted",       // Offer accepted
            "rejected",       // Rejected at any stage
            "withdrawn",      // User withdrew application
            "ghosted",        // No response after a long time
        ],
        default: "saved",
    },

    statusHistory: { type: [StatusHistorySchema], default: [] },

    // ── Dates ─────────────────────────────────────────────
    appliedAt: { type: Date, default: null },
    nextFollowUpAt: { type: Date, default: null },   // Reminder date
    offerDeadline: { type: Date, default: null },   // Offer acceptance deadline

    // ── Notes & Files ─────────────────────────────────────
    notes: { type: String, default: null },  // User's private notes
    coverLetterUrl: { type: String, default: null },  // Cloudinary URL
    resumeVersionUrl: { type: String, default: null },  // Which version of CV was sent

    // ── Contact ───────────────────────────────────────────
    recruiterName: { type: String, default: null },
    recruiterEmail: { type: String, default: null },
    recruiterLinkedIn: { type: String, default: null },

    // ── AI Match Score (snapshot at time of applying) ─────
    matchScore: { type: Number, default: null },  // 0–100
    recommendation: { type: String, default: null },  // "highly_recommended" etc.

}, { timestamps: true });

// ── Pre-save: Auto-log status changes ─────────────────────
ApplicationSchema.pre("save", function (next) {
    if (this.isModified("status")) {
        this.statusHistory.push({
            status: this.status,
            changedAt: new Date(),
        });
    }
    next();
});

// ── Indexes ───────────────────────────────────────────────
ApplicationSchema.index({ user: 1, status: 1 });
ApplicationSchema.index({ user: 1, createdAt: -1 });
ApplicationSchema.index({ nextFollowUpAt: 1 });  // For cron job reminders

module.exports = mongoose.model("Application", ApplicationSchema);