const { Server } = require("socket.io");
const SupportConversation = require("../models/SupportConversation.model");
const SupportMessage = require("../models/SupportMessage.model");

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      methods: ["GET", "POST"],
      credentials: true
    }
  });

  io.on("connection", (socket) => {
    console.log("🟢 Socket connected:", socket.id);

    // User joins their personal room
    socket.on("join_room", ({ userId }) => {
      if (userId) {
        socket.join(`user_${userId}`);
        console.log(`👤 User ${userId} joined room user_${userId}`);
      }
    });

    // Admin joins admin room
    socket.on("admin:join", ({ adminId }) => {
      if (adminId) {
        socket.join("admin_room");
        console.log(`🛡️ Admin ${adminId} joined admin_room`);
      }
    });

    // Support Chat: Typing Indicators
    socket.on("support:typing", ({ conversationId, isTyping, recipientId, senderRole }) => {
      if (senderRole === "user") {
        // Send typing indicator to admins
        socket.to("admin_room").emit("support:typing_indicator", { conversationId, isTyping });
      } else {
        // Send typing indicator to user
        socket.to(`user_${recipientId}`).emit("support:typing_indicator", { conversationId, isTyping });
      }
    });

    // Support Chat: Read Receipts
    socket.on("support:read", ({ conversationId, readerRole, userId }) => {
      if (readerRole === "admin") {
        socket.to(`user_${userId}`).emit("support:read_receipt", { conversationId });
      } else {
        socket.to("admin_room").emit("support:read_receipt", { conversationId });
      }
    });

    socket.on("disconnect", () => {
      console.log("🔴 Socket disconnected:", socket.id);
    });
  });

  return io;
};

const getIo = () => {
  if (!io) {
    throw new Error("Socket.io is not initialized!");
  }
  return io;
};

module.exports = { initSocket, getIo };
