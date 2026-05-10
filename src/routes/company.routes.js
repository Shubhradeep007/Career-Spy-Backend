const express = require("express");
const router = express.Router();
const companyController = require("../controllers/company.controller");
const { protect } = require("../middleware/auth.middleware");

// All company routes require login
router.use(protect);

// GET    /api/companies          — get all watched companies
router.get("/", companyController.getCompanies);

// POST   /api/companies          — add company to watchlist
router.post("/", companyController.addCompany);

// GET    /api/companies/:id      — get single company + news
router.get("/:id", companyController.getCompany);

// PUT    /api/companies/:id      — update company details
router.put("/:id", companyController.updateCompany);

// DELETE /api/companies/:id      — remove from watchlist
router.delete("/:id", companyController.removeCompany);

// POST   /api/companies/:id/refresh  — manually refresh news
router.post("/:id/refresh", companyController.refreshNews);

module.exports = router;