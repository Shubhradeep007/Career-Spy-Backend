const express = require("express");
const { protect } = require("../middleware/auth.middleware");
const {
  getChatSessions,
  getChatSessionById,
  deleteChatSession,
  sendMessageStream
} = require("../controllers/chat.controller");

const router = express.Router();

router.use(protect);

router.post("/message", sendMessageStream);
router.get("/history", getChatSessions);
router.get("/history/:sessionId", getChatSessionById);
router.delete("/history/:sessionId", deleteChatSession);

module.exports = router;
