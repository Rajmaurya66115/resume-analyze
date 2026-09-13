const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const User = require('../models/User');
const TokenTransaction = require('../models/TokenTransaction');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

const keyId = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';
const keySecret = process.env.RAZORPAY_KEY_SECRET || 'secret_placeholder';

let razorpay = null;
try {
  if (keyId && !keyId.includes('placeholder')) {
    razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }
} catch (e) {
  console.warn('[Razorpay] Init warning:', e.message);
}

// Pricing in INR paise (1 INR = 100 paise)
const PLANS = {
  starter: { tokens: 20, amount: 9900, currency: 'INR', label: 'Starter' },
  pro: { tokens: 75, amount: 24900, currency: 'INR', label: 'Pro' },
  unlimited: { amount: 49900, currency: 'INR', durationDays: 30, label: 'Unlimited' },
};

// Route: POST /api/purchase/create-order
router.post('/create-order', optionalAuth, async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Please sign in or create an account before purchasing tokens.',
      });
    }

    const { planKey } = req.body;
    const plan = PLANS[planKey];

    if (!plan) {
      return res.status(400).json({ error: 'invalid_plan', message: 'Unknown plan selected' });
    }

    const isMock = !process.env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID.includes('placeholder');
    if (isMock || !razorpay) {
      return res.status(200).json({
        orderId: `order_mock_${Date.now()}`,
        amount: plan.amount,
        currency: plan.currency,
        keyId: 'rzp_test_placeholder',
        planKey,
        isMock: true,
      });
    }

    const options = {
      amount: plan.amount,
      currency: plan.currency,
      receipt: `rcpt_${req.user._id.toString().slice(-6)}_${Date.now().toString().slice(-6)}`,
      notes: {
        userId: req.user._id.toString(),
        planKey,
      },
    };

    const order = await razorpay.orders.create(options);

    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      planKey,
      isMock: false,
    });
  } catch (err) {
    console.error('[Razorpay Order Error]:', err);
    return res.status(500).json({
      error: 'order_failed',
      message: err.message || 'Failed to create payment order',
    });
  }
});

// Route: POST /api/purchase/verify-payment (Client-side handler)
router.post('/verify-payment', optionalAuth, async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Authentication session expired. Please sign in again.',
      });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, planKey } = req.body;

    const plan = PLANS[planKey];
    if (!plan) {
      return res.status(400).json({ error: 'invalid_plan', message: 'Unknown plan selected' });
    }

    // Double-spending check
    const existingTx = await TokenTransaction.findOne({
      reason: { $regex: razorpay_order_id },
    });
    if (existingTx) {
      const user = await User.findById(req.user._id);
      return res.status(200).json({
        success: true,
        alreadyProcessed: true,
        plan: user.plan,
        tokenBalance: user.tokenBalance,
      });
    }

    // Signature verification
    if (!razorpay_signature || !razorpay_payment_id) {
      return res.status(400).json({ error: 'missing_fields', message: 'Incomplete payment parameters' });
    }

    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'invalid_signature', message: 'Payment verification failed' });
    }

    const currentUser = await User.findById(req.user._id);
    let update = {};

    if (planKey === 'unlimited') {
      const baseTime =
        currentUser?.unlimitedUntil && new Date(currentUser.unlimitedUntil) > new Date()
          ? new Date(currentUser.unlimitedUntil).getTime()
          : Date.now();
      update = {
        plan: 'unlimited',
        unlimitedUntil: new Date(baseTime + plan.durationDays * 86400000),
      };
    } else {
      update = {
        $inc: { tokenBalance: plan.tokens },
        plan: planKey,
      };
    }

    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true });

    await TokenTransaction.create({
      userId: user._id,
      type: 'purchase',
      amount: planKey === 'unlimited' ? 0 : plan.tokens,
      reason: `razorpay_${planKey}_order_${razorpay_order_id}_pay_${razorpay_payment_id}`,
    });

    return res.status(200).json({
      success: true,
      plan: user.plan,
      tokenBalance: user.tokenBalance,
    });
  } catch (err) {
    console.error('[Verify Payment Error]:', err);
    return res.status(500).json({
      error: 'verify_failed',
      message: err.message || 'Payment verification failed',
    });
  }
});

// Route: POST /api/purchase/webhook (Razorpay server-to-server handler)
router.post('/webhook', async (req, res) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers['x-razorpay-signature'];
    const isProduction = process.env.NODE_ENV === 'production';

    // Strict security in production: require both secret and signature header
    if (isProduction) {
      if (!webhookSecret) {
        console.error('[Razorpay Webhook Fatal]: RAZORPAY_WEBHOOK_SECRET missing in production.');
        return res.status(500).json({ error: 'Webhook secret not configured on server.' });
      }
      if (!signature) {
        console.warn('[Razorpay Webhook Rejected]: Missing x-razorpay-signature header in production.');
        return res.status(400).json({ error: 'Missing webhook signature header.' });
      }
    }

    // Verify HMAC signature
    if (signature && webhookSecret) {
      const payloadString = req.rawBody || JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payloadString)
        .digest('hex');

      if (expectedSignature !== signature) {
        console.error('[Razorpay Webhook]: Signature mismatch');
        return res.status(400).send('Invalid signature');
      }
    } else if (!isProduction) {
      console.log('[Razorpay Webhook]: Processing request in development mode.');
    }

    const { event, payload } = req.body;

    if (event === 'payment.captured' && payload?.payment?.entity) {
      const payment = payload.payment.entity;
      const orderId = payment.order_id;
      const userId = payment.notes?.userId;
      const planKey = payment.notes?.planKey;
      const plan = PLANS[planKey];

      if (userId && plan) {
        const existingTx = await TokenTransaction.findOne({
          reason: { $regex: orderId },
        });

        // Credit if not already processed by client verify-payment
        if (!existingTx) {
          const targetUser = await User.findById(userId);
          let update = {};

          if (planKey === 'unlimited') {
            const baseTime =
              targetUser?.unlimitedUntil && new Date(targetUser.unlimitedUntil) > new Date()
                ? new Date(targetUser.unlimitedUntil).getTime()
                : Date.now();
            update = {
              plan: 'unlimited',
              unlimitedUntil: new Date(baseTime + plan.durationDays * 86400000),
            };
          } else {
            update = {
              $inc: { tokenBalance: plan.tokens },
              plan: planKey,
            };
          }

          await User.findByIdAndUpdate(userId, update);

          await TokenTransaction.create({
            userId,
            type: 'purchase',
            amount: planKey === 'unlimited' ? 0 : plan.tokens,
            reason: `razorpay_${planKey}_order_${orderId}_pay_${payment.id}_webhook`,
          });

          console.log(`[Webhook Success]: Credited ${planKey} to user ${userId}`);
        } else {
          console.log(`[Webhook]: Order ${orderId} was already credited previously.`);
        }
      }
    }

    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('[Webhook Error]:', err.message);
    return res.status(500).json({ error: 'webhook_failed' });
  }
});

module.exports = router;