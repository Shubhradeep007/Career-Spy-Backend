const Resume = require("../models/Resume.model");
const ApiLog = require("../models/ApiLog.model");
const { extractResumeText } = require("../utils/resumeParser");
const { parseResumeWithAI } = require("../utils/aiResumeParser");

// Fetch active user resume
exports.getResume = async (req, res) => {
  const resume = await Resume.findOne({ userId: req.user._id });
  if (!resume) {
    return res.status(404).json({ message: "Resume not found. Please upload your resume first." });
  }
  res.json(resume);
};

// Upload CV and trigger async parse
exports.uploadResume = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No resume file provided." });
  }

  const fileUrl = req.file.path; // Cloudinary URL
  const originalName = req.file.originalname || "";
  const ext = originalName.split(".").pop().toLowerCase();

  // Find or create Resume document
  let resume = await Resume.findOne({ userId: req.user._id });
  if (!resume) {
    resume = new Resume({ userId: req.user._id });
  }

  resume.fileUrl = fileUrl;
  resume.isParsed = false;
  resume.parseError = null;
  await resume.save();

  // Run parsing asynchronously in background
  const runParser = async () => {
    try {
      // Step 1: Plain text extraction
      const rawText = await extractResumeText(fileUrl, ext);
      
      // Step 2: AI Parsing (Gemini)
      const parsedData = await parseResumeWithAI(rawText);

      // Save success log
      await ApiLog.create({ apiName: "Gemini", status: "success" });

      // Step 3: Populate database model
      resume.summary = parsedData.summary || "";
      resume.currentJobTitle = parsedData.currentJobTitle || "";
      resume.currentLocation = parsedData.currentLocation || "";
      resume.totalExperienceYears = parsedData.totalExperienceYears || 0;
      resume.skills = {
        frontend: parsedData.skills?.frontend || [],
        backend: parsedData.skills?.backend || [],
        dbms: parsedData.skills?.dbms || [],
        os: parsedData.skills?.os || [],
        devops: parsedData.skills?.devops || [],
        soft: parsedData.skills?.soft || [],
        languages: parsedData.skills?.languages || [],
        tools: parsedData.skills?.tools || [],
      };
      resume.experience = parsedData.experience || [];
      resume.education = parsedData.education || [];
      resume.preferredLocations = parsedData.preferredLocations || [];
      resume.desiredRoles = parsedData.desiredRoles || [];
      resume.isParsed = true;
      resume.parseError = null;
      await resume.save();
    } catch (error) {
      console.error("❌ Background resume parser error:", error);
      
      // Save failure log
      await ApiLog.create({
        apiName: "Gemini",
        status: "failed",
        errorReason: error.message || "Failed during resume parsing",
      });

      resume.isParsed = false;
      resume.parseError = error.message || "Failed to extract CV content";
      await resume.save();
    }
  };

  // Run in background
  runParser();

  res.json({
    message: "Resume uploaded successfully. Parsing in progress...",
    fileUrl,
    isParsed: false,
  });
};

// Polling status endpoint
exports.getResumeStatus = async (req, res) => {
  const resume = await Resume.findOne({ userId: req.user._id });
  if (!resume) {
    return res.status(404).json({ message: "Resume not found." });
  }
  res.json({
    isParsed: resume.isParsed,
    parseError: resume.parseError,
  });
};

// Manually update parsed profile details
exports.updateResume = async (req, res) => {
  const resume = await Resume.findOne({ userId: req.user._id });
  if (!resume) {
    return res.status(404).json({ message: "Resume not found." });
  }

  // Update provided fields
  const updatableFields = [
    "summary",
    "currentJobTitle",
    "currentLocation",
    "totalExperienceYears",
    "skills",
    "experience",
    "education",
    "preferredLocations",
    "desiredRoles",
  ];

  updatableFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      resume[field] = req.body[field];
    }
  });

  await resume.save();
  res.json({ message: "Profile updated successfully.", resume });
};
