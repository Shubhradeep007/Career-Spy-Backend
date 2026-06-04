const crypto = require("crypto");
const User = require("../models/User.model");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { sendVerificationEmail, sendPasswordResetEmail } = require("../services/emailService");
const cloudinary = require("../config/cloudinary");

const deleteCloudinaryImage = async (imageUrl) => {
    if (!imageUrl || !imageUrl.includes("res.cloudinary.com")) return;
    try {
        const urlParts = imageUrl.split('/');
        const filenameWithExt = urlParts[urlParts.length - 1];
        const folderName = urlParts[urlParts.length - 2];
        const filename = filenameWithExt.split('.')[0];
        const publicId = `${folderName}/${filename}`;
        await cloudinary.uploader.destroy(publicId);
    } catch (err) {
        console.error("Cloudinary delete error:", err);
    }
};

const generateToken = (id) =>
    jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

const generateRandomToken = () =>
    crypto.randomBytes(32).toString("hex");

class AuthController {
    constructor() {
        this.signup = this.signup.bind(this);
        this.login = this.login.bind(this);
        this.getMe = this.getMe.bind(this);
        this.verifyEmail = this.verifyEmail.bind(this);
        this.resendVerification = this.resendVerification.bind(this);
        this.forgotPassword = this.forgotPassword.bind(this);
        this.resetPassword = this.resetPassword.bind(this);
        this.oauthSuccess = this.oauthSuccess.bind(this);
        this.uploadAvatar = this.uploadAvatar.bind(this);
        this.updateProfile = this.updateProfile.bind(this);
        this.deleteAccount = this.deleteAccount.bind(this);
    }

    // POST /api/auth/signup
    async signup(req, res) {
        const { name, email, password } = req.body;

        if (!name || !email || !password)
            return res.status(400).json({ message: "All fields are required" });

        const exists = await User.findOne({ email });
        if (exists) return res.status(400).json({ message: "Email already registered" });

        const hashed = await bcrypt.hash(password, 10);

        // Generate email verification token
        const emailVerifyToken = generateRandomToken();
        const emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hrs

        const avatarUrl = req.file ? req.file.path : null;

        const user = await User.create({
            name,
            email,
            password: hashed,
            avatar: avatarUrl,
            emailVerifyToken,
            emailVerifyExpires,
        });

        // Send verification email
        await sendVerificationEmail(email, name, emailVerifyToken);

        res.status(201).json({
            message: "Account created. Please check your email to verify your account.",
        });
    }

