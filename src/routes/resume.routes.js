const express = require("express");
const { protect } = require("../middleware/auth.middleware");
const { uploadResume } = require("../middleware/upload.middleware");
const { getResume, uploadResume: uploadResumeController, getResumeStatus, updateResume } = require("../controllers/resume.controller");

const router = express.Router();

router.use(protect);

router.route("/")
  .get(getResume)
  .put(updateResume);

router.post("/upload", uploadResume.single("resume"), uploadResumeController);
router.get("/status", getResumeStatus);

module.exports = router;
