const axios = require("axios");

const getNewsCount = async (companyName) => {
  try {
    const apiKey = process.env.NEWS_API_KEY;
    if (!apiKey) return 0;

    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(companyName + ' (funding OR hiring OR "new roles" OR expansion)')}&apiKey=${apiKey}`;
    const response = await axios.get(url);
    
    return response.data.totalResults || 0;
  } catch (error) {
    console.error(`❌ NewsAPI Error for ${companyName}:`, error.message);
    return 0;
  }
};

module.exports = { getNewsCount };
