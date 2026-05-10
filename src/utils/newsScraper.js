const axios = require("axios");
const cheerio = require("cheerio");
const Company = require("../models/Company.model");

// ── Keyword maps for categorising news headlines ───────────
const CATEGORIES = {
    funding: ["funding", "raises", "raised", "series a", "series b", "series c", "investment", "valuation", "ipo", "venture"],
    hiring: ["hiring", "recruitment", "jobs", "opening", "careers", "talent", "workforce", "headcount"],
    layoff: ["layoff", "layoffs", "laid off", "retrenchment", "job cuts", "downsizing", "redundan"],
    acquisition: ["acqui", "merger", "acquired", "takeover", "buyout"],
    product: ["launch", "launches", "launched", "product", "feature", "release", "update", "announce"],
};

/**
 * Detects news category from a headline string.
 */
const detectCategory = (headline) => {
    const lower = headline.toLowerCase();
    for (const [category, keywords] of Object.entries(CATEGORIES)) {
        if (keywords.some((kw) => lower.includes(kw))) return category;
    }
    return "general";
};

/**
 * Scrapes Google News RSS for a company name.
 * Google News RSS is free, no API key needed, and very reliable.
 */
const scrapeGoogleNews = async (companyName) => {
    const query = encodeURIComponent(`"${companyName}"`);
    const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=en-IN&gl=IN&ceid=IN:en`;

    const response = await axios.get(rssUrl, {
        timeout: 10000,
        headers: {
            "User-Agent": "Mozilla/5.0 (compatible; CareerSpy/1.0)",
        },
    });

    const $ = cheerio.load(response.data, { xmlMode: true });
    const items = [];

    $("item").each((i, el) => {
        if (i >= 5) return false; // Only top 5 news items

        const title = $(el).find("title").text().trim();
        const url = $(el).find("link").text().trim() || $(el).find("guid").text().trim();
        const pubDateRaw = $(el).find("pubDate").text().trim();
        const source = $(el).find("source").text().trim() || "Google News";

        // Clean Google's redirect URLs
        const cleanUrl = url.startsWith("https://news.google.com")
            ? url
            : url;

        items.push({
            title,
            url: cleanUrl,
            source,
            publishedAt: pubDateRaw ? new Date(pubDateRaw) : new Date(),
            snippet: title, // RSS doesn't give snippets, title doubles as snippet
            category: detectCategory(title),
        });
    });

    return items;
};

/**
 * Main scraper — fetches news for a company and saves to DB.
 * Called on company add, manual refresh, and daily cron.
 * @param {object} company  Mongoose Company document
 */
const scrapeCompanyNews = async (company) => {
    try {
        const news = await scrapeGoogleNews(company.name);

        await Company.findByIdAndUpdate(company._id, {
            latestNews: news,
            lastNewsScrapedAt: new Date(),
        });

        console.log(`📰 News updated for ${company.name}: ${news.length} articles`);
        return news;
    } catch (err) {
        console.error(`❌ News scrape failed for ${company.name}:`, err.message);
        throw err;
    }
};

/**
 * Batch scraper — refreshes news for ALL active companies.
 * Called by the daily cron job.
 */
const scrapeAllCompaniesNews = async () => {
    const companies = await Company.find({ isActive: true });
    console.log(`🔄 Starting news refresh for ${companies.length} companies...`);

    for (const company of companies) {
        await scrapeCompanyNews(company);
        // Small delay between requests to avoid rate limiting
        await new Promise((r) => setTimeout(r, 1500));
    }

    console.log("✅ News refresh complete for all companies");
};

module.exports = { scrapeCompanyNews, scrapeAllCompaniesNews };