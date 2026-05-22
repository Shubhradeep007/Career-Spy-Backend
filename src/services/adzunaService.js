const axios = require("axios");

const getAdzunaJobCount = async (companyName) => {
  try {
    const appId = process.env.ADZUNA_APP_ID;
    const appKey = process.env.ADZUNA_APP_KEY;
    if (!appId || !appKey) return 0;

    const url = `https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${appId}&app_key=${appKey}&what=${encodeURIComponent(companyName)}`;
    const response = await axios.get(url);
    
    return response.data.count || 0;
  } catch (error) {
    console.error(`❌ Adzuna API Error for ${companyName}:`, error.message);
    return 0;
  }
};

module.exports = { getAdzunaJobCount };
