const express = require("express");
const { protect } = require("../middleware/auth.middleware");
const { uploadResume } = require("../middleware/upload.middleware");
const {
  getResume,
  uploadResume: uploadResumeController,
  getResumeStatus,
  updateResume,
  getAllResumes,
  selectResume,
  deleteResume
} = require("../controllers/resume.controller");

const router = express.Router();

router.use(protect);

router.route("/")
  .get(getResume);

router.get("/all", getAllResumes);
router.post("/upload", uploadResume.single("resume"), uploadResumeController);
router.get("/status", getResumeStatus);

router.patch("/:id/select", selectResume);

router.route("/:id")
  .put(updateResume)
  .delete(deleteResume);

module.exports = router;
