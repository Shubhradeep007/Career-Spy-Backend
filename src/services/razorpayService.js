const Razorpay = require("razorpay");
const crypto = require("crypto");

let razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
  });
}

const createOrder = async (user, plan) => {
  if (!["basic", "pro"].includes(plan)) {
    throw new Error("Invalid plan selection");
  }

  const planDetails = {
    basic: {
      amount: 50000, // ₹500.00 (50000 paise)
    },
    pro: {
      amount: 150000, // ₹1500.00 (150000 paise)
    }
  };

  const selected = planDetails[plan];

  if (!razorpay) {
    console.warn("⚠️ Razorpay API Keys missing. Using mock sandbox order creation.");
    return {
      id: `mock_order_${Date.now()}`,
      amount: selected.amount,
      currency: "INR",
      mock: true
    };
  }

  const options = {
    amount: selected.amount,
    currency: "INR",
    receipt: `receipt_${user._id.toString()}_${plan}`,
    notes: {
      userId: user._id.toString(),
      plan: plan
    }
  };

  const order = await razorpay.orders.create(options);
  return order;
};

const verifyPaymentSignature = (orderId, paymentId, signature) => {
  if (orderId && orderId.startsWith("mock_order_")) {
    return true; // Auto-pass mock orders
  }

  if (!razorpay) {
    throw new Error("Razorpay is not configured");
  }

  const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET);
  hmac.update(`${orderId}|${paymentId}`);
  const generatedSignature = hmac.digest("hex");

  return generatedSignature === signature;
};

module.exports = {
  createOrder,
  verifyPaymentSignature,
  isRazorpayConfigured: () => !!razorpay
};
