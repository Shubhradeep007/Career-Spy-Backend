const ApiLog = require("../models/ApiLog.model");

const logApiCall = async (apiName, status, errorReason = null) => {
  try {
    await ApiLog.create({
      apiName,
      status,
      errorReason: errorReason ? String(errorReason).substring(0, 1000) : null
    });
  } catch (error) {
    console.error("❌ Error writing ApiLog:", error.message);
  }
};

module.exports = { logApiCall };
