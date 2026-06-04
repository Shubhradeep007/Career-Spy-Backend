const WatchedCompany = require("../models/WatchedCompany.model");
const Signal = require("../models/Signal.model");
const Resume = require("../models/Resume.model");
const { extractGithubOrg } = require("../services/githubService");
const { processCompany } = require("../cron/spyCron");

// Heuristic match score calculation between a job title and candidate's parsed resume
const calculateHeuristicMatch = (resume, jobTitle) => {
  if (!resume) return { score: null, recommendation: null };

  const title = jobTitle.toLowerCase();
  let score = 30; // base score

  // 1. Title match against desired roles
  const desiredRoles = resume.desiredRoles || [];
  const currentTitle = resume.currentJobTitle || "";
  
  let hasTitleMatch = false;
  
  if (currentTitle && title.includes(currentTitle.toLowerCase())) {
    score += 30;
    hasTitleMatch = true;
  }
  
  for (const role of desiredRoles) {
    if (title.includes(role.toLowerCase())) {
      score += 35;
      hasTitleMatch = true;
      break;
    }
  }

  // 2. Skill match in title
  const skills = [
    ...(resume.skills?.frontend || []),
    ...(resume.skills?.backend || []),
    ...(resume.skills?.dbms || []),
    ...(resume.skills?.os || []),
    ...(resume.skills?.devops || []),
    ...(resume.skills?.tools || [])
  ];

  let skillMatches = 0;
  for (const skill of skills) {
    if (title.includes(skill.toLowerCase())) {
      score += 10;
      skillMatches++;
      if (skillMatches >= 2) break; // cap skill matches in title at 20 points
    }
  }

  // Cap score at 100
  score = Math.min(Math.round(score), 100);
  
  // Apply penalty for absolute mismatch
  if (!hasTitleMatch && skillMatches === 0) {
    score = Math.max(25, score - 20);
  }

  let recommendation = "low_match";
  if (score >= 80) {
    recommendation = "highly_recommended";
  } else if (score >= 60) {
    recommendation = "good_match";
  } else if (score >= 40) {
    recommendation = "partial_match";
  }

  return { score, recommendation };
};

// GET /api/companies
const getWatchedCompanies = async (req, res) => {
  try {
    const companies = await WatchedCompany.find({ userId: req.user._id });
    
    // Fetch active resume
    let resume = await Resume.findOne({ userId: req.user._id, isActive: true, isParsed: true });
    if (!resume) {
      resume = await Resume.findOne({ userId: req.user._id, isParsed: true }).sort({ updatedAt: -1 });
    }

    // Fetch latest signal for each company
    const companiesWithSignals = await Promise.all(
      companies.map(async (company) => {
        const latestSignal = await Signal.findOne({ companyId: company._id }).sort({ createdAt: -1 });
        
        let signalObj = null;
        if (latestSignal) {
          signalObj = latestSignal.toObject();
          if (signalObj.jobsList && signalObj.jobsList.length > 0) {
            signalObj.jobsList = signalObj.jobsList.map(job => {
              const matchResult = calculateHeuristicMatch(resume, job.title);
              return {
                ...job,
                match: matchResult.score ? matchResult : undefined
              };
            });
          }
        }

        return {
          ...company.toObject(),
          latestSignal: signalObj
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
    // Enforce company limits based on subscription plan
    const sub = req.user.subscriptionStatus || "free";
    const limits = { free: 1, basic: 3, pro: 10 };
    const maxCompanies = limits[sub] || 1;

    const count = await WatchedCompany.countDocuments({ userId: req.user._id });
    if (count >= maxCompanies) {
      return res.status(400).json({ 
        message: `Watchlist limit reached. Your ${sub.toUpperCase()} plan allows watching up to ${maxCompanies} companies. Please upgrade in Billing settings to add more.` 
      });
    }

    const cleanedGithubOrg = extractGithubOrg(githubOrg);

    const newCompany = await WatchedCompany.create({
      userId: req.user._id,
      companyName,
      careerUrl: careerUrl ? careerUrl.trim() : "",
      githubOrg: cleanedGithubOrg,
      targetRole
    });

    // Run the initial scan asynchronously in the background so the user gets instant results!
    processCompany(newCompany).catch(err => {
      console.error(`❌ Background initial scan error for ${companyName}:`, err.message);
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

// GET /api/companies/:id
const getCompanyDetail = async (req, res) => {
  try {
    const company = await WatchedCompany.findOne({ _id: req.params.id, userId: req.user._id });
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    let resume = await Resume.findOne({ userId: req.user._id, isActive: true, isParsed: true });
    if (!resume) {
      resume = await Resume.findOne({ userId: req.user._id, isParsed: true }).sort({ updatedAt: -1 });
    }

    const latestSignal = await Signal.findOne({ companyId: company._id }).sort({ createdAt: -1 });
    
    let signalObj = null;
    if (latestSignal) {
      signalObj = latestSignal.toObject();
      if (signalObj.jobsList && signalObj.jobsList.length > 0) {
        signalObj.jobsList = signalObj.jobsList.map(job => {
          const matchResult = calculateHeuristicMatch(resume, job.title);
          return {
            ...job,
            match: matchResult.score ? matchResult : undefined
          };
        });
      }
    }

    res.json({
      ...company.toObject(),
      latestSignal: signalObj
    });
  } catch (err) {
    res.status(500).json({ message: "Error fetching company details" });
  }
};

module.exports = { 
  getWatchedCompanies, 
  addWatchedCompany, 
  deleteWatchedCompany, 
  toggleCompanyAlert,
  getCompanyDetail
};
