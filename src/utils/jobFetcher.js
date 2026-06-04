const axios = require("axios");

/**
 * Fetches real job listings from JSearch API (via RapidAPI).
 * JSearch pulls from Google for Jobs — covers Naukri, LinkedIn,
 * Indeed, Foundit, and 50+ Indian job boards simultaneously.
 *
 * Free tier: 200 requests/month
 * Get key: rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
 *
 * @param {object} params
 * @param {string} params.query        - e.g. "Node.js developer"
 * @param {string} params.location     - e.g. "Bangalore India"
 * @param {string} params.employmentType - "FULLTIME" | "PARTTIME" | "CONTRACTOR" | "INTERN"
 * @param {number} params.page         - pagination page (default 1)
 * @param {number} params.numPages     - pages to fetch (default 1 = ~10 jobs)
 */
const fetchJobsFromJSearch = async ({
    query,
    location = "India",
    employmentType = null,
    page = 1,
    numPages = 1,
} = {}) => {
    const params = {
        query: `${query} in ${location}`,
        page: String(page),
        num_pages: String(numPages),
        country: "in",           // India
        language: "en",
        date_posted: "month",        // Only jobs posted in last 30 days
    };

    if (employmentType) params.employment_types = employmentType;

    const MAX_RETRIES = 2;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await axios.get(
                "https://jsearch.p.rapidapi.com/search",
                {
                    params,
                    headers: {
                        "X-RapidAPI-Key": process.env.RAPIDAPI_KEY,
                        "X-RapidAPI-Host": "jsearch.p.rapidapi.com",
                    },
                    timeout: 30000, // Increased to 30 seconds
                }
            );
            return response.data.data || []; // Array of raw job objects
        } catch (error) {
            if (attempt === MAX_RETRIES) {
                throw error;
            }
            console.warn(`⚠️ JSearch API fetch failed (attempt ${attempt}/${MAX_RETRIES}), retrying in 2s...:`, error.message);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
};

/**
 * Normalises a raw JSearch job object into our JobPosting schema shape.
 * @param {object} raw  Raw job from JSearch API
 */
const normaliseJob = (raw) => {
    // Parse salary if available
    const salaryMin = raw.job_min_salary || null;
    const salaryMax = raw.job_max_salary || null;
    const currency = raw.job_salary_currency || "INR";

    // Detect remote
    const isRemote =
        raw.job_is_remote ||
        (raw.job_city || "").toLowerCase().includes("remote") ||
        false;

    // Map employment type
    const typeMap = {
        FULLTIME: "full-time",
        PARTTIME: "part-time",
        CONTRACTOR: "contract",
        INTERN: "internship",
    };
    const jobType = typeMap[raw.job_employment_type] || "full-time";

    // Extract skills from highlights if available
    const skills = raw.job_required_skills || [];

    return {
        source: "other",                              // JSearch aggregates multiple sources
        sourceJobId: raw.job_id,
        jobUrl: raw.job_apply_link || raw.job_google_link,
        title: raw.job_title,
        company: raw.employer_name,
        location: [raw.job_city, raw.job_state, raw.job_country]
            .filter(Boolean).join(", "),
        isRemote,
        jobType,
        salaryMin,
        salaryMax,
        salaryCurrency: currency,
        salaryRaw: salaryMin && salaryMax
            ? `${salaryMin}–${salaryMax} ${currency}`
            : null,
        description: raw.job_description || null,
        skills,
        experienceMin: raw.job_required_experience?.required_experience_in_months
            ? Math.floor(raw.job_required_experience.required_experience_in_months / 12)
            : null,
        postedAt: raw.job_posted_at_datetime_utc
            ? new Date(raw.job_posted_at_datetime_utc)
            : new Date(),
        isActive: true,
    };
};

module.exports = { fetchJobsFromJSearch, normaliseJob };