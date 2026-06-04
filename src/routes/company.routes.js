const express = require("express");
const { protect } = require("../middleware/auth.middleware");
const { 
  getWatchedCompanies, 
  addWatchedCompany, 
  deleteWatchedCompany, 
  toggleCompanyAlert,
  getCompanyDetail
} = require("../controllers/company.controller");

const router = express.Router();

router.use(protect);

router.route("/")
  .get(getWatchedCompanies)
  .post(addWatchedCompany);

router.route("/:id")
  .get(getCompanyDetail)
  .delete(deleteWatchedCompany)
  .patch(toggleCompanyAlert);

module.exports = router;
