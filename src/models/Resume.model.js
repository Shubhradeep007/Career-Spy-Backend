const mongoose = require("mongoose");

const ExperienceSchema = new mongoose.Schema({
    title: { type: String, required: true },   // "Software Engineer"
    company: { type: String, required: true },   // "Google"
    location: { type: String, default: null },    // "Bangalore, India"
    startDate: { type: String, default: null },    // "Jan 2022"
    endDate: { type: String, default: null },    // "Mar 2024" or null = current
    isCurrent: { type: Boolean, default: false },
    description: { type: String, default: null },    // bullet points / summary
}, { _id: false });

const EducationSchema = new mongoose.Schema({
    degree: { type: String, default: null },    // "B.Tech Computer Science"
    institution: { type: String, required: true },   // "IIT Bombay"
    location: { type: String, default: null },
    startDate: { type: String, default: null },
    endDate: { type: String, default: null },
    grade: { type: String, default: null },    // "8.5 CGPA" or "85%"
}, { _id: false });

const ResumeSchema = new mongoose.Schema({
    // One resume per user (we enforce this with unique index)
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        unique: true,   // Each user has exactly one active resume
    },

    // Raw file stored on Cloudinary
    fileUrl: { type: String, default: null },      // PDF/DOCX URL
    fileType: { type: String, enum: ["pdf", "docx", "doc"], default: null },

    // ── AI-Parsed Fields ─────────────────────────────────
    // These are filled by Claude after the file is uploaded

    summary: { type: String, default: null },     // Professional summary / objective

    skills: {
        frontend: { type: [String], default: [] }, // ["React","HTML","CSS"]
        backend: { type: [String], default: [] }, // ["Node.js","Spring Boot"]
        dbms: { type: [String], default: [] }, // ["MongoDB","MySQL"]
        os: { type: [String], default: [] }, // ["Linux","Windows"]
        devops: { type: [String], default: [] }, // ["Docker","AWS"]
        soft: { type: [String], default: [] }, // ["Leadership","Communication"]
        languages: { type: [String], default: [] }, // ["English","Hindi"]
        tools: { type: [String], default: [] }, // ["Git","Postman","Figma"]
    },

    experience: { type: [ExperienceSchema], default: [] },
    education: { type: [EducationSchema], default: [] },

    // ── Meta ─────────────────────────────────────────────
    totalExperienceYears: { type: Number, default: 0 },  // Calculated by AI, e.g. 2.5
    currentJobTitle: { type: String, default: null }, // "Full Stack Developer"
    currentLocation: { type: String, default: null }, // "Kolkata, India"
    preferredLocations: { type: [String], default: [] }, // ["Remote","Bangalore"]

    // Desired roles/domains — user can set this manually too
    desiredRoles: { type: [String], default: [] },  // ["Backend Dev","DevOps"]
    desiredSalary: { type: String, default: null },  // "12-18 LPA"

    // ── Parse Status ──────────────────────────────────────
    isParsed: { type: Boolean, default: false },    // false = file uploaded, not yet parsed
    parsedAt: { type: Date, default: null },        // When AI parsing completed
    parseError: { type: String, default: null },      // Error message if parsing failed

}, { timestamps: true });

module.exports = mongoose.model("Resume", ResumeSchema);