const mongoose = require("mongoose");

const SupportConversationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  subject: { type: String, default: "" },
  status: { type: String, enum: ["open", "pending", "resolved"], default: "open" },
  isReadByAdmin: { type: Boolean, default: false },
  isReadByUser: { type: Boolean, default: true },
  lastMessageAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("SupportConversation", SupportConversationSchema);
