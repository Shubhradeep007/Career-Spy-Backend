const { GoogleGenerativeAI } = require("@google/generative-ai");
const WatchedCompany = require("../models/WatchedCompany.model");
const Signal = require("../models/Signal.model");
const Alert = require("../models/Alert.model");
const Resume = require("../models/Resume.model");
const { logApiCall } = require("./apiLogService");

const buildUserContext = async (userId) => {
  try {
    const companies = await WatchedCompany.find({ userId });
    const resume = await Resume.findOne({ userId, isParsed: true }).sort({ updatedAt: -1 });

    let context = "";

    if (companies.length === 0) {
      context += "The user is not watching any target companies currently. Suggest they go to the 'Companies' (Watchlist) tab and add some targets (e.g. Swiggy, Google, Amazon) to start monitoring hiring signals.\n";
    } else {
      context += "The user is watching these target companies:\n";
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
    }

    if (resume) {
      context += `\nUser's Profile & Resume Context:\n`;
      context += `- Target Roles: ${resume.desiredRoles?.join(", ") || resume.currentJobTitle || "Not specified"}\n`;
      context += `- Extracted Skills: ${resume.skills?.join(", ") || "None extracted"}\n`;
    } else {
      context += `\nUser's Profile & Resume Context:\n`;
      context += `- No resume uploaded or parsed yet. Recommend that they go to the 'Resume' tab to upload their PDF/Word resume. This enables automatic AI Job Matching and tailored skill diagnostics.\n`;
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

    const systemPrompt = `You are Career Spy AI, a personalized job-search assistant. Your goal is to guide the user to succeed in their career hunt. You are fully aware of their live tracking dashboard, monitored targets, and resume status.

Here is the user's live dashboard context:
${context}

Guidelines to guide the user on using Career Spy:
1. **Explain the Steps to Succeed**: When users ask what to do or how to use the app, guide them step-by-step:
   - **Step 1: Watchlist Target Companies**: Go to the 'Companies' (or Watchlist) section and add target companies (e.g. Swiggy, Google, Amazon) along with their desired role.
   - **Step 2: Collect Hiring Signals**: The crawler runs hourly automated scans on jobs, news, and code activity to compute a 'Hire Score' (0-100). Higher scores mean active hiring. They can also trigger manual scans.
   - **Step 3: Upload Resume**: Go to the 'Resume' section and upload their resume.
   - **Step 4: AI Match Scoring**: Once their resume is uploaded, the app compares it to scraped jobs to calculate a match percentage (e.g., 85% Match) and identify missing skills.
   - **Step 5: Proactive Outreach**: Guide them to ask you (the AI) to draft cold outreach emails or LinkedIn messages for target companies, prepare for specific interviews, or suggest skills to add.

2. **Actionable Suggestions**:
   - Always give structured, actionable suggestions.
   - If they have no target companies watched, instruct them to add some in the Companies tab.
   - If they have no resume uploaded, tell them to upload one in the Resume section.
   - If they have target companies with high Hire Scores (e.g., above 70), suggest they start searching for openings and let you draft a cold outreach message to hiring managers.
   - If they ask for general guidance, structure it as a clean step-by-step checklist.

Rules for response:
- Answer questions directly, keeping responses professional, direct, encouraging, and formatted in clean Markdown.
- Incorporate their watched companies, hire scores, and profile context directly when relevant.
- Do not make up mock data; refer to the live dashboard context provided above.
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
