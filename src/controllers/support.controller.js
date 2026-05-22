const SupportConversation = require("../models/SupportConversation.model");
const SupportMessage = require("../models/SupportMessage.model");
const User = require("../models/User.model");
const { getIo } = require("../socket");

// --- User Support Endpoints ---

// POST /api/support/conversations
const createConversation = async (req, res) => {
  try {
    const { subject, initialMessage } = req.body;
    if (!initialMessage) {
      return res.status(400).json({ message: "Initial message is required" });
    }

    const conversation = await SupportConversation.create({
      userId: req.user._id,
      subject: subject || "Support Request",
      isReadByAdmin: false,
      isReadByUser: true,
      lastMessageAt: new Date()
    });

    const message = await SupportMessage.create({
      conversationId: conversation._id,
      senderId: req.user._id,
      senderRole: "user",
      content: initialMessage
    });

    // Notify Admins in real-time
    const io = getIo();
    io.to("admin_room").emit("admin:message_received", {
      userId: req.user._id,
      userName: req.user.name,
      preview: initialMessage.substring(0, 100)
    });

    res.status(201).json({ conversation, message });
  } catch (error) {
    console.error("Create conversation error:", error);
    res.status(500).json({ message: "Failed to create support ticket" });
  }
};

// GET /api/support/conversations
const getUserConversations = async (req, res) => {
  try {
    const conversations = await SupportConversation.find({ userId: req.user._id })
      .sort({ lastMessageAt: -1 });
    res.json(conversations);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch support tickets" });
  }
};

// GET /api/support/conversations/:id/messages
const getConversationMessages = async (req, res) => {
  try {
    const conversation = await SupportConversation.findOne({
      _id: req.params.id,
      $or: [{ userId: req.user._id }, { _id: { $exists: true } }] // Allow admin access
    });

    if (!conversation && req.user.role !== "admin") {
      return res.status(404).json({ message: "Conversation not found" });
    }

    const messages = await SupportMessage.find({ conversationId: req.params.id })
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch messages" });
  }
};

// POST /api/support/conversations/:id/messages
const sendMessage = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ message: "Content is required" });

    const conversation = await SupportConversation.findOne({
      _id: req.params.id,
      userId: req.user._id
    });

    if (!conversation) return res.status(404).json({ message: "Ticket not found" });

    const message = await SupportMessage.create({
      conversationId: conversation._id,
      senderId: req.user._id,
      senderRole: "user",
      content
    });

    conversation.lastMessageAt = new Date();
    conversation.isReadByUser = true;
    conversation.isReadByAdmin = false;
    await conversation.save();

    // Socket.io Real-time Push
    const io = getIo();
    io.to(`user_${req.user._id}`).emit("support:new_message", {
      conversationId: conversation._id,
      message
    });
    io.to("admin_room").emit("support:new_message", {
      conversationId: conversation._id,
      message
    });
    io.to("admin_room").emit("admin:message_received", {
      userId: req.user._id,
      userName: req.user.name,
      preview: content.substring(0, 100)
    });

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: "Failed to send message" });
  }
};

// PATCH /api/support/conversations/:id/read (User)
const markReadUser = async (req, res) => {
  try {
    const conversation = await SupportConversation.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isReadByUser: true },
      { new: true }
    );
    if (!conversation) return res.status(404).json({ message: "Ticket not found" });

    // Mark all admin messages in this conversation as read
    await SupportMessage.updateMany(
      { conversationId: conversation._id, senderRole: "admin" },
      { isRead: true }
    );

    res.json({ message: "Ticket marked as read by user", conversation });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark read" });
  }
};

// --- Admin Support Endpoints ---

// GET /api/admin/support/conversations (Paginated, filter by status)
const getConversationsAdmin = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { status } = req.query;

    const filter = {};
    if (status && status !== "all") filter.status = status;

    const total = await SupportConversation.countDocuments(filter);
    const conversations = await SupportConversation.find(filter)
      .populate("userId", "name email avatar")
      .sort({ lastMessageAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      conversations,
      total,
      pages: Math.ceil(total / limit),
      page
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch admin support inbox" });
  }
};

// POST /api/admin/support/conversations/:id/messages (Admin replies)
const sendReplyAdmin = async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ message: "Content is required" });

    const conversation = await SupportConversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: "Ticket not found" });

    const message = await SupportMessage.create({
      conversationId: conversation._id,
      senderId: req.user._id,
      senderRole: "admin",
      content
    });

    conversation.lastMessageAt = new Date();
    conversation.isReadByUser = false;
    conversation.isReadByAdmin = true;
    await conversation.save();

    // Socket.io Real-time Push
    const io = getIo();
    io.to(`user_${conversation.userId}`).emit("support:new_message", {
      conversationId: conversation._id,
      message
    });
    io.to("admin_room").emit("support:new_message", {
      conversationId: conversation._id,
      message
    });

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ message: "Failed to send admin reply" });
  }
};

// PATCH /api/admin/support/conversations/:id/status
const updateStatusAdmin = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !["open", "pending", "resolved"].includes(status)) {
      return res.status(400).json({ message: "Valid status is required" });
    }

    const conversation = await SupportConversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: "Ticket not found" });

    conversation.status = status;
    await conversation.save();

    const io = getIo();
    io.to(`user_${conversation.userId}`).emit("support:status_update", {
      conversationId: conversation._id,
      status
    });
    io.to("admin_room").emit("support:status_update", {
      conversationId: conversation._id,
      status
    });

    res.json({ message: `Ticket status updated to ${status}`, conversation });
  } catch (error) {
    res.status(500).json({ message: "Failed to update ticket status" });
  }
};

// PATCH /api/admin/support/conversations/:id/read (Admin)
const markReadAdmin = async (req, res) => {
  try {
    const conversation = await SupportConversation.findByIdAndUpdate(
      req.params.id,
      { isReadByAdmin: true },
      { new: true }
    );
    if (!conversation) return res.status(404).json({ message: "Ticket not found" });

    // Mark all user messages in this conversation as read
    await SupportMessage.updateMany(
      { conversationId: conversation._id, senderRole: "user" },
      { isRead: true }
    );

    res.json({ message: "Ticket marked as read by admin", conversation });
  } catch (error) {
    res.status(500).json({ message: "Failed to mark read" });
  }
};

// GET /api/admin/support/unread-count
const getUnreadCountAdmin = async (req, res) => {
  try {
    const count = await SupportConversation.countDocuments({ isReadByAdmin: false });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch unread ticket count" });
  }
};

module.exports = {
  createConversation,
  getUserConversations,
  getConversationMessages,
  sendMessage,
  markReadUser,
  getConversationsAdmin,
  sendReplyAdmin,
  updateStatusAdmin,
  markReadAdmin,
  getUnreadCountAdmin
};
