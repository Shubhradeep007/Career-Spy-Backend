const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Sends raw CV text to Gemini 2.5 Flash and returns structured parsed data.
 * Free tier: 1,500 requests/day — no credit card needed.
 * Get your key at: https://aistudio.google.com/apikey
 *
 * @param {string} rawText  Plain text extracted from the resume file
 * @returns {Promise<object>} Structured resume JSON
 */
const parseResumeWithAI = async (rawText) => {
  const model = genAI.getGenerativeModel({
    model: "gemini-flash-lite-latest",
    generationConfig: {
      responseMimeType: "application/json", // Forces Gemini to return valid JSON directly
    },
  });

  const prompt = `
You are an expert resume parser. I will give you raw text extracted from a resume/CV.
Extract structured information and return ONLY a valid JSON object matching this exact schema:

{
  "summary": "Professional summary or objective (string or null)",
  "currentJobTitle": "Most recent job title (string or null)",
  "currentLocation": "Current city/location (string or null)",
  "totalExperienceYears": 0,
  "skills": {
    "frontend": ["React", "HTML", "CSS"],
    "backend": ["Node.js", "Express", "Spring Boot"],
    "dbms": ["MongoDB", "MySQL"],
    "os": ["Linux", "Windows"],
    "devops": ["Docker", "AWS", "CI/CD"],
    "soft": ["Leadership", "Communication"],
    "languages": ["English", "Hindi"],
    "tools": ["Git", "Postman", "Figma"]
  },
  "experience": [
    {
      "title": "Job Title",
      "company": "Company Name",
      "location": "City, Country or null",
      "startDate": "Mon YYYY or null",
      "endDate": "Mon YYYY or null",
      "isCurrent": false,
      "description": "Brief description of responsibilities"
    }
  ],
  "education": [
    {
      "degree": "B.Tech Computer Science or null",
      "institution": "University Name",
      "location": "City or null",
      "startDate": "YYYY or null",
      "endDate": "YYYY or null",
      "grade": "CGPA or percentage or null"
    }
  ],
  "preferredLocations": [],
  "desiredRoles": []
}

Rules:
- totalExperienceYears: calculate from experience dates, return a number like 2.5
- skills categorizations: strictly categorize technical skills into frontend, backend, dbms, os, or devops.
- skills.tools: software tools like Git, Jira, Postman, Figma
- skills.soft: communication, leadership, teamwork etc
- skills.languages: spoken/written human languages only
- If a field is not found: use null for strings, [] for arrays, 0 for numbers
- desiredRoles and preferredLocations: only include if explicitly mentioned in the CV
- Return ONLY valid, well-formed JSON. Do not include comments, trailing commas, or markdown formatting.

Resume text:
---
${rawText}
---
`;

  const result = await model.generateContent(prompt);
  const text   = result.response.text().trim();

  // Gemini with responseMimeType="application/json" returns clean JSON
  // but we still strip fences as a safety net
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("❌ Gemini returned invalid JSON:");
    console.error(cleaned);
    throw new Error("Failed to parse AI response as JSON. Please try again.");
  }
};

module.exports = { parseResumeWithAI };