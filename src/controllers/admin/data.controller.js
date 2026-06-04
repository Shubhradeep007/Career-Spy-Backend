const User = require("../../models/User.model");
const WatchedCompany = require("../../models/WatchedCompany.model");
const Signal = require("../../models/Signal.model");
const Alert = require("../../models/Alert.model");
const Notification = require("../../models/Notification.model");
const ChatSession = require("../../models/ChatSession.model");
const SupportConversation = require("../../models/SupportConversation.model");
const SupportMessage = require("../../models/SupportMessage.model");
const bcrypt = require("bcryptjs");
const { transporter } = require("../../services/emailService");

// GET /api/admin/users
const getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }

    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const usersWithStats = await Promise.all(
      users.map(async (u) => {
        const companyCount = await WatchedCompany.countDocuments({ userId: u._id });
        const alertCount = await Alert.countDocuments({ userId: u._id });
        return {
          ...u.toObject(),
          companyCount,
          alertCount
        };
      })
    );

    res.json({
      users: usersWithStats,
      total,
      pages: Math.ceil(total / limit),
      page
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

// GET /api/admin/users/:id
const getUserDetails = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    const watchedCompanies = await WatchedCompany.find({ userId: user._id });
    
    // Populate latest signals
    const companiesWithSignals = await Promise.all(
      watchedCompanies.map(async (c) => {
        const latestSignal = await Signal.findOne({ companyId: c._id }).sort({ createdAt: -1 });
        return { ...c.toObject(), latestSignal };
      })
    );

    const alerts = await Alert.find({ userId: user._id })
      .populate("companyId", "companyName")
      .sort({ createdAt: -1 });

    res.json({
      user,
      watchedCompanies: companiesWithSignals,
      alerts
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch user details" });
  }
};

// PATCH /api/admin/users/:id/ban
const banUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.isBanned = !user.isBanned;
    await user.save();

    res.json({ message: `User ${user.isBanned ? 'banned' : 'unbanned'} successfully`, user });
  } catch (error) {
    res.status(500).json({ message: "Failed to update user ban status" });
  }
};

// DELETE /api/admin/users/:id
const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Fetch watched companies for signal and alert deletion
    const watchedCompanies = await WatchedCompany.find({ userId });
    const companyIds = watchedCompanies.map((c) => c._id);

    // Delete associated data in cascades
    await Signal.deleteMany({ companyId: { $in: companyIds } });
    await Alert.deleteMany({ userId });
    await WatchedCompany.deleteMany({ userId });
    await Notification.deleteMany({ userId });
    await ChatSession.deleteMany({ userId });
    await SupportMessage.deleteMany({ senderId: userId });
    
    const supportConversations = await SupportConversation.find({ userId });
    const conversationIds = supportConversations.map((c) => c._id);
    await SupportMessage.deleteMany({ conversationId: { $in: conversationIds } });
    await SupportConversation.deleteMany({ userId });

    // Finally, delete the User
    await User.findByIdAndDelete(userId);

    res.json({ message: "User and all associated data deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: "Failed to delete user and associated data" });
  }
};

// PATCH /api/admin/users/:id/reset-password
const resetUserPassword = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Generate a random password
    const tempPassword = Math.random().toString(36).slice(-10) + "A1!";
    user.password = await bcrypt.hash(tempPassword, 10);
    await user.save();

    // Send email with temporary credentials
    await transporter.sendMail({
      from: `"Career Spy Admin" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Your password has been reset by the Admin",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;border:1px solid #e2e8f0;padding:20px;border-radius:8px;">
          <h2>Password Reset Notice 🔑</h2>
          <p>Hello ${user.name},</p>
          <p>An administrator has reset your Career Spy password.</p>
          <div style="background:#f1f5f9;padding:12px;border-radius:6px;font-family:monospace;font-size:16px;text-align:center;margin:16px 0;">
            <strong>${tempPassword}</strong>
          </div>
          <p>Please use this temporary password to log in. We recommend updating your password immediately after logging in.</p>
          <p style="color:#64748b;font-size:12px;">If you have any questions, please contact support.</p>
        </div>
      `
    });

    res.json({ message: "Password reset successfully and email sent to user" });
  } catch (error) {
    console.error("Password reset error:", error);
    res.status(500).json({ message: "Failed to reset password" });
  }
};

// GET /api/admin/companies
const getCompanies = async (req, res) => {
  try {
    const search = req.query.search || "";
    const filter = {};
    if (search) {
      filter.companyName = { $regex: search, $options: "i" };
    }

    const companies = await WatchedCompany.find(filter)
      .populate("userId", "name email")
      .sort({ createdAt: -1 });

    const companiesWithStats = await Promise.all(
      companies.map(async (c) => {
        const signalCount = await Signal.countDocuments({ companyId: c._id });
        const popularity = await WatchedCompany.countDocuments({
          companyName: { $regex: `^${c.companyName}$`, $options: "i" }
        });
        return {
          ...c.toObject(),
          signalCount,
          popularity
        };
      })
    );

    res.json(companiesWithStats);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch companies" });
  }
};

// PATCH /api/admin/users/:id/cancel-subscription
const cancelUserSubscription = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.subscriptionStatus = "free";
    user.razorpayOrderId = null;
    user.razorpayPaymentId = null;
    await user.save();

    res.json({ message: "Subscription cancelled successfully", user });
  } catch (error) {
    res.status(500).json({ message: "Failed to cancel user subscription" });
  }
};

module.exports = { getUsers, getUserDetails, banUser, deleteUser, resetUserPassword, getCompanies, cancelUserSubscription };
