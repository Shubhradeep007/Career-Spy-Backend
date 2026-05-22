const Notice = require("../../models/Notice.model");

// GET /api/admin/notices
const getNoticesAdmin = async (req, res) => {
  try {
    const notices = await Notice.find()
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 });
    res.json(notices);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch notices" });
  }
};

// POST /api/admin/notices
const createNotice = async (req, res) => {
  try {
    const { title, message, expiresAt } = req.body;
    if (!title || !message) {
      return res.status(400).json({ message: "Title and message are required" });
    }

    const notice = await Notice.create({
      title,
      message,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: req.user._id
    });

    res.status(201).json(notice);
  } catch (error) {
    res.status(500).json({ message: "Failed to create notice" });
  }
};

// PATCH /api/admin/notices/:id
const updateNotice = async (req, res) => {
  try {
    const { title, message, expiresAt, isActive } = req.body;
    const notice = await Notice.findById(req.params.id);
    if (!notice) return res.status(404).json({ message: "Notice not found" });

    if (title) notice.title = title;
    if (message) notice.message = message;
    if (expiresAt !== undefined) notice.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (isActive !== undefined) notice.isActive = isActive;

    await notice.save();
    res.json(notice);
  } catch (error) {
    res.status(500).json({ message: "Failed to update notice" });
  }
};

// DELETE /api/admin/notices/:id
const deleteNotice = async (req, res) => {
  try {
    const notice = await Notice.findByIdAndDelete(req.params.id);
    if (!notice) return res.status(404).json({ message: "Notice not found" });
    res.json({ message: "Notice deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete notice" });
  }
};

// GET /api/notices (Public/User)
const getActiveNoticesUser = async (req, res) => {
  try {
    const now = new Date();
    const notices = await Notice.find({
      isActive: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: null },
        { expiresAt: { $gt: now } }
      ]
    }).sort({ createdAt: -1 });

    res.json(notices);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch notices" });
  }
};

module.exports = {
  getNoticesAdmin,
  createNotice,
  updateNotice,
  deleteNotice,
  getActiveNoticesUser
};
