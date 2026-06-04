const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const GitHubStrategy = require("passport-github2").Strategy;
const LinkedInStrategy = require("passport-linkedin-oauth2").Strategy;
const User = require("../models/User.model");

// ── GOOGLE ────────────────────────────────────────────────
passport.use(
  new GoogleStrategy(
    {
      clientID:     process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:  `${process.env.BACKEND_URL}/api/auth/google/callback`,
      proxy:        true,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ email: profile.emails[0].value });

        if (user) {
          // Already exists via local — link OAuth
          if (user.authProvider === "local") {
            user.authProvider = "google";
            user.providerId = profile.id;
            user.isEmailVerified = true;
            user.avatar = profile.photos[0]?.value || null;
            await user.save();
          }
          return done(null, user);
        }

        // New user via Google
        user = await User.create({
          name:            profile.displayName,
          email:           profile.emails[0].value,
          authProvider:    "google",
          providerId:      profile.id,
          isEmailVerified: true, // Google emails are verified
          avatar:          profile.photos[0]?.value || null,
        });

        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

// ── GITHUB ────────────────────────────────────────────────
passport.use(
  new GitHubStrategy(
    {
      clientID:     process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL:  `${process.env.BACKEND_URL}/api/auth/github/callback`,
      scope:        ["user:email"],
      proxy:        true,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email =
          profile.emails?.[0]?.value ||
          `${profile.username}@github.com`; // fallback if email hidden

        let user = await User.findOne({ email });

        if (user) {
          if (user.authProvider === "local") {
            user.authProvider = "github";
            user.providerId = profile.id;
            user.isEmailVerified = true;
            user.avatar = profile.photos[0]?.value || null;
            await user.save();
          }
          return done(null, user);
        }

        user = await User.create({
          name:            profile.displayName || profile.username,
          email,
          authProvider:    "github",
          providerId:      profile.id,
          isEmailVerified: true,
          avatar:          profile.photos[0]?.value || null,
        });

        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

// ── LINKEDIN ──────────────────────────────────────────────
passport.use(
  new LinkedInStrategy(
    {
      clientID:     process.env.LINKEDIN_CLIENT_ID,
      clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
      callbackURL:  `${process.env.BACKEND_URL}/api/auth/linkedin/callback`,
      scope:        ["openid", "profile", "email"],
      proxy:        true,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value;
        if (!email) return done(new Error("No email from LinkedIn"), null);

        let user = await User.findOne({ email });

        if (user) {
          if (user.authProvider === "local") {
            user.authProvider = "linkedin";
            user.providerId = profile.id;
            user.isEmailVerified = true;
            user.avatar = profile.photos?.[0]?.value || null;
            await user.save();
          }
          return done(null, user);
        }

        user = await User.create({
          name:            profile.displayName,
          email,
          authProvider:    "linkedin",
          providerId:      profile.id,
          isEmailVerified: true,
          avatar:          profile.photos?.[0]?.value || null,
        });

        done(null, user);
      } catch (err) {
        done(err, null);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  const user = await User.findById(id).select("-password");
  done(null, user);
});

module.exports = passport;