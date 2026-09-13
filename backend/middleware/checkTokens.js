const User = require('../models/User');
const Device = require('../models/Device');
const TokenTransaction = require('../models/TokenTransaction');

/**
 * Middleware to verify and deduct tokens before running an analysis.
 * Supports both authenticated users and anonymous guest devices (10 free tokens).
 */
const consumeTokens = (tokenCost = 1) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?._id || req.user?.id;

      // ==========================================
      // 1. AUTHENTICATED USER FLOW
      // ==========================================
      if (userId) {
        const user = await User.findById(userId);
        if (!user) {
          return res.status(404).json({ error: 'user_not_found', message: 'User not found' });
        }

        // Active unlimited plan check
        const hasActiveUnlimited =
          user.plan === 'unlimited' &&
          user.unlimitedUntil &&
          new Date(user.unlimitedUntil) > new Date();

        if (hasActiveUnlimited) {
          req.userPlan = 'unlimited';
          req.remainingTokens = 'Unlimited';
          return next();
        }

        // Token balance check
        if (user.tokenBalance < tokenCost) {
          return res.status(402).json({
            error: 'insufficient_tokens',
            message: `You need at least ${tokenCost} token(s) to analyze a resume. Please upgrade or buy more tokens.`,
            required: tokenCost,
            current: user.tokenBalance,
          });
        }

        // Deduct user tokens
        user.tokenBalance -= tokenCost;
        await user.save();

        // Log transaction
        await TokenTransaction.create({
          userId: user._id,
          type: 'usage',
          amount: -tokenCost,
          reason: 'resume_analysis_scan',
        });

        req.remainingTokens = user.tokenBalance;
        return next();
      }

      // ==========================================
      // 2. GUEST DEVICE FLOW (Anti-abuse by deviceHash)
      // ==========================================
      const deviceHash = req.headers['x-device-id'];
      if (!deviceHash) {
        return res.status(400).json({
          error: 'missing_device_id',
          message: 'Device identifier required for guest mode.',
        });
      }

      let device = await Device.findOne({ deviceHash });

      // First time device: create with 10 free tokens granted
      if (!device) {
        device = await Device.create({
          deviceHash,
          freeTokensGranted: 10,
          freeTokensUsed: 0,
        });
      }

      const tokensRemaining = device.freeTokensRemaining();

      if (tokensRemaining < tokenCost) {
        return res.status(402).json({
          error: 'guest_tokens_exhausted',
          message: 'Free guest tokens exhausted. Please sign up for an account.',
          remaining: 0,
        });
      }

      // Deduct guest token
      device.freeTokensUsed += tokenCost;
      await device.save();

      req.remainingTokens = device.freeTokensRemaining();
      next();
    } catch (err) {
      console.error('[Consume Tokens Middleware Error]:', err.message);
      return res.status(500).json({ error: 'token_deduction_failed', message: err.message });
    }
  };
};

module.exports = { consumeTokens };