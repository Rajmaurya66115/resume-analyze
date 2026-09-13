const User = require('../models/User');
const TokenTransaction = require('../models/TokenTransaction');

/**
 * Middleware to verify and deduct tokens before running an analysis.
 * Default cost per scan: 1 token (or 0 if user has an active 'unlimited' plan).
 */
const consumeTokens = (tokenCost = 1) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?._id;
      if (!userId) {
        return res.status(401).json({ error: 'unauthorized', message: 'Authentication required' });
      }

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({ error: 'user_not_found', message: 'User not found' });
      }

      // Check if user is on an active unlimited plan
      const hasActiveUnlimited =
        user.plan === 'unlimited' &&
        user.unlimitedUntil &&
        new Date(user.unlimitedUntil) > new Date();

      if (hasActiveUnlimited) {
        req.userPlan = 'unlimited';
        return next();
      }

      // Check token balance
      if (user.tokenBalance < tokenCost) {
        return res.status(402).json({
          error: 'insufficient_tokens',
          message: `You need at least ${tokenCost} token(s) to analyze a resume. Please upgrade or buy more tokens.`,
          required: tokenCost,
          current: user.tokenBalance,
        });
      }

      // Deduct tokens atomically
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
      next();
    } catch (err) {
      console.error('[Consume Tokens Middleware Error]:', err.message);
      return res.status(500).json({ error: 'token_deduction_failed', message: err.message });
    }
  };
};

module.exports = { consumeTokens };