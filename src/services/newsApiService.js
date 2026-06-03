const axios = require("axios");
const { logApiCall } = require("./apiLogService");

const fetchNewsFromRss = async (companyName) => {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(companyName + ' (funding OR hiring OR "new roles" OR expansion)')}&hl=en-IN&gl=IN&ceid=IN:en`;
    const response = await axios.get(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      timeout: 8000
    });
    
    const xml = response.data;
    const items = [];
    
    // Match item blocks
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
      const content = match[1];
      
      const titleMatch = content.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = content.match(/<link>([\s\S]*?)<\/link>/);
      const pubDateMatch = content.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const sourceMatch = content.match(/<source[^>]*>([\s\S]*?)<\/source>/);
      
      if (titleMatch && linkMatch) {
        items.push({
          title: titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim(),
          url: linkMatch[1].trim(),
          pubDate: pubDateMatch ? pubDateMatch[1].trim() : "",
          source: sourceMatch ? sourceMatch[1].trim() : "Google News"
        });
      }
    }
    return items;
  } catch (error) {
    console.error(`❌ RSS News Error for ${companyName}:`, error.message);
    return [];
  }
};

const getNewsCount = async (companyName) => {
  try {
    const articles = await fetchNewsFromRss(companyName);
    await logApiCall("NewsAPI", "success");
    return articles.length;
  } catch (error) {
    await logApiCall("NewsAPI", "failed", error.message);
    return 0;
  }
};

module.exports = { getNewsCount, fetchNewsFromRss };
