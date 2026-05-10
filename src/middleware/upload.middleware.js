const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary");

// ── AVATAR UPLOAD (images only) ───────────────────────────
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "career_spy_avatars",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
    transformation: [{ width: 500, height: 500, crop: "limit" }],
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// ── RESUME UPLOAD (PDF / DOCX only) ──────────────────────
const resumeStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    return {
      folder:          "career_spy_resumes",
      resource_type:   "raw",               // Required for non-image files
      allowed_formats: ["pdf", "doc", "docx"],
      public_id:       `resume_${req.user._id}_${Date.now()}`,
    };
  },
});

const resumeFileFilter = (req, file, cb) => {
  const allowed = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF and Word documents are allowed"), false);
  }
};

const uploadResume = multer({
  storage:    resumeStorage,
  limits:     { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: resumeFileFilter,
});

module.exports = { uploadAvatar, uploadResume };