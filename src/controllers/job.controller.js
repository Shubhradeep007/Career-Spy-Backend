const Job = require("../models/Job.model");
const Resume = require("../models/Resume.model");
const ApiLog = require("../models/ApiLog.model");
const { fetchJobsFromJSearch, normaliseJob } = require("../utils/jobFetcher");
const { scoreJobAgainstResume } = require("../utils/jobMatcher");

// Search jobs and calculate AI Match Scores
exports.searchJobs = async (req, res) => {
  const { query } = req.body;
  if (!query) {
    return res.status(400).json({ message: "Search query is required." });
  }

  // Fetch active user resume if available (with fallback to latest parsed)
  let resume = await Resume.findOne({ userId: req.user._id, isActive: true, isParsed: true });
  if (!resume) {
    resume = await Resume.findOne({ userId: req.user._id, isParsed: true }).sort({ updatedAt: -1 });
  }

  let rawJobs = [];
  try {
    rawJobs = await fetchJobsFromJSearch({
      query,
      location: resume?.currentLocation || "India",
    });
    // Log job fetch success (Adzuna is used as the general jobs API indicator in logs)
    await ApiLog.create({ apiName: "Adzuna", status: "success" });
  } catch (error) {
    console.error("❌ Job Fetcher JSearch API Error:", error.message);
    await ApiLog.create({
      apiName: "Adzuna",
      status: "failed",
      errorReason: error.message || "Failed fetching jobs from RapidAPI",
    });
    // Fallback: load already cached jobs from DB that match the keyword
    const cachedJobs = await Job.find({
      $or: [
        { title: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
      ],
    }).limit(10);

    const formatted = cachedJobs.map((job) => {
      const match = job.matchScores.find((m) => String(m.userId) === String(req.user._id));
      return {
        _id: job._id,
        source: job.source,
        sourceJobId: job.sourceJobId,
        jobUrl: job.jobUrl,
        title: job.title,
        company: { name: job.companyName },
        location: job.location,
        type: job.jobType,
        description: job.description,
        skills: job.skills,
        salary: job.salaryMin && job.salaryMax ? { min: job.salaryMin, max: job.salaryMax, currency: job.salaryCurrency } : undefined,
        postedAt: job.postedAt,
        myMatch: match ? {
          score: match.score,
          recommendation: match.recommendation,
          matchedSkills: match.matchedSkills,
          missingSkills: match.missingSkills,
          reason: match.reason
        } : undefined,
      };
    });

    return res.json({ jobs: formatted });
  }

  const results = [];

  for (const raw of rawJobs) {
    try {
      const normalised = normaliseJob(raw);

      // Check if job already exists in cache
      let dbJob = await Job.findOne({ sourceJobId: normalised.sourceJobId });
      let myMatch = null;

      if (dbJob) {
        // Look for existing user score
        const existingScore = dbJob.matchScores.find(
          (m) => String(m.userId) === String(req.user._id)
        );
        if (existingScore) {
          myMatch = {
            score: existingScore.score,
            recommendation: existingScore.recommendation,
            matchedSkills: existingScore.matchedSkills,
            missingSkills: existingScore.missingSkills,
            reason: existingScore.reason,
          };
        }
      } else {
        dbJob = new Job({
          source: normalised.source,
          sourceJobId: normalised.sourceJobId,
          jobUrl: normalised.jobUrl,
          title: normalised.title,
          companyName: normalised.company,
          location: normalised.location,
          isRemote: normalised.isRemote,
          jobType: normalised.jobType,
          salaryMin: normalised.salaryMin,
          salaryMax: normalised.salaryMax,
          salaryCurrency: normalised.salaryCurrency,
          salaryRaw: normalised.salaryRaw,
          description: normalised.description,
          skills: normalised.skills,
          experienceMin: normalised.experienceMin,
          postedAt: normalised.postedAt,
        });
      }

      // If we have a resume and no matching score yet, perform Gemini scoring
      if (resume && !myMatch) {
        try {
          const scoreResult = await scoreJobAgainstResume(resume, normalised);
          
          myMatch = {
            score: scoreResult.score,
            recommendation: scoreResult.recommendation,
            matchedSkills: scoreResult.matchedSkills,
            missingSkills: scoreResult.missingSkills,
            reason: scoreResult.reason,
          };

          dbJob.matchScores.push({
            userId: req.user._id,
            score: scoreResult.score,
            recommendation: scoreResult.recommendation,
            matchedSkills: scoreResult.matchedSkills,
            missingSkills: scoreResult.missingSkills,
            reason: scoreResult.reason,
          });

          await dbJob.save();
          await ApiLog.create({ apiName: "Gemini", status: "success" });
        } catch (matchErr) {
          console.error("❌ Mismatch scoring error:", matchErr.message);
          await ApiLog.create({
            apiName: "Gemini",
            status: "failed",
            errorReason: matchErr.message || "Failed scoring job post",
          });
        }
      } else if (!dbJob.isNew) {
        // Save the cached updates if any, or just save it the first time
        await dbJob.save();
      } else {
        await dbJob.save();
      }

      results.push({
        _id: dbJob._id,
        source: dbJob.source,
        sourceJobId: dbJob.sourceJobId,
        jobUrl: dbJob.jobUrl,
        title: dbJob.title,
        company: { name: dbJob.companyName },
        location: dbJob.location,
        type: dbJob.jobType,
        description: dbJob.description,
        skills: dbJob.skills,
        salary: dbJob.salaryMin && dbJob.salaryMax ? { min: dbJob.salaryMin, max: dbJob.salaryMax, currency: dbJob.salaryCurrency } : undefined,
        postedAt: dbJob.postedAt,
        myMatch: myMatch || undefined,
      });
    } catch (err) {
      console.error("❌ Failed normalising or scoring individual job:", err.message);
    }
  }

  res.json({ jobs: results });
};

// Recommended listings based on resume profile
exports.getRecommendedJobs = async (req, res) => {
  let resume = await Resume.findOne({ userId: req.user._id, isActive: true, isParsed: true });
  if (!resume) {
    resume = await Resume.findOne({ userId: req.user._id, isParsed: true }).sort({ updatedAt: -1 });
  }
  if (!resume) {
    return res.json({ jobs: [] });
  }

  // Create target keyword from roles/skills
  const targetRole = resume.desiredRoles?.[0] || resume.currentJobTitle || "Software Engineer";
  
  // Re-use search controller with the computed query
  req.body = { query: targetRole };
  return exports.searchJobs(req, res);
};
