const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const User = require("../src/models/User.model");
const WatchedCompany = require("../src/models/WatchedCompany.model");
const Alert = require("../src/models/Alert.model");

async function run() {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected successfully.");

    const users = await User.find();
    console.log("\n--- Users ---");
    users.forEach(u => {
      console.log(`User: ${u.name} | Email: ${u.email} | Plan: ${u.subscriptionStatus} | ID: ${u._id}`);
    });

    const companies = await WatchedCompany.find();
    console.log("\n--- Watched Companies ---");
    companies.forEach(c => {
      console.log(`Company: ${c.companyName} | UserID: ${c.userId} | AlertActive: ${c.alertActive}`);
    });

    const alerts = await Alert.find().sort({ createdAt: -1 }).limit(5);
    console.log("\n--- Latest Alerts in DB ---");
    console.log(JSON.stringify(alerts, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
