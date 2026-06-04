const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth.middleware");
const { createOrder, verifyPaymentSignature, isRazorpayConfigured } = require("../services/razorpayService");
const User = require("../models/User.model");

// POST /api/payments/create-order
router.post("/create-order", protect, async (req, res) => {
  const { plan } = req.body;
  if (!plan || !["basic", "pro"].includes(plan)) {
    return res.status(400).json({ message: "Invalid plan type. Select basic or pro." });
  }

  try {
    const order = await createOrder(req.user, plan);
    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      mock: !!order.mock,
      keyId: process.env.RAZORPAY_KEY_ID || ""
    });
  } catch (error) {
    console.error("❌ Razorpay order creation error:", error.message);
    res.status(500).json({ message: error.message || "Failed to create payment order" });
  }
});

// POST /api/payments/verify
router.post("/verify", protect, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;

  if (!plan || !["basic", "pro"].includes(plan)) {
    return res.status(400).json({ message: "Invalid plan specified." });
  }

  // If it is NOT a mock payment, verify signature
  const isMock = razorpay_order_id && razorpay_order_id.startsWith("mock_order_");
  
  if (!isMock) {
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing Razorpay verification tokens." });
    }

    try {
      const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
      if (!isValid) {
        return res.status(400).json({ message: "Invalid payment signature verification failed." });
      }
    } catch (error) {
      return res.status(500).json({ message: error.message || "Verification failed." });
    }
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      {
        subscriptionStatus: plan,
        razorpayOrderId: razorpay_order_id || "mock_order",
        razorpayPaymentId: razorpay_payment_id || "mock_payment"
      },
      { new: true }
    ).select("-password");

    res.json({
      message: `Transaction verified successfully! Upgraded to ${plan.toUpperCase()} tier.`,
      user: updatedUser
    });
  } catch (error) {
    res.status(500).json({ message: "Database update failed after payment verification." });
  }
});

// POST /api/payments/mock-upgrade
router.post("/mock-upgrade", protect, async (req, res) => {
  const { plan } = req.body;
  if (!plan || !["free", "basic", "pro"].includes(plan)) {
    return res.status(400).json({ message: "Invalid plan type." });
  }

  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { 
        subscriptionStatus: plan,
        razorpayOrderId: plan === "free" ? null : "mock_order",
        razorpayPaymentId: plan === "free" ? null : "mock_payment"
      },
      { new: true }
    ).select("-password");

    res.json({
      message: `Mock transaction successful! Upgraded to ${plan.toUpperCase()} tier.`,
      user: updatedUser
    });
  } catch (error) {
    res.status(500).json({ message: "Mock upgrade error" });
  }
});

// GET /api/payments/status
router.get("/status", protect, async (req, res) => {
  res.json({
    subscriptionStatus: req.user.subscriptionStatus || "free",
    isRazorpayConfigured: isRazorpayConfigured()
  });
});

module.exports = router;
