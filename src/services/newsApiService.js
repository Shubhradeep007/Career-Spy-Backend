const axios = require("axios");
const { logApiCall } = require("./apiLogService");

const NEWS_IMAGES = [
  "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=500&auto=format&fit=crop&q=80", // corporate office skyscraper
  "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=500&auto=format&fit=crop&q=80", // business charts/meeting
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=500&auto=format&fit=crop&q=80", // tech startup team collaborating
  "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=500&auto=format&fit=crop&q=80", // professional manager workspace
  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=500&auto=format&fit=crop&q=80"  // elegant design office
];

const stripHtml = (html) => {
  if (!html) return "";
  // Strip tags, clean extra entities
  let clean = html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  
  // If description contains related items (indicated by ellipses or dash), truncate clean snippet
  const index = clean.indexOf(" - ");
  if (index > 40) {
    clean = clean.substring(0, index).trim();
  }
  return clean.substring(0, 180) + (clean.length > 180 ? "..." : "");
};

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
    let idx = 0;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 5) {
      const content = match[1];
      
      const titleMatch = content.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = content.match(/<link>([\s\S]*?)<\/link>/);
      const pubDateMatch = content.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
      const sourceMatch = content.match(/<source[^>]*>([\s\S]*?)<\/source>/);
      const descriptionMatch = content.match(/<description>([\s\S]*?)<\/description>/);
      
      if (titleMatch && linkMatch) {
        const titleText = titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
        const rawDesc = descriptionMatch ? descriptionMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1') : "";
        let descText = stripHtml(rawDesc);
        
        // Fallback description if RSS snippet is empty or too short
        if (!descText || descText.length < 15) {
          descText = `Read the latest market expansions, funding updates, and developer hiring signals for ${companyName}.`;
        }

        items.push({
          title: titleText,
          url: linkMatch[1].trim(),
          pubDate: pubDateMatch ? pubDateMatch[1].trim() : "",
          source: sourceMatch ? sourceMatch[1].trim() : "Google News",
          description: descText,
          imageUrl: NEWS_IMAGES[idx % NEWS_IMAGES.length]
        });
        idx++;
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
