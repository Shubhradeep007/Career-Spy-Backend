const { GoogleGenerativeAI } = require("@google/generative-ai");
const WatchedCompany = require("../models/WatchedCompany.model");
const Signal = require("../models/Signal.model");
const Alert = require("../models/Alert.model");
const { logApiCall } = require("./apiLogService");

const buildUserContext = async (userId) => {
  try {
    const companies = await WatchedCompany.find({ userId });
    if (companies.length === 0) {
      return "The user is not watching any companies currently. Suggest they add some targets (up to 10) to their watchlist.";
    }

    let context = "The user is watching these target companies:\n";
    for (const company of companies) {
      const latestSignal = await Signal.findOne({ companyId: company._id }).sort({ createdAt: -1 });
      const lastAlert = await Alert.findOne({ companyId: company._id }).sort({ createdAt: -1 });

      context += `- **${company.companyName}**:\n`;
      context += `  - Target Role: ${company.targetRole || "Any"}\n`;
      context += `  - Careers URL: ${company.careerUrl || "None provided"}\n`;
      context += `  - Alerts: ${company.alertActive ? "Enabled" : "Disabled"}\n`;
      
      if (latestSignal) {
        context += `  - Latest Hire Score: ${latestSignal.hireScore}/100 (Verdict: ${latestSignal.verdict})\n`;
        context += `  - AI Summary: ${latestSignal.aiSummary}\n`;
        context += `  - Recommended Action: ${latestSignal.aiAction}\n`;
        context += `  - Signal metrics: jobsPosted=${latestSignal.jobsPosted}, newsCount=${latestSignal.newsCount}, githubOrgActivityCount=${latestSignal.githubActivity}, careerPageKeywordScore=${latestSignal.careerPageScore}\n`;
      } else {
        context += `  - Latest Hire Score: No signals collected yet. (Waiting for hourly scan or manual trigger)\n`;
      }

      if (lastAlert) {
        context += `  - Last Alert Triggered: ${new Date(lastAlert.createdAt).toLocaleDateString()} (Score: ${lastAlert.hireScore})\n`;
      }
      context += `\n`;
    }
    return context;
  } catch (err) {
    console.error("Context build error:", err);
    return "Error fetching user watched companies context.";
  }
};

const generateChatResponseStream = async (userId, userQuery, history = []) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Gemini API key is missing");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const context = await buildUserContext(userId);

    const systemPrompt = `You are Career Spy AI, a personalized job-search assistant. Your goal is to guide the user to succeed in their career hunt. You are fully aware of their live tracking dashboard and monitored targets.

Here is the user's live dashboard context:
${context}

Rules for response:
- Answer their questions about watched companies, resumes, outreach drafting, interview preps, and job tips.
- Incorporate their watched companies and hire scores directly if relevant to wow them.
- Keep your answers professional, direct, encouraging, and structured in clean Markdown.
`;

    // Map history to Gemini format
    const contents = history.map(h => ({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: h.content }]
    }));

    // Inject system context into the first message or prepend to current prompt
    const finalPrompt = `${systemPrompt}\n\nUser Question: ${userQuery}`;
    contents.push({
      role: "user",
      parts: [{ text: finalPrompt }]
    });

    const result = await model.generateContentStream({ contents });
    await logApiCall("Gemini", "success");
    return result.stream;
  } catch (error) {
    console.error("Gemini Chat Stream Error:", error.message);
    await logApiCall("Gemini", "failed", error.message);
    throw error;
  }
};

module.exports = {
  generateChatResponseStream
};
