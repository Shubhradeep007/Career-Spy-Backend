const mongoose = require("mongoose");

const ApiLogSchema = new mongoose.Schema({
  apiName: { type: String, enum: ["Gemini", "NewsAPI", "Adzuna", "GitHub"], required: true },
  status: { type: String, enum: ["success", "failed"], required: true },
  errorReason: { type: String },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("ApiLog", ApiLogSchema);
