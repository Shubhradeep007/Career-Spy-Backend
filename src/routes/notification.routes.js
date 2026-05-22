const express = require("express");
const { protect } = require("../middleware/auth.middleware");
const Notification = require("../models/Notification.model");

const router = express.Router();

router.use(protect);

// GET /api/notifications
router.get("/", async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50);
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ message: "Error fetching notifications" });
  }
});

module.exports = router;
