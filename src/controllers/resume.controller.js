const Resume = require("../models/Resume.model");
const ApiLog = require("../models/ApiLog.model");
const { extractResumeText } = require("../utils/resumeParser");
const { parseResumeWithAI } = require("../utils/aiResumeParser");

// Fetch active user resume (or fallback to latest)
exports.getResume = async (req, res) => {
  let resume = await Resume.findOne({ userId: req.user._id, isActive: true });
  if (!resume) {
    resume = await Resume.findOne({ userId: req.user._id }).sort({ updatedAt: -1 });
  }
  if (!resume) {
    return res.status(404).json({ message: "Resume not found. Please upload your resume first." });
  }
  res.json(resume);
};

// Fetch all resumes for the user
exports.getAllResumes = async (req, res) => {
  try {
    const resumes = await Resume.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json(resumes);
  } catch (err) {
    res.status(500).json({ message: "Error fetching resumes list" });
  }
};

// Upload CV and trigger async parse
exports.uploadResume = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No resume file provided." });
  }

  try {
    // Enforce resume limits based on subscription plan
    const sub = req.user.subscriptionStatus || "free";
    const limits = { free: 1, basic: 2, pro: Infinity };
    const maxResumes = limits[sub] || 1;

    const count = await Resume.countDocuments({ userId: req.user._id });
    if (count >= maxResumes) {
      return res.status(400).json({
        message: `Resume upload limit reached. Your ${sub.toUpperCase()} plan allows up to ${maxResumes} resume(s). Please upgrade in Billing settings to upload more.`
      });
    }

    const fileUrl = req.file.path; // Cloudinary URL
    const originalName = req.file.originalname || "";
    const ext = originalName.split(".").pop().toLowerCase();

    // Deactivate all existing resumes
    await Resume.updateMany({ userId: req.user._id }, { isActive: false });

    // Create new Resume document set as active
    const resume = new Resume({
      userId: req.user._id,
      fileUrl,
      fileName: originalName,
      isActive: true,
      isParsed: false,
      parseError: null
    });

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
  } catch (err) {
    res.status(500).json({ message: "Failed to upload resume and setup document structure." });
  }
};

// Polling status endpoint
exports.getResumeStatus = async (req, res) => {
  let resume = await Resume.findOne({ userId: req.user._id, isActive: true });
  if (!resume) {
    resume = await Resume.findOne({ userId: req.user._id }).sort({ updatedAt: -1 });
  }
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
  const resume = await Resume.findOne({ _id: req.params.id, userId: req.user._id });
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

// Activate a specific resume
exports.selectResume = async (req, res) => {
  try {
    const resume = await Resume.findOne({ _id: req.params.id, userId: req.user._id });
    if (!resume) {
      return res.status(404).json({ message: "Resume not found." });
    }

    // Set all other resumes of this user to inactive
    await Resume.updateMany({ userId: req.user._id }, { isActive: false });

    // Set this resume to active
    resume.isActive = true;
    await resume.save();

    res.json({ message: "Resume set as active.", resume });
  } catch (err) {
    res.status(500).json({ message: "Error activating resume." });
  }
};

// Delete a specific resume
exports.deleteResume = async (req, res) => {
  try {
    const resume = await Resume.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!resume) {
      return res.status(404).json({ message: "Resume not found." });
    }

    // If the deleted resume was active, set another one as active (if available)
    if (resume.isActive) {
      const nextResume = await Resume.findOne({ userId: req.user._id }).sort({ updatedAt: -1 });
      if (nextResume) {
        nextResume.isActive = true;
        await nextResume.save();
      }
    }

    res.json({ message: "Resume deleted successfully." });
  } catch (err) {
    res.status(500).json({ message: "Error deleting resume." });
  }
};
