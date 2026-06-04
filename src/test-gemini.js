const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

async function run() {
  const apiKey = process.env.GEMINI_API_KEY;
  console.log("Using API Key:", apiKey ? `${apiKey.substring(0, 8)}...` : "NONE");
  if (!apiKey) {
    console.error("No API key found in process.env");
    return;
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  console.log("\n--- Listing Models ---");
  try {
    const axios = require("axios");
    const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    for (const m of response.data.models) {
      console.log(`Model Name: ${m.name}`);
    }
  } catch (err) {
    console.error("Error listing models:", err.response ? err.response.data : err.message);
  }

  const testModels = [
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash"
  ];

  console.log("\n--- Testing Model Generations ---");
  for (const modelName of testModels) {
    try {
      console.log(`\nTesting model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent("Hello. Say 'OK'.");
      console.log(`[${modelName}] Success:`, result.response.text().trim());
    } catch (err) {
      console.error(`[${modelName}] Error:`, err.message);
    }
  }
}

run().catch(console.error);