    // POST /api/auth/login
    async login(req, res) {
        const { email, password } = req.body;

        if (!email || !password)
            return res.status(400).json({ message: "All fields are required" });

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "Invalid credentials" });

        // Block OAuth users from logging in with password
        if (user.authProvider !== "local")
            return res.status(400).json({
                message: `This account uses ${user.authProvider} login. Please use that instead.`,
            });

        if (user.isBanned)
            return res.status(403).json({ message: "Account banned" });

        // Block unverified users
        if (!user.isEmailVerified)
            return res.status(403).json({
                message: "Email not verified. Please check your inbox.",
                isVerified: false,
            });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(400).json({ message: "Invalid credentials" });

        res.json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar,
            subscriptionStatus: user.subscriptionStatus || "free",
            token: generateToken(user._id),
        });
    }

    // GET /api/auth/me
    async getMe(req, res) {
        res.json(req.user);
    }

    // PUT /api/auth/me
    async updateProfile(req, res) {
        const { name } = req.body;
        const updateData = {};

        if (name) updateData.name = name;
        if (req.file) {
            updateData.avatar = req.file.path;
            // Delete the old avatar from Cloudinary if it exists
            if (req.user.avatar) {
                await deleteCloudinaryImage(req.user.avatar);
            }
        }

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ message: "No data provided to update" });
        }

        const user = await User.findByIdAndUpdate(
            req.user._id,
            updateData,
            { new: true }
        ).select("-password");

        res.json({
            message: "Profile updated successfully",
            user,
        });
    }

    // DELETE /api/auth/me
    async deleteAccount(req, res) {
        const userId = req.user._id;

        // Find user to get the avatar URL
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        // Delete avatar from Cloudinary if it exists
        if (user.avatar) {
            await deleteCloudinaryImage(user.avatar);
        }

        await User.findByIdAndDelete(userId);

        res.json({ message: "Account deleted successfully" });
    }

    // GET /api/auth/verify-email?token=xxx
    async verifyEmail(req, res) {
        const { token } = req.query;
        if (!token) return res.status(400).json({ message: "Token is required" });

        const user = await User.findOne({
            emailVerifyToken: token,
            emailVerifyExpires: { $gt: Date.now() },
        });

        if (!user)
            return res.status(400).json({ message: "Invalid or expired verification link" });

        user.isEmailVerified = true;
        user.emailVerifyToken = null;
        user.emailVerifyExpires = null;
        await user.save();

        res.json({ message: "Email verified successfully. You can now login." });
    }

    // POST /api/auth/resend-verification
    async resendVerification(req, res) {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: "Email is required" });

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });
        if (user.isEmailVerified)
            return res.status(400).json({ message: "Email already verified" });

        const emailVerifyToken = generateRandomToken();
        const emailVerifyExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        user.emailVerifyToken = emailVerifyToken;
        user.emailVerifyExpires = emailVerifyExpires;
        await user.save();

        await sendVerificationEmail(email, user.name, emailVerifyToken);

        res.json({ message: "Verification email resent. Please check your inbox." });
    }

    // POST /api/auth/forgot-password
    async forgotPassword(req, res) {
        const { email } = req.body;
        if (!email) return res.status(400).json({ message: "Email is required" });

        const user = await User.findOne({ email });

        // Always return success — don't reveal if email exists
        if (!user)
            return res.json({ message: "If that email exists, a reset link has been sent." });

        const passwordResetToken = generateRandomToken();
        const passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hr

        user.passwordResetToken = passwordResetToken;
        user.passwordResetExpires = passwordResetExpires;
        await user.save();

        await sendPasswordResetEmail(email, user.name, passwordResetToken);

        res.json({ message: "If that email exists, a reset link has been sent." });
    }

    // POST /api/auth/reset-password
    async resetPassword(req, res) {
        const { token, newPassword } = req.body;

        if (!token || !newPassword)
            return res.status(400).json({ message: "Token and new password are required" });

        const user = await User.findOne({
            passwordResetToken: token,
            passwordResetExpires: { $gt: Date.now() },
        });

        if (!user)
            return res.status(400).json({ message: "Invalid or expired reset link" });

        user.password = await bcrypt.hash(newPassword, 10);
        user.passwordResetToken = null;
        user.passwordResetExpires = null;
        await user.save();

        res.json({ message: "Password reset successful. You can now login." });
    }

    // GET /api/auth/oauth-success — called after OAuth redirect
    async oauthSuccess(req, res) {
        const user = req.user;
        const token = generateToken(user._id);

        // Redirect to frontend with token in query param
        // Frontend reads this token and stores in cookie
        res.redirect(
            `${process.env.FRONTEND_URL}/oauth-success?token=${token}&name=${encodeURIComponent(user.name)}&email=${encodeURIComponent(user.email)}&role=${user.role}`
        );
    }

    // POST /api/auth/avatar
    async uploadAvatar(req, res) {
        if (!req.file) {
            return res.status(400).json({ message: "No image file provided" });
        }

        // req.file.path contains the Cloudinary URL because of multer-storage-cloudinary
        const avatarUrl = req.file.path;

        // Update the logged-in user's avatar
        const user = await User.findByIdAndUpdate(
            req.user._id,
            { avatar: avatarUrl },
            { new: true }
        ).select("-password");

        res.json({
            message: "Avatar updated successfully",
            avatar: user.avatar,
            user,
        });
    }
}

module.exports = new AuthController();