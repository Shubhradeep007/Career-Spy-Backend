/**
 * Seed / verify test accounts in MongoDB.
 * Run: node scripts/seedTestAccounts.js
 */
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../src/models/User.model");

const ACCOUNTS = [
  {
    name: "Test Admin",
    email: "testadmin@yopmail.com",
    password: "testadmin@yopmail.com",
    role: "admin",
  },
  {
    name: "Test User",
    email: "testuser@yopmail.com",
    password: "testuser@yopmail.com",
    role: "user",
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected to MongoDB");

  for (const acc of ACCOUNTS) {
    const existing = await User.findOne({ email: acc.email });
    const hashed = await bcrypt.hash(acc.password, 10);

    if (existing) {
      existing.password = hashed;
      existing.isEmailVerified = true;
      existing.emailVerifyToken = null;
      existing.emailVerifyExpires = null;
      existing.isBanned = false;
      existing.role = acc.role;
      existing.authProvider = "local";
      await existing.save();
      console.log(`✅ Updated: ${acc.email} (role: ${acc.role})`);
    } else {
      await User.create({
        name: acc.name,
        email: acc.email,
        password: hashed,
        role: acc.role,
        isEmailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpires: null,
        isBanned: false,
        authProvider: "local",
      });
      console.log(`✅ Created: ${acc.email} (role: ${acc.role})`);
    }
  }

  await mongoose.disconnect();
  console.log("\n🎉 Done! Both accounts are ready to log in.");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
