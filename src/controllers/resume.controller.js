const Resume = require("../models/Resume.model");
const cloudinary = require("../config/cloudinary");
const { extractResumeText } = require("../utils/resumeParser");
const { parseResumeWithAI } = require("../utils/aiResumeParser");

// ── Helper: delete a raw file from Cloudinary ─────────────
const deleteCloudinaryRaw = async (fileUrl) => {
  if (!fileUrl || !fileUrl.includes("res.cloudinary.com")) return;
  try {
    const urlParts = fileUrl.split("/");
    const filenameWithExt = urlParts[urlParts.length - 1];
    const folderName = urlParts[urlParts.length - 2];
    const filename = filenameWithExt.split(".")[0];
    const publicId = `${folderName}/${filename}`;
    await cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
  } catch (err) {
    console.error("Cloudinary raw delete error:", err.message);
  }
};

// ── Helper: detect file type from mimetype ────────────────
const getFileType = (mimetype) => {
  if (mimetype === "application/pdf") return "pdf";
  if (mimetype === "application/msword") return "doc";
  if (mimetype.includes("wordprocessingml")) return "docx";
  return null;
};

class ResumeController {

  // POST /api/resume/upload
  // Accepts: multipart/form-data with field "resume"
  // Step 1: Save file to Cloudinary
  // Step 2: Extract text from PDF/DOCX
  // Step 3: Send to Claude for parsing
  // Step 4: Save structured data to DB
  async uploadResume(req, res) {
    if (!req.file) {
      return res.status(400).json({ message: "No resume file provided" });
    }

    const fileUrl = req.file.path;           // Cloudinary URL
    const fileType = getFileType(req.file.mimetype);

    if (!fileType) {
      return res.status(400).json({ message: "Unsupported file type" });
    }

    // If user already has a resume, delete the old Cloudinary file
    const existing = await Resume.findOne({ user: req.user._id });
    if (existing?.fileUrl) {
      await deleteCloudinaryRaw(existing.fileUrl);
    }

    // Upsert the resume document — mark as not yet parsed
    const resume = await Resume.findOneAndUpdate(
      { user: req.user._id },
      {
        user: req.user._id,
        fileUrl,
        fileType,
        isParsed: false,
        parseError: null,
        // Clear old parsed data on re-upload
        summary: null,
        currentJobTitle: null,
        currentLocation: null,
        totalExperienceYears: 0,
        skills: { frontend: [], backend: [], dbms: [], os: [], devops: [], soft: [], languages: [], tools: [] },
        experience: [],
        education: [],
        preferredLocations: [],
        desiredRoles: [],
      },
      { upsert: true, new: true }
    );

    // Respond immediately — parsing happens async
    res.status(202).json({
      message: "Resume uploaded. Parsing in progress...",
      resumeId: resume._id,
      fileUrl,
      isParsed: false,
    });

    // ── Background: Extract text + Parse with Claude ───────
    // We don't await this — user already got 202 response
    (async () => {
      try {
        const rawText = await extractResumeText(fileUrl, fileType);
        const parsed = await parseResumeWithAI(rawText);

        await Resume.findOneAndUpdate(
          { user: req.user._id },
          {
            ...parsed,
            isParsed: true,
            parsedAt: new Date(),
            parseError: null,
          }
        );

        console.log(`✅ Resume parsed for user ${req.user._id}`);
      } catch (err) {
        console.error(`❌ Resume parse failed for user ${req.user._id}:`, err.message);
        await Resume.findOneAndUpdate(
          { user: req.user._id },
          { isParsed: false, parseError: err.message }
        );
      }
    })();
  }

  // GET /api/resume
  // Returns the logged-in user's resume
  async getResume(req, res) {
    const resume = await Resume.findOne({ user: req.user._id });

    if (!resume) {
      return res.status(404).json({ message: "No resume found. Please upload one." });
    }

    res.json(resume);
  }

  // GET /api/resume/status
  // Lightweight poll endpoint — frontend checks if parsing is done
  async getParseStatus(req, res) {
    const resume = await Resume.findOne({ user: req.user._id })
      .select("isParsed parsedAt parseError fileUrl");

    if (!resume) {
      return res.status(404).json({ message: "No resume found" });
    }

    res.json({
      isParsed: resume.isParsed,
      parsedAt: resume.parsedAt,
      parseError: resume.parseError,
      fileUrl: resume.fileUrl,
    });
  }

  // PUT /api/resume
  // Allows user to manually edit parsed fields (skills, desiredRoles, etc.)
  async updateResume(req, res) {
    const allowed = [
      "summary", "currentJobTitle", "currentLocation",
      "skills", "experience", "education",
      "preferredLocations", "desiredRoles", "desiredSalary",
      "totalExperienceYears",
    ];

    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const resume = await Resume.findOneAndUpdate(
      { user: req.user._id },
      updates,
      { new: true }
    );

    if (!resume) {
      return res.status(404).json({ message: "No resume found. Please upload one first." });
    }

    res.json({ message: "Resume updated", resume });
  }

  // DELETE /api/resume
  // Deletes resume record + Cloudinary file
  async deleteResume(req, res) {
    const resume = await Resume.findOne({ user: req.user._id });

    if (!resume) {
      return res.status(404).json({ message: "No resume found" });
    }

    if (resume.fileUrl) {
      await deleteCloudinaryRaw(resume.fileUrl);
    }

    await Resume.findByIdAndDelete(resume._id);

    res.json({ message: "Resume deleted successfully" });
  }
}

module.exports = new ResumeController();
