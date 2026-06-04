const { GoogleGenerativeAI } = require("@google/generative-ai");
const { logApiCall } = require("./apiLogService");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseRetryDelay = (errMsg) => {
  const match = errMsg?.match(/retryDelay.*?(\d+)s/);
  if (match) return parseInt(match[1], 10) * 1000;
  return 20000;
};

const getGeminiHireScore = async (companyName, signals, targetRole) => {
  const MAX_RETRIES = 3;

  // Try each model in order — each has its own separate quota pool
  const MODELS = [
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash"
  ];

  const prompt = `
    You are an AI job intelligence platform scoring a company's likelihood of hiring soon.
    Company: ${companyName}
    Target Role: ${targetRole || "Any"}
    Signals collected over the last hour:
    - Active Job Postings: ${signals.jobsPosted}
    - Funding/Hiring News Articles: ${signals.newsCount}
    - GitHub Repo Activity Events: ${signals.githubActivity}
    - Career Page Keywords Match Score: ${signals.careerPageScore}

    Based on these signals, generate a JSON response strictly with the following schema, do not include any markdown formatting like \`\`\`json:
    {
      "hireScore": <number 0-100>,
      "verdict": "<HOT | WARM | COLD>",
      "aiSummary": "<two sentence summary>",
      "aiAction": "<one sentence actionable advice>",
      "outreachMessage": "<professional outreach email for ${targetRole || "Any"} role>"
    }
  `;

  for (const modelName of MODELS) {
    let modelQuotaExhausted = false;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("Gemini API key missing");

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });

        const result = await model.generateContent(prompt);
        let text = result.response.text().trim();
        if (text.startsWith("```json")) {
          text = text.replace(/^```json\n/, "").replace(/\n```$/, "");
        }

        const data = JSON.parse(text);
        await logApiCall("Gemini", "success");
        console.log(`✅ Gemini OK for ${companyName} [model: ${modelName}]`);
        return {
          hireScore: data.hireScore || 0,
          verdict: data.verdict || "COLD",
          aiSummary: data.aiSummary || "",
          aiAction: data.aiAction || "",
          outreachMessage: data.outreachMessage || "",
        };
      } catch (error) {
        const errMsg = error.message || "";

        // Daily quota exhausted for this model — try next model
        const isDailyExhausted =
          errMsg.includes("PerDayPerProjectPerModel") ||
          (errMsg.includes("PerDay") && errMsg.includes("FreeTier"));

        // Per-minute rate limit — wait and retry same model
        const isMinuteLimit =
          (errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED")) &&
          !isDailyExhausted;

        if (isDailyExhausted) {
          console.warn(`⚠️ ${modelName} daily quota exhausted for ${companyName} — trying next model...`);
          await logApiCall("Gemini", "failed", `${modelName} daily quota exhausted`);
          modelQuotaExhausted = true;
          break; // break inner retry loop, try next model
        }

        if (isMinuteLimit && attempt < MAX_RETRIES) {
          const waitMs = parseRetryDelay(errMsg);
          console.warn(`⚠️ ${modelName} rate-limit for ${companyName} (attempt ${attempt}/${MAX_RETRIES}) — retrying in ${waitMs / 1000}s...`);
          await sleep(waitMs);
          continue;
        }

        // Other error or final attempt
        console.error(`❌ Gemini [${modelName}] error for ${companyName} (attempt ${attempt}):`, errMsg.substring(0, 200));
        await logApiCall("Gemini", "failed", errMsg.substring(0, 200));
        break;
      }
    }
  }

  // ─── Heuristic Fallback ──────────────────────────────────────────
  console.warn(`📊 Using heuristic score for ${companyName} (all Gemini models unavailable).`);

  const jobs = signals.jobsPosted || 0;
  const news = signals.newsCount || 0;
  const github = signals.githubActivity || 0;
  const career = signals.careerPageScore || 0;

  const hireScore = Math.round(Math.max(0, Math.min(100,
    Math.min(jobs * 10, 45) +
    Math.min(news * 15, 30) +
    Math.min(Math.floor(github / 2), 15) +
    Math.min(career * 0.1, 10)
  )));

  const verdict = hireScore >= 70 ? "HOT" : hireScore >= 40 ? "WARM" : "COLD";

  const activeSignals = [
    jobs > 0 && `${jobs} job postings`,
    news > 0 && `${news} news articles`,
    github > 0 && "GitHub activity",
    career > 0 && "career page matches",
  ].filter(Boolean);

  const signalsText = activeSignals.length > 0
    ? `based on ${activeSignals.join(", ")}`
    : "based on general telemetry";

  return {
    hireScore,
    verdict,
    aiSummary: `Heuristic estimate: ${hireScore}% hiring likelihood ${signalsText}. (AI quota unavailable — rule-based scoring used.)`,
    aiAction: `Apply directly through the ${companyName} career portal and tailor your profile for ${targetRole || "roles of interest"}.`,
    outreachMessage: `Subject: Inquiry: ${targetRole || "Opportunities"} at ${companyName}\n\nHi Hiring Team at ${companyName},\n\nI have been following ${companyName}'s growth and believe my skills are a strong match.\n\nI would love to connect and explore how I can contribute as a ${targetRole || "professional"}.\n\nBest regards,\n[Your Name]`,
  };
};

module.exports = { getGeminiHireScore };
