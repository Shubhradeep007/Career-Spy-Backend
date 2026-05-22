const express = require("express");
const { protect } = require("../middleware/auth.middleware");
const { getWatchedCompanies, addWatchedCompany, deleteWatchedCompany, toggleCompanyAlert } = require("../controllers/company.controller");

const router = express.Router();

router.use(protect);

router.route("/")
  .get(getWatchedCompanies)
  .post(addWatchedCompany);

router.route("/:id")
  .delete(deleteWatchedCompany)
  .patch(toggleCompanyAlert);

module.exports = router;
