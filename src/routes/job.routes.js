const express = require("express");
const router = express.Router();
const jobController = require("../controllers/job.controller");
const { protect } = require("../middleware/auth.middleware");

// All job routes require login
router.use(protect);

// POST  /api/jobs/search        — search + fetch + AI score jobs
router.post("/search", jobController.searchJobs);

// GET   /api/jobs/recommended   — only 80%+ match jobs
router.get("/recommended", jobController.getRecommendedJobs);

// GET   /api/jobs               — all scored jobs (sorted by match %)
router.get("/", jobController.getMyJobs);

// GET   /api/jobs/:id           — single job details
router.get("/:id", jobController.getJob);

module.exports = router;