const express = require("express");
const { protect } = require("../middleware/auth.middleware");
const Signal = require("../models/Signal.model");

const router = express.Router();

router.use(protect);

// GET /api/signals/:companyId
router.get("/:companyId", async (req, res) => {
  try {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const signals = await Signal.find({
      companyId: req.params.companyId,
      createdAt: { $gte: sevenDaysAgo }
    }).sort({ createdAt: 1 });

    res.json(signals);
  } catch (err) {
    res.status(500).json({ message: "Error fetching signals" });
  }
});

module.exports = router;
