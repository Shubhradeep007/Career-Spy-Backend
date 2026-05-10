const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Uses Gemini to score a job posting against a user's resume.
 * Returns a match score (0-100) + recommendation + matched/missing skills.
 *
 * @param {object} resume     User's parsed resume from DB
 * @param {object} job        Normalised job posting object
 * @returns {Promise<object>} { score, recommendation, matchedSkills, missingSkills }
 */
const scoreJobAgainstResume = async (resume, job) => {
  const model = genAI.getGenerativeModel({
    model: "gemini-flash-lite-latest",
    generationConfig: { responseMimeType: "application/json" },
  });

  const prompt = `
You are an expert career counselor and ATS (Applicant Tracking System).
Compare the candidate's resume with the job posting and return a match score.

Return ONLY this JSON — no explanation, no markdown:
{
  "score": 85,
  "recommendation": "highly_recommended",
  "matchedSkills": ["Node.js", "MongoDB"],
  "missingSkills": ["AWS", "Docker"],
  "reason": "One sentence explaining the score"
}

Rules:
- score: 0 to 100 integer
- recommendation must be exactly one of:
    "highly_recommended" (score >= 80)
    "good_match"         (score 60-79)
    "partial_match"      (score 40-59)
    "low_match"          (score < 40)
- matchedSkills: skills from job that candidate has
- missingSkills: skills from job that candidate lacks
- Consider: title match, experience years, skills overlap, location
- Return ONLY valid, well-formed JSON. Do not include comments, trailing commas, or markdown formatting.

CANDIDATE RESUME:
- Current Title: ${resume.currentJobTitle || "Not specified"}
- Experience: ${resume.totalExperienceYears || 0} years
- Technical Skills: ${[
  ...(resume.skills?.frontend || []),
  ...(resume.skills?.backend || []),
  ...(resume.skills?.dbms || []),
  ...(resume.skills?.os || []),
  ...(resume.skills?.devops || [])
].join(", ") || "None listed"}
- Tools: ${(resume.skills?.tools || []).join(", ") || "None listed"}
- Location: ${resume.currentLocation || "Not specified"}
- Desired Roles: ${(resume.desiredRoles || []).join(", ") || "Not specified"}
- Education: ${resume.education?.map(e => e.degree).join(", ") || "Not specified"}

JOB POSTING:
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location || "Not specified"}
- Type: ${job.jobType}
- Required Skills: ${(job.skills || []).join(", ") || "Not specified"}
- Experience Required: ${job.experienceMin ? `${job.experienceMin}+ years` : "Not specified"}
- Description (first 500 chars): ${(job.description || "").slice(0, 500)}
`;

  const result  = await model.generateContent(prompt);
  const text    = result.response.text().trim();
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("❌ Gemini returned invalid JSON for job scoring:");
    console.error(cleaned);
    throw new Error("Failed to parse AI score JSON");
  }
};

module.exports = { scoreJobAgainstResume };