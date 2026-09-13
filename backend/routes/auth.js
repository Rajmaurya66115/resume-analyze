const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Device = require('../models/Device');
const AnalysisHistory = require('../models/AnalysisHistory');
const { attachDevice } = require('../middleware/deviceId');
const { JWT_SECRET, optionalAuth, requireAuth } = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../utils/mailer');

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

function issueToken(user) {
  return jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '30d' });
}

// GET /api/auth/me — Restore user profile on refresh
router.get('/me', optionalAuth, requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-passwordHash');
    if (!user) {
      return res.status(404).json({ error: 'not_found', message: 'User not found' });
    }
    return res.status(200).json({
      id: user._id,
      email: user.email,
      tokenBalance: user.tokenBalance,
      plan: user.plan,
      avatarUrl: user.avatarUrl,
    });
  } catch (err) {
    console.error('Session retrieval error:', err);
    return res.status(500).json({ error: 'server_error', message: 'Failed to fetch user session' });
  }
});

// POST /api/auth/signup
router.post('/signup', attachDevice, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password || password.length < 8) {
      return res.status(400).json({ error: 'invalid_input', message: 'Email and an 8+ character password are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'email_taken', message: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const initialTokens = req.device ? req.device.freeTokensRemaining() : 10;

    const user = await User.create({
      email,
      passwordHash,
      deviceHash: req.deviceHash,
      tokenBalance: initialTokens,
      plan: 'free',
    });

    if (req.device) {
      await Device.findByIdAndUpdate(req.device._id, { linkedUserId: user._id });
      await AnalysisHistory.updateMany(
        { deviceHash: req.deviceHash, userId: null },
        { $set: { userId: user._id } }
      );
    }

    const token = issueToken(user);
    res.status(201).json({ token, user: { id: user._id, email: user.email, tokenBalance: user.tokenBalance, plan: user.plan } });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'invalid_credentials', message: 'Incorrect email or password' });
    }
    const token = issueToken(user);
    res.json({ token, user: { id: user._id, email: user.email, tokenBalance: user.tokenBalance, plan: user.plan } });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/google
router.post('/google', attachDevice, async (req, res, next) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'missing_credential', message: 'Google credential token is required' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const { sub: googleId, email, picture } = ticket.getPayload();

    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (!user) {
      const initialTokens = req.device ? req.device.freeTokensRemaining() : 10;
      user = await User.create({
        email,
        googleId,
        authProvider: 'google',
        avatarUrl: picture,
        deviceHash: req.deviceHash,
        tokenBalance: initialTokens,
        plan: 'free',
      });
    } else {
      let needsSave = false;
      if (!user.googleId) {
        user.googleId = googleId;
        needsSave = true;
      }
      if (!user.avatarUrl && picture) {
        user.avatarUrl = picture;
        needsSave = true;
      }
      if (needsSave) await user.save();
    }

    if (req.device) {
      await Device.findByIdAndUpdate(req.device._id, { linkedUserId: user._id });
      await AnalysisHistory.updateMany(
        { deviceHash: req.deviceHash, userId: null },
        { $set: { userId: user._id } }
      );
    }

    const token = issueToken(user);
    return res.status(200).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        tokenBalance: user.tokenBalance,
        plan: user.plan,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    console.error('Google Auth Error:', err);
    return res.status(401).json({ error: 'auth_failed', message: 'Google token verification failed' });
  }
});

// POST /api/auth/github
router.post('/github', attachDevice, async (req, res, next) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'missing_code', message: 'GitHub authorization code required' });
    }

    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      return res.status(400).json({ error: tokenData.error, message: tokenData.error_description });
    }

    const profileRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();

    let email = profile.email;
    if (!email) {
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const emails = await emailRes.json();
      const primary = emails.find((e) => e.primary && e.verified);
      email = primary ? primary.email : `${profile.id}+github@users.noreply.github.com`;
    }

    let user = await User.findOne({ $or: [{ githubId: profile.id.toString() }, { email }] });
    if (!user) {
      const initialTokens = req.device ? req.device.freeTokensRemaining() : 10;
      user = await User.create({
        email,
        githubId: profile.id.toString(),
        authProvider: 'github',
        avatarUrl: profile.avatar_url,
        deviceHash: req.deviceHash,
        tokenBalance: initialTokens,
        plan: 'free',
      });
    } else {
      let needsSave = false;
      if (!user.githubId) {
        user.githubId = profile.id.toString();
        needsSave = true;
      }
      if (!user.avatarUrl && profile.avatar_url) {
        user.avatarUrl = profile.avatar_url;
        needsSave = true;
      }
      if (needsSave) await user.save();
    }

    if (req.device) {
      await Device.findByIdAndUpdate(req.device._id, { linkedUserId: user._id });
      await AnalysisHistory.updateMany(
        { deviceHash: req.deviceHash, userId: null },
        { $set: { userId: user._id } }
      );
    }

    const token = issueToken(user);
    return res.status(200).json({
      token,
      user: {
        id: user._id,
        email: user.email,
        tokenBalance: user.tokenBalance,
        plan: user.plan,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    console.error('GitHub Auth Error:', err);
    return res.status(500).json({ error: 'auth_failed', message: err.message });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'missing_email', message: 'Please enter your email.' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an account exists with this email, a reset link has been sent.',
      });
    }

    // Generate secure token valid for 1 hour
    const token = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    const origin = req.headers.origin || 'https://resume-analyze-nu.vercel.app';
    const resetUrl = `${origin}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

    await sendPasswordResetEmail(email, resetUrl);

    return res.status(200).json({
      success: true,
      message: 'Password reset link sent! Please check your inbox.',
    });
  } catch (err) {
    console.error('[Forgot Password Error]:', err);
    return res.status(500).json({
      error: 'server_error',
      message: err.message || 'Failed to process reset request.',
      code: err.code || null,
    });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, email, newPassword } = req.body;
    if (!token || !email || !newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'invalid_input', message: 'Token, email, and 8+ char password required.' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      email,
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ error: 'invalid_token', message: 'Password reset link is invalid or has expired.' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    return res.status(200).json({ success: true, message: 'Password has been successfully updated.' });
  } catch (err) {
    console.error('[Reset Password Error]:', err);
    return res.status(500).json({
      error: 'server_error',
      message: err.message || 'Failed to reset password.',
      code: err.code || null,
    });
  }
});

module.exports = router;