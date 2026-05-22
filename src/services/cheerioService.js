const axios = require("axios");
const cheerio = require("cheerio");

const getCareerPageScore = async (url) => {
  if (!url) return 0;
  try {
    const response = await axios.get(url, { timeout: 10000 });
    const $ = cheerio.load(response.data);
    const pageText = $("body").text().toLowerCase();

    const keywords = ["hiring", "openings", "join our team", "careers", "apply now", "job", "vacancy"];
    let score = 0;

    keywords.forEach(kw => {
      const regex = new RegExp(kw, "gi");
      const matches = pageText.match(regex);
      if (matches) {
        score += matches.length;
      }
    });

    return score > 100 ? 100 : score;
  } catch (error) {
    console.error(`❌ Cheerio Error for ${url}:`, error.message);
    return 0;
  }
};

module.exports = { getCareerPageScore };
