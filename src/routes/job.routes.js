const express = require("express");
const { protect } = require("../middleware/auth.middleware");
const { searchJobs, getRecommendedJobs } = require("../controllers/job.controller");

const router = express.Router();

router.use(protect);

router.post("/search", searchJobs);
router.get("/recommended", getRecommendedJobs);

module.exports = router;
