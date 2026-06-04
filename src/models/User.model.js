const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true },
        password: { type: String, default: null }, // null for OAuth users

        role: { type: String, enum: ["user", "admin"], default: "user" },
        isBanned: { type: Boolean, default: false },

        // Email Verification
        isEmailVerified: { type: Boolean, default: false },
        emailVerifyToken: { type: String, default: null },
        emailVerifyExpires: { type: Date, default: null },

        // Password Reset
        passwordResetToken: { type: String, default: null },
        passwordResetExpires: { type: Date, default: null },

        // OAuth
        authProvider: {
            type: String,
            enum: ["local", "google", "github", "linkedin"],
            default: "local",
        },
        providerId: { type: String, default: null }, // OAuth provider's user ID

        // Avatar from OAuth
        avatar: { type: String, default: null },

        // Billing and subscription fields
        razorpayOrderId: { type: String, default: null },
        razorpayPaymentId: { type: String, default: null },
        subscriptionStatus: { 
            type: String, 
            enum: ["free", "basic", "pro"], 
            default: "free" 
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);