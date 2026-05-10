const express = require("express");
const router = express.Router();
const resumeController = require("../controllers/resume.controller");
const { protect } = require("../middleware/auth.middleware");
const { uploadResume } = require("../middleware/upload.middleware");

// All resume routes require login
router.use(protect);

// POST   /api/resume/upload  — upload + trigger AI parse
router.post("/upload", uploadResume.single("resume"), resumeController.uploadResume);

// GET    /api/resume/status  — poll parse status (lightweight)
router.get("/status", resumeController.getParseStatus);

// GET    /api/resume         — get full resume data
router.get("/", resumeController.getResume);

// PUT    /api/resume         — manually edit resume fields
router.put("/", resumeController.updateResume);

// DELETE /api/resume         — delete resume + cloudinary file
router.delete("/", resumeController.deleteResume);

module.exports = router;
