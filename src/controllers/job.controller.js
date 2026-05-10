const JobPosting = require("../models/JobPosting.model");
const Resume = require("../models/Resume.model");
const { fetchJobsFromJSearch, normaliseJob } = require("../utils/jobFetcher");
const { scoreJobAgainstResume } = require("../utils/jobMatcher");

class JobController {

    // POST /api/jobs/search
    // Fetch jobs from JSearch, score against CV, save to DB
    async searchJobs(req, res) {
        const { query, location, employmentType } = req.body;

        if (!query) {
            return res.status(400).json({ message: "Search query is required. e.g. 'Node.js developer'" });
        }

        // Get user's resume for AI matching
        const resume = await Resume.findOne({ user: req.user._id });
        if (!resume || !resume.isParsed) {
            return res.status(400).json({
                message: "Please upload and parse your resume first before searching jobs.",
            });
        }

        // Fetch from JSearch API
        const rawJobs = await fetchJobsFromJSearch({
            query,
            location: location || "India",
            employmentType: employmentType || null,
        });

        if (!rawJobs.length) {
            return res.json({ message: "No jobs found for this search", jobs: [] });
        }

        // Respond immediately with raw jobs so user isn't waiting
        // AI scoring happens in background and updates DB
        const normalisedJobs = rawJobs.map(normaliseJob);

        // Upsert jobs to DB (avoid duplicates via sourceJobId index)
        const savedJobs = [];
        for (const job of normalisedJobs) {
            try {
                const saved = await JobPosting.findOneAndUpdate(
                    { sourceJobId: job.sourceJobId },
                    { $setOnInsert: job },          // Only set fields on NEW documents
                    { upsert: true, new: true, runValidators: false }
                );
                savedJobs.push(saved);
            } catch (err) {
                // Skip duplicates silently
            }
        }

        // Return jobs immediately to user
        res.json({
            message: `Found ${savedJobs.length} jobs. AI scoring in progress...`,
            total: savedJobs.length,
            jobs: savedJobs,
        });

        // ── Background: Score each job with Gemini ─────────────
        (async () => {
            for (const job of savedJobs) {
                let attempts = 0;
                let success = false;

                while (attempts < 3 && !success) {
                    attempts++;
                    try {
                        // Skip if already scored for this user
                        const alreadyScored = job.matchScores?.some(
                            (s) => s.user.toString() === req.user._id.toString()
                        );
                        if (alreadyScored) {
                            success = true;
                            break;
                        }

                        const scoreResult = await scoreJobAgainstResume(resume, job);

                        await JobPosting.findByIdAndUpdate(job._id, {
                            $push: {
                                matchScores: {
                                    user: req.user._id,
                                    score: scoreResult.score,
                                    recommendation: scoreResult.recommendation,
                                    matchedSkills: scoreResult.matchedSkills || [],
                                    missingSkills: scoreResult.missingSkills || [],
                                    scoredAt: new Date(),
                                },
                            },
                        });

                        success = true;
                        // 6s delay to stay very safely within Gemini's 15 RPM free tier limit
                        await new Promise((r) => setTimeout(r, 6000));
                    } catch (err) {
                        console.error(`Scoring failed for job ${job._id} (attempt ${attempts}):`, err.message);
                        
                        if (attempts >= 3) {
                            console.error(`Giving up on job ${job._id} after 3 attempts. Saving fallback score.`);
                            // Save a fallback score so the job is marked as "scored" and doesn't remain broken forever
                            await JobPosting.findByIdAndUpdate(job._id, {
                                $push: {
                                    matchScores: {
                                        user: req.user._id,
                                        score: 0,
                                        recommendation: "low_match",
                                        matchedSkills: [],
                                        missingSkills: [],
                                        scoredAt: new Date(),
                                    },
                                },
                            });
                            break;
                        }

                        // If rate limited, wait a bit longer before next attempt
                        if (err.message.includes("429")) {
                            await new Promise((r) => setTimeout(r, 20000));
                        } else {
                            await new Promise((r) => setTimeout(r, 6000));
                        }
                    }
                }
            }
            console.log(`✅ AI scoring complete for ${savedJobs.length} jobs`);
        })();
    }

    // GET /api/jobs
    // Get all scored jobs for this user, sorted by match score
    async getMyJobs(req, res) {
        const {
            minScore = 0,
            recommended = false,  // true = only 80%+ matches
            page = 1,
            limit = 20,
        } = req.query;

        const filter = {
            "matchScores.user": req.user._id,
            isActive: true,
        };

        if (recommended === "true") {
            filter["matchScores.score"] = { $gte: 80 };
        } else if (minScore > 0) {
            filter["matchScores.score"] = { $gte: Number(minScore) };
        }

        const jobs = await JobPosting.find(filter)
            .sort({ "matchScores.score": -1 })   // Highest match first
            .skip((page - 1) * limit)
            .limit(Number(limit))
            .lean();

        // Attach only this user's score to each job
        const jobsWithScore = jobs.map((job) => {
            const myScore = job.matchScores?.find(
                (s) => s.user.toString() === req.user._id.toString()
            );
            return {
                ...job,
                matchScores: undefined,   // Remove all scores
                myMatch: myScore || null,  // Only show user's own score
            };
        });

        res.json({
            total: jobsWithScore.length,
            page: Number(page),
            jobs: jobsWithScore,
        });
    }

    // GET /api/jobs/recommended
    // Shortcut — only 80%+ match jobs
    async getRecommendedJobs(req, res) {
        req.query.recommended = "true";
        return this.getMyJobs(req, res);
    }

    // GET /api/jobs/:id
    // Get single job with full details
    async getJob(req, res) {
        const job = await JobPosting.findById(req.params.id).lean();

        if (!job) {
            return res.status(404).json({ message: "Job not found" });
        }

        const myScore = job.matchScores?.find(
            (s) => s.user.toString() === req.user._id.toString()
        );

        res.json({
            ...job,
            matchScores: undefined,
            myMatch: myScore || null,
        });
    }
}

module.exports = new JobController();