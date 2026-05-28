const { GoogleGenerativeAI } = require("@google/generative-ai");
const { logApiCall } = require("./apiLogService");

const getGeminiHireScore = async (companyName, signals, targetRole) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Gemini API key missing");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `
      You are an AI job intelligence platform scoring a company's likelihood of hiring soon.
      Company: ${companyName}
      Target Role: ${targetRole || 'Any'}
      Signals collected over the last hour:
      - Active Job Postings: ${signals.jobsPosted}
      - Funding/Hiring News Articles: ${signals.newsCount}
      - GitHub Repo Activity Events: ${signals.githubActivity}
      - Career Page Keywords Match Score: ${signals.careerPageScore}

      Based on these signals, generate a JSON response strictly with the following schema, do not include any markdown formatting like \`\`\`json:
      {
        "hireScore": <number 0-100 based on how likely they are hiring right now>,
        "verdict": "<strictly one of: HOT, WARM, COLD>",
        "aiSummary": "<two sentence summary explaining why>",
        "aiAction": "<one sentence actionable advice for the job seeker>",
        "outreachMessage": "<a professional, ready-to-send email or LinkedIn outreach message tailored for a hiring manager at this company for the target role ${targetRole || 'Any'}. Use placeholders like [Your Name] where appropriate.>"
      }
    `;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();
    if(text.startsWith('\`\`\`json')) {
       text = text.replace(/^\`\`\`json\n/, '').replace(/\n\`\`\`$/, '');
    }

    const data = JSON.parse(text);
    await logApiCall("Gemini", "success");
    return {
      hireScore: data.hireScore || 0,
      verdict: data.verdict || "COLD",
      aiSummary: data.aiSummary || "",
      aiAction: data.aiAction || "",
      outreachMessage: data.outreachMessage || ""
    };
  } catch (error) {
    console.error(`❌ Gemini Score Error for ${companyName}:`, error.message);
    await logApiCall("Gemini", "failed", error.message);
    return {
      hireScore: 0,
      verdict: "COLD",
      aiSummary: "Failed to generate AI insights due to an error.",
      aiAction: "Check back later.",
      outreachMessage: ""
    };
  }
};

module.exports = { getGeminiHireScore };
