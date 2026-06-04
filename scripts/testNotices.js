const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const Notice = require("../src/models/Notice.model");
const User = require("../src/models/User.model");

async function run() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected successfully.");

    const notices = await Notice.find().populate("createdBy", "name email");
    console.log(`Found ${notices.length} notices:`);
    console.log(JSON.stringify(notices, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
