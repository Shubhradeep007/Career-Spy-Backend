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

    // Heuristic fallback calculation
    const jobs = signals.jobsPosted || 0;
    const news = signals.newsCount || 0;
    const github = signals.githubActivity || 0;
    const career = signals.careerPageScore || 0;

    const jobScore = Math.min(jobs * 10, 45);
    const newsScore = Math.min(news * 15, 30);
    const githubScore = Math.min(Math.floor(github / 2), 15);
    const careerScore = Math.min(career * 0.1, 10);

    const rawScore = jobScore + newsScore + githubScore + careerScore;
    const hireScore = Math.round(Math.max(0, Math.min(100, rawScore)));

    let verdict = "COLD";
    if (hireScore >= 70) {
      verdict = "HOT";
    } else if (hireScore >= 40) {
      verdict = "WARM";
    }

    const aiSummary = `Rule-based fallback score: ${hireScore}/100. Active jobs score is ${jobScore}/45, news score is ${newsScore}/30, GitHub activity score is ${githubScore}/15, and career page match score is ${Math.round(careerScore)}/10.`;
    const aiAction = `Gemini API quota exceeded. Apply directly through the ${companyName} career portal and tailer your profile for ${targetRole || 'roles of interest'}.`;
    
    const outreachMessage = `Subject: Inquiry: ${targetRole || 'Opportunities'} at ${companyName}

Hi Hiring Team at ${companyName},

I hope this message finds you well. I have been following ${companyName}'s growth and notice that you are currently expanding. 

I would love to connect and discuss how my skills can contribute to your team as a ${targetRole || 'Any'}.

Best regards,
[Your Name]`;

    return {
      hireScore,
      verdict,
      aiSummary,
      aiAction,
      outreachMessage
    };
  }
};

module.exports = { getGeminiHireScore };
