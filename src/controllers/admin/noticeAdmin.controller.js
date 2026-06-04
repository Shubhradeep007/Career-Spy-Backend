const Notice = require("../../models/Notice.model");
const User = require("../../models/User.model");
const Notification = require("../../models/Notification.model");
const { getIo } = require("../../socket");
const { transporter } = require("../../services/emailService");

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

    // Notify and Email all users asynchronously
    (async () => {
      try {
        const users = await User.find({ isBanned: false });
        const io = getIo();
        const notificationPromises = [];
        const emailPromises = [];

        const emailHtml = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <h2 style="color: #1e3a8a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px; text-align: center;">📢 Career Spy System Announcement</h2>
            <h3 style="color: #0f172a; font-size: 18px; margin-bottom: 10px;">${title}</h3>
            <p style="font-size: 15px; color: #374151; line-height: 1.6; background-color: #f8fafc; padding: 15px; border-radius: 8px; border-left: 4px solid #1e3a8a; white-space: pre-wrap;">${message}</p>
            
            <p style="font-size: 11px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 15px; margin-top: 25px;">
              This is an automated system broadcast. You can view all notices on your Career Spy Dashboard.
            </p>
          </div>
        `;

        for (const user of users) {
          notificationPromises.push(
            Notification.create({
              userId: user._id,
              type: "system",
              title: `Announcement: ${title}`,
              message: message
            }).then((notif) => {
              try {
                io.to(`user_${user._id}`).emit("notification:new", {
                  _id: notif._id,
                  type: "system",
                  title: `Announcement: ${title}`,
                  message: message,
                  createdAt: notif.createdAt,
                  isRead: false
                });
              } catch (socketErr) {
                console.error(`Failed to emit socket notification to user ${user._id}:`, socketErr.message);
              }
            })
          );

          if (user.email) {
            emailPromises.push(
              transporter.sendMail({
                from: `"Career Spy 🕵️" <${process.env.EMAIL_USER}>`,
                to: user.email,
                subject: `📢 Announcement: ${title}`,
                html: emailHtml
              }).catch((mailErr) => {
                console.error(`Failed to send announcement email to ${user.email}:`, mailErr.message);
              })
            );
          }
        }

        await Promise.all([...notificationPromises, ...emailPromises]);
        console.log(`📢 Notice broadcasted to ${users.length} users successfully.`);
      } catch (broadcastErr) {
        console.error("❌ Notice broadcast failed:", broadcastErr.message);
      }
    })();

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
