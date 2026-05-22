const express = require("express");
const { protect } = require("../middleware/auth.middleware");
const {
  createConversation,
  getUserConversations,
  getConversationMessages,
  sendMessage,
  markReadUser
} = require("../controllers/support.controller");

const router = express.Router();

router.use(protect);

router.route("/conversations")
  .post(createConversation)
  .get(getUserConversations);

router.route("/conversations/:id/messages")
  .get(getConversationMessages)
  .post(sendMessage);

router.patch("/conversations/:id/read", markReadUser);

module.exports = router;
