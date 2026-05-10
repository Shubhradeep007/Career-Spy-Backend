const Company = require("../models/Company.model");
const { scrapeCompanyNews } = require("../utils/newsScraper");

class CompanyController {

  // POST /api/companies
  // Add a company to watchlist (max 10)
  async addCompany(req, res) {
    const { name, website, linkedinUrl, industry, size, headquarters } = req.body;

    if (!name) return res.status(400).json({ message: "Company name is required" });

    // Enforce max 10 companies per user
    const count = await Company.countDocuments({ user: req.user._id });
    if (count >= 10) {
      return res.status(400).json({
        message: "You can only watch up to 10 companies. Remove one to add another.",
      });
    }

    // Check duplicate
    const exists = await Company.findOne({
      user: req.user._id,
      name: { $regex: new RegExp(`^${name}$`, "i") },
    });
    if (exists) {
      return res.status(400).json({ message: `${name} is already in your watchlist` });
    }

    // Auto-extract domain from website URL
    let domain = null;
    if (website) {
      try {
        domain = new URL(website).hostname.replace("www.", "");
      } catch {
        domain = null;
      }
    }

    const company = await Company.create({
      user: req.user._id,
      name,
      website:      website      || null,
      linkedinUrl:  linkedinUrl  || null,
      industry:     industry     || null,
      size:         size         || null,
      headquarters: headquarters || null,
      domain,
    });

    // Trigger immediate news scrape in background
    scrapeCompanyNews(company).catch((err) =>
      console.error(`News scrape failed for ${company.name}:`, err.message)
    );

    res.status(201).json({
      message: `${name} added to your watchlist. Fetching latest news...`,
      company,
    });
  }

  // GET /api/companies
  // Get all watched companies for the logged-in user
  async getCompanies(req, res) {
    const companies = await Company.find({ user: req.user._id })
      .sort({ addedAt: -1 });

    res.json({
      total: companies.length,
      remaining: 10 - companies.length,
      companies,
    });
  }

  // GET /api/companies/:id
  // Get single company with full news
  async getCompany(req, res) {
    const company = await Company.findOne({
      _id:  req.params.id,
      user: req.user._id,
    });

    if (!company) {
      return res.status(404).json({ message: "Company not found in your watchlist" });
    }

    res.json(company);
  }

  // PUT /api/companies/:id
  // Update company details
  async updateCompany(req, res) {
    const allowed = ["name", "website", "linkedinUrl", "industry", "size", "headquarters", "isActive"];
    const updates = {};

    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // Re-extract domain if website changed
    if (updates.website) {
      try {
        updates.domain = new URL(updates.website).hostname.replace("www.", "");
      } catch {
        updates.domain = null;
      }
    }

    const company = await Company.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      updates,
      { new: true, runValidators: true }
    );

    if (!company) {
      return res.status(404).json({ message: "Company not found in your watchlist" });
    }

    res.json({ message: "Company updated", company });
  }

  // DELETE /api/companies/:id
  // Remove company from watchlist
  async removeCompany(req, res) {
    const company = await Company.findOneAndDelete({
      _id:  req.params.id,
      user: req.user._id,
    });

    if (!company) {
      return res.status(404).json({ message: "Company not found in your watchlist" });
    }

    res.json({ message: `${company.name} removed from your watchlist` });
  }

  // POST /api/companies/:id/refresh
  // Manually trigger a news refresh for one company
  async refreshNews(req, res) {
    const company = await Company.findOne({
      _id:  req.params.id,
      user: req.user._id,
    });

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    res.json({ message: `Refreshing news for ${company.name}...` });

    // Run in background
    scrapeCompanyNews(company).catch((err) =>
      console.error(`Manual refresh failed for ${company.name}:`, err.message)
    );
  }
}

module.exports = new CompanyController();