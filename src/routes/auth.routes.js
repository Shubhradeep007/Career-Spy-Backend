const express = require("express");
const router = express.Router();
const passport = require("../config/passport");
const authController = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth.middleware");
const { uploadAvatar } = require("../middleware/upload.middleware");

// ── LOCAL AUTH ────────────────────────────────────────────
router.post("/signup", uploadAvatar.single("avatar"), authController.signup);
router.post("/login", authController.login);
router.get("/me", protect, authController.getMe);
router.put("/me", protect, uploadAvatar.single("avatar"), authController.updateProfile);
router.delete("/me", protect, authController.deleteAccount);
router.get("/verify-email", authController.verifyEmail);
router.post("/resend-verification", authController.resendVerification);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
// router.post("/avatar", protect, upload.single("avatar"), authController.uploadAvatar);

// ── GOOGLE ────────────────────────────────────────────────
router.get("/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
);
router.get("/google/callback",
    passport.authenticate("google", { failureRedirect: `${process.env.FRONTEND_URL}/login?error=oauth_failed`, session: false }),
    authController.oauthSuccess
);

// ── GITHUB ────────────────────────────────────────────────
router.get("/github",
    passport.authenticate("github", { scope: ["user:email"] })
);
router.get("/github/callback",
    passport.authenticate("github", { failureRedirect: `${process.env.FRONTEND_URL}/login?error=oauth_failed`, session: false }),
    authController.oauthSuccess
);

// ── LINKEDIN ──────────────────────────────────────────────
router.get("/linkedin",
    passport.authenticate("linkedin")
);
router.get("/linkedin/callback",
    passport.authenticate("linkedin", { failureRedirect: `${process.env.FRONTEND_URL}/login?error=oauth_failed`, session: false }),
    authController.oauthSuccess
);

module.exports = router;