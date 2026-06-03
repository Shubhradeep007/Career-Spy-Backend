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

/**
 * Scrapes job links directly from the company's official career page using heuristics.
 */
const scrapeJobsFromCareerPage = async (url, targetRole = "") => {
  if (!url) return [];
  try {
    const targetKeywords = targetRole
      ? targetRole.toLowerCase().split(/\s+/).filter(w => w.length > 2)
      : ["software", "engineer", "developer", "designer", "manager", "analyst", "intern"];

    // 1. Direct ATS URL Detection (if user provided a Lever/Greenhouse link directly)
    if (url.includes("jobs.lever.co")) {
      const match = url.match(/jobs\.lever\.co\/([^/?#\s]+)/);
      if (match && !["jobs", "main", "embed"].includes(match[1])) {
        const token = match[1];
        try {
          const res = await axios.get(`https://api.lever.co/v0/postings/${token}?mode=json`, { timeout: 8000 });
          if (Array.isArray(res.data)) {
            const apiJobs = res.data
              .filter(j => {
                const text = (j.text || "").toLowerCase();
                return targetKeywords.some(kw => text.includes(kw));
              })
              .map(j => ({
                title: j.text,
                url: j.hostedUrl,
                location: j.categories?.location || "Remote",
                salary: "Direct Apply"
              }));
            if (apiJobs.length > 0) return apiJobs.slice(0, 5);
          }
        } catch (err) {
          console.error(`❌ Lever API fetch failed for ${token}:`, err.message);
        }
      }
    }

    if (url.includes("boards.greenhouse.io")) {
      const match = url.match(/boards\.greenhouse\.io\/([^/?#\s]+)/) || url.match(/for=([^&]+)/);
      if (match && !["embed", "job_board"].includes(match[1])) {
        const token = match[1];
        try {
          const res = await axios.get(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs`, { timeout: 8000 });
          if (res.data && Array.isArray(res.data.jobs)) {
            const apiJobs = res.data.jobs
              .filter(j => {
                const text = (j.title || "").toLowerCase();
                return targetKeywords.some(kw => text.includes(kw));
              })
              .map(j => ({
                title: j.title,
                url: j.absolute_url,
                location: j.location?.name || "Remote",
                salary: "Direct Apply"
              }));
            if (apiJobs.length > 0) return apiJobs.slice(0, 5);
          }
        } catch (err) {
          console.error(`❌ Greenhouse API fetch failed for ${token}:`, err.message);
        }
      }
    }

    // 2. Fetch the HTML content
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      timeout: 10000
    });
    
    const $ = cheerio.load(response.data);

    // 3. Scan the page links for Lever or Greenhouse boards (many sites link to their ATS page)
    let atsToken = null;
    let atsType = null;
    
    $("a").each((i, el) => {
      const href = $(el).attr("href") || "";
      if (href.includes("jobs.lever.co")) {
        const match = href.match(/jobs\.lever\.co\/([^/?#\s]+)/);
        if (match && !["jobs", "main", "embed"].includes(match[1])) {
          atsToken = match[1];
          atsType = "lever";
          return false; // break loop
        }
      } else if (href.includes("boards.greenhouse.io")) {
        const match = href.match(/boards\.greenhouse\.io\/([^/?#\s]+)/) || href.match(/for=([^&]+)/);
        if (match && !["embed", "job_board"].includes(match[1])) {
          atsToken = match[1];
          atsType = "greenhouse";
          return false; // break loop
        }
      }
    });

    if (atsToken) {
      console.log(`ℹ️ Found ${atsType} token "${atsToken}" in page links. Fetching from API...`);
      if (atsType === "lever") {
        try {
          const res = await axios.get(`https://api.lever.co/v0/postings/${atsToken}?mode=json`, { timeout: 8000 });
          if (Array.isArray(res.data)) {
            const apiJobs = res.data
              .filter(j => {
                const text = (j.text || "").toLowerCase();
                return targetKeywords.some(kw => text.includes(kw));
              })
              .map(j => ({
                title: j.text,
                url: j.hostedUrl,
                location: j.categories?.location || "Remote",
                salary: "Direct Apply"
              }));
            if (apiJobs.length > 0) return apiJobs.slice(0, 5);
          }
        } catch (err) {
          console.error(`❌ Lever API fetch failed for token ${atsToken}:`, err.message);
        }
      } else if (atsType === "greenhouse") {
        try {
          const res = await axios.get(`https://boards-api.greenhouse.io/v1/boards/${atsToken}/jobs`, { timeout: 8000 });
          if (res.data && Array.isArray(res.data.jobs)) {
            const apiJobs = res.data.jobs
              .filter(j => {
                const text = (j.title || "").toLowerCase();
                return targetKeywords.some(kw => text.includes(kw));
              })
              .map(j => ({
                title: j.title,
                url: j.absolute_url,
                location: j.location?.name || "Remote",
                salary: "Direct Apply"
              }));
            if (apiJobs.length > 0) return apiJobs.slice(0, 5);
          }
        } catch (err) {
          console.error(`❌ Greenhouse API fetch failed for token ${atsToken}:`, err.message);
        }
      }
    }

    // 4. Fallback: Parse links on the static HTML using heuristics
    const jobs = [];
    const seenUrls = new Set();
    const ignoreKeywords = [
      "sign in", "login", "log in", "register", "signup", "sign up",
      "privacy", "terms", "cookies", "contact", "about", "press",
      "home", "search", "filter", "blog", "linkedin", "facebook",
      "twitter", "github", "instagram", "youtube", "social", "policy"
    ];

    $("a").each((i, el) => {
      const href = $(el).attr("href");
      if (!href) return;

      let absoluteUrl = href.trim();
      if (!absoluteUrl.startsWith("http")) {
        try {
          const parsedUrl = new URL(url);
          absoluteUrl = new URL(href, parsedUrl.origin + parsedUrl.pathname).href;
        } catch (e) {
          return;
        }
      }

      const baseClean = url.split('#')[0].split('?')[0].replace(/\/$/, "");
      const urlClean = absoluteUrl.split('#')[0].split('?')[0].replace(/\/$/, "");
      if (urlClean === baseClean) return;

      if (seenUrls.has(urlClean)) return;

      const linkText = $(el).text().trim();
      const parentText = $(el).parent().text().trim();
      const titleCandidate = linkText || $(el).attr("title") || "";

      if (titleCandidate.length < 5 || titleCandidate.length > 80) return;

      const lowerTitle = titleCandidate.toLowerCase();
      const shouldIgnore = ignoreKeywords.some(kw => lowerTitle.includes(kw));
      if (shouldIgnore) return;

      const containsRoleKeyword = targetKeywords.some(keyword => lowerTitle.includes(keyword));
      if (!containsRoleKeyword) return;

      const lowerUrl = absoluteUrl.toLowerCase();
      const isSocialDomain = ["linkedin.com", "facebook.com", "twitter.com", "github.com", "instagram.com"].some(dom => lowerUrl.includes(dom));
      if (isSocialDomain) return;

      seenUrls.add(urlClean);
      
      let location = "Remote / On-site";
      const locationKeywords = ["india", "bangalore", "bengaluru", "hyderabad", "pune", "mumbai", "delhi", "noida", "gurgaon", "remote", "us", "usa", "singapore", "london", "uk"];
      const lowerParent = parentText.toLowerCase();
      const foundLoc = locationKeywords.find(loc => lowerParent.includes(loc));
      if (foundLoc) {
        location = foundLoc.charAt(0).toUpperCase() + foundLoc.slice(1);
      }

      jobs.push({
        title: titleCandidate.replace(/\s+/g, " "),
        url: absoluteUrl,
        location,
        salary: "Direct Apply"
      });
    });

    return jobs.slice(0, 5);
  } catch (error) {
    console.error(`❌ Career page job scraping error for ${url}:`, error.message);
    return [];
  }
};

module.exports = { getCareerPageScore, scrapeJobsFromCareerPage };
