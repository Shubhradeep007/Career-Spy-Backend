const WatchedCompany = require("../models/WatchedCompany.model");
const Signal = require("../models/Signal.model");

// GET /api/companies
const getWatchedCompanies = async (req, res) => {
  try {
    const companies = await WatchedCompany.find({ userId: req.user._id });
    
    // Fetch latest signal for each company
    const companiesWithSignals = await Promise.all(
      companies.map(async (company) => {
        const latestSignal = await Signal.findOne({ companyId: company._id }).sort({ createdAt: -1 });
        return {
          ...company.toObject(),
          latestSignal
        };
      })
    );

    res.json(companiesWithSignals);
  } catch (err) {
    res.status(500).json({ message: "Error fetching companies" });
  }
};

// POST /api/companies
const addWatchedCompany = async (req, res) => {
  const { companyName, careerUrl, githubOrg, targetRole } = req.body;
  
  if (!companyName) {
    return res.status(400).json({ message: "Company name is required" });
  }

  try {
    // Enforce 10 company limit
    const count = await WatchedCompany.countDocuments({ userId: req.user._id });
    if (count >= 10) {
      return res.status(400).json({ 
        message: "Watchlist limit reached. You can only watch up to 10 companies. Remove one to add a new target." 
      });
    }

    const newCompany = await WatchedCompany.create({
      userId: req.user._id,
      companyName,
      careerUrl,
      githubOrg,
      targetRole
    });
    res.status(201).json(newCompany);
  } catch (err) {
    res.status(500).json({ message: "Error adding company" });
  }
};

// DELETE /api/companies/:id
const deleteWatchedCompany = async (req, res) => {
  try {
    const company = await WatchedCompany.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }
    // Delete associated signals and alerts? (Optional cleanup)
    res.json({ message: "Company removed from watchlist" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting company" });
  }
};

// PATCH /api/companies/:id
const toggleCompanyAlert = async (req, res) => {
  try {
    const company = await WatchedCompany.findOne({ _id: req.params.id, userId: req.user._id });
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }
    company.alertActive = !company.alertActive;
    await company.save();
    res.json(company);
  } catch (err) {
    res.status(500).json({ message: "Error toggling alert" });
  }
};

module.exports = { getWatchedCompanies, addWatchedCompany, deleteWatchedCompany, toggleCompanyAlert };
