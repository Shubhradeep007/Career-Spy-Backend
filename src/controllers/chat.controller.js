const ChatSession = require("../models/ChatSession.model");
const { generateChatResponseStream } = require("../services/chatService");

// GET /api/chat/history
const getChatSessions = async (req, res) => {
  try {
    const sessions = await ChatSession.find({ userId: req.user._id })
      .sort({ updatedAt: -1 });
    res.json(sessions);
  } catch (error) {
    console.error("Get chat sessions error:", error);
    res.status(500).json({ message: "Failed to fetch chat history" });
  }
};

// GET /api/chat/history/:sessionId
const getChatSessionById = async (req, res) => {
  try {
    const session = await ChatSession.findOne({
      _id: req.params.sessionId,
      userId: req.user._id
    });
    if (!session) {
      return res.status(404).json({ message: "Chat session not found" });
    }
    res.json(session);
  } catch (error) {
    console.error("Get chat session error:", error);
    res.status(500).json({ message: "Failed to fetch chat session details" });
  }
};

// DELETE /api/chat/history/:sessionId
const deleteChatSession = async (req, res) => {
  try {
    const session = await ChatSession.findOneAndDelete({
      _id: req.params.sessionId,
      userId: req.user._id
    });
    if (!session) {
      return res.status(404).json({ message: "Chat session not found" });
    }
    res.json({ message: "Chat session deleted successfully" });
  } catch (error) {
    console.error("Delete chat session error:", error);
    res.status(500).json({ message: "Failed to delete chat session" });
  }
};

// POST /api/chat/message (SSE Stream)
const sendMessageStream = async (req, res) => {
  const { query, sessionId } = req.body;

  if (!query) {
    return res.status(400).json({ message: "Query is required" });
  }

  let session;
  try {
    if (sessionId) {
      session = await ChatSession.findOne({ _id: sessionId, userId: req.user._id });
    }

    if (!session) {
      session = await ChatSession.create({
        userId: req.user._id,
        messages: []
      });
    }

    // Map existing messages to history format
    const history = session.messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      content: m.content
    }));

    // Generate response stream
    const stream = await generateChatResponseStream(req.user._id, query, history);

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    let fullResponse = "";
    for await (const chunk of stream) {
      const text = chunk.text();
      fullResponse += text;
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }

    // Save user and assistant messages to database
    session.messages.push({ role: "user", content: query });
    session.messages.push({ role: "assistant", content: fullResponse });
    await session.save();

    // Signal completion and send session metadata
    res.write(`data: ${JSON.stringify({ done: true, sessionId: session._id })}\n\n`);
    res.end();

  } catch (error) {
    console.error("Chat SSE stream error:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: error.message || "Chat stream processing failed" });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message || "Stream interrupted" })}\n\n`);
      res.end();
    }
  }
};

module.exports = {
  getChatSessions,
  getChatSessionById,
  deleteChatSession,
  sendMessageStream
};
