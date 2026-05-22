const User = require("../../models/User.model");
const WatchedCompany = require("../../models/WatchedCompany.model");

// GET /api/admin/users
const getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

// GET /api/admin/companies
const getCompanies = async (req, res) => {
  try {
    const companies = await WatchedCompany.find().populate("userId", "name email").sort({ createdAt: -1 });
    res.json(companies);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch companies" });
  }
};

module.exports = { getUsers, getCompanies };
