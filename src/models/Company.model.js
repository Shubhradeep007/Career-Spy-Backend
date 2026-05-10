const mongoose = require("mongoose");

const CompanySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },

    // ── Basic Info ────────────────────────────────────────
    name: { type: String, required: true, trim: true },  // "Google"
    website: { type: String, default: null },               // "https://google.com"
    linkedinUrl: { type: String, default: null },               // LinkedIn company page
    domain: { type: String, default: null },               // "google.com" (auto-extracted from website, used for scraping news)

    // ── Industry / Size ───────────────────────────────────
    industry: { type: String, default: null },   // "Technology", "Fintech"
    size: {
        type: String,
        enum: ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+", null],
        default: null,
    },
    headquarters: { type: String, default: null },  // "San Francisco, USA"

    // ── Logo ──────────────────────────────────────────────
    logoUrl: { type: String, default: null },   // Fetched from Clearbit / scraping

    // ── Latest News (cached from last scrape) ─────────────
    // We store the last 5 news items per company to display in dashboard
    latestNews: [{
        title: { type: String },
        url: { type: String },
        source: { type: String },          // "TechCrunch", "Economic Times"
        publishedAt: { type: Date },
        snippet: { type: String },          // Short summary
        category: {
            type: String,
            enum: ["funding", "hiring", "product", "layoff", "acquisition", "general"],
            default: "general",
        },
    }],
    lastNewsScrapedAt: { type: Date, default: null },

    // ── Open Roles (cached from last scrape) ──────────────
    openRolesCount: { type: Number, default: 0 },
    lastRolesScrapedAt: { type: Date, default: null },

    // ── User Preference ───────────────────────────────────
    isActive: { type: Boolean, default: true },  // User can pause monitoring
    addedAt: { type: Date, default: Date.now },

}, { timestamps: true });

// ── Indexes ───────────────────────────────────────────────
// Enforce max 10 companies per user at application level (controller check)
// Prevent duplicate company per user
CompanySchema.index({ user: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Company", CompanySchema);