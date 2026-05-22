const axios = require("axios");
const { logApiCall } = require("./apiLogService");

const getGithubActivity = async (orgName) => {
  if (!orgName) return 0;
  try {
    const token = process.env.GITHUB_TOKEN;
    const headers = token ? { Authorization: `token ${token}` } : {};

    const url = `https://api.github.com/users/${encodeURIComponent(orgName)}/events/public?per_page=100`;
    const response = await axios.get(url, { headers });
    
    await logApiCall("GitHub", "success");
    return response.data.length || 0;
  } catch (error) {
    console.error(`❌ GitHub API Error for ${orgName}:`, error.message);
    await logApiCall("GitHub", "failed", error.message);
    return 0;
  }
};

module.exports = { getGithubActivity };
