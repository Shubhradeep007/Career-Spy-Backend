const axios = require("axios");
const { logApiCall } = require("./apiLogService");

const extractGithubOrg = (input) => {
  if (!input) return "";
  let cleanInput = input.trim();
  cleanInput = cleanInput.replace(/\/+$/, ""); // Remove trailing slashes
  if (cleanInput.includes("github.com/")) {
    const parts = cleanInput.split("github.com/");
    if (parts.length > 1) {
      const pathParts = parts[1].split("/");
      return pathParts[0] || "";
    }
  }
  return cleanInput;
};

const getGithubActivity = async (orgName) => {
  const cleanOrg = extractGithubOrg(orgName);
  if (!cleanOrg) return 0;
  try {
    const token = process.env.GITHUB_TOKEN;
    const headers = token ? { Authorization: `token ${token}` } : {};

    const url = `https://api.github.com/users/${encodeURIComponent(cleanOrg)}/events/public?per_page=100`;
    const response = await axios.get(url, { headers });
    
    await logApiCall("GitHub", "success");
    return response.data.length || 0;
  } catch (error) {
    console.error(`❌ GitHub API Error for ${cleanOrg} (original input: ${orgName}):`, error.message);
    await logApiCall("GitHub", "failed", error.message);
    return 0;
  }
};

module.exports = { getGithubActivity, extractGithubOrg };

