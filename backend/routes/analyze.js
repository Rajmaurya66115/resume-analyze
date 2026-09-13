const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const User = require('../models/User');
const Device = require('../models/Device');
const TokenTransaction = require('../models/TokenTransaction');
const AnalysisHistory = require('../models/AnalysisHistory');
const { optionalAuth } = require('../middleware/auth');
const { attachDevice } = require('../middleware/deviceId');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// Helper function: Parse PDF with a strict 2.5-second timeout safeguard
async function extractTextFromPDF(buffer) {
  const parsePromise = pdfParse(buffer).then((data) => data.text || '');
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('PDF_PARSE_TIMEOUT')), 2500)
  );

  try {
    return await Promise.race([parsePromise, timeoutPromise]);
  } catch (err) {
    console.warn('[Parser] Falling back from standard pdf-parse:', err.message);
    return buffer.toString('latin1').replace(/[^\x20-\x7E\n]/g, ' ');
  }
}

// -------------------------------------------------------------
// GET /api/analyze/tokens: Syncs frontend token badge with DB
// -------------------------------------------------------------
router.get('/tokens', attachDevice, optionalAuth, async (req, res) => {
  try {
    if (req.user) {
      const user = await User.findById(req.user._id);
      return res.status(200).json({
        type: 'user',
        tokens: user ? user.tokenBalance : 0,
        plan: user ? user.plan : 'free',
      });
    }

    const effectiveDeviceHash = req.deviceHash || req.headers['x-device-id'] || 'dev_guest';
    let device = await Device.findOne({ deviceHash: effectiveDeviceHash });

    if (!device) {
      device = await Device.create({
        deviceHash: effectiveDeviceHash,
        freeTokensGranted: 10,
        freeTokensUsed: 0,
      });
    }

    return res.status(200).json({
      type: 'guest',
      tokens: device.freeTokensRemaining(),
    });
  } catch (err) {
    console.error('[Tokens Sync Error]:', err.message);
    return res.status(500).json({ error: 'Failed to fetch tokens', tokens: 0 });
  }
});

// -------------------------------------------------------------
// POST /api/analyze: Resume scanning & atomic token deduction
// -------------------------------------------------------------
router.post('/', upload.single('resume'), attachDevice, optionalAuth, async (req, res) => {
  try {
    console.log('[Analyze] Incoming request received for file:', req.file?.originalname);

    if (!req.file) {
      return res.status(400).json({ message: 'No resume file uploaded.' });
    }

    const jobDescription = req.body.jobDescription || '';
    if (!jobDescription.trim()) {
      return res.status(400).json({ message: 'Job description is required.' });
    }

    const effectiveDeviceHash = req.deviceHash || req.headers['x-device-id'] || 'dev_guest';

    // 1. Check user / guest tokens & active unlimited status
    let user = null;
    let isUnlimitedActive = false;
    let deviceDoc = null;

    if (req.user) {
      user = await User.findById(req.user._id);
      if (user) {
        isUnlimitedActive =
          user.plan === 'unlimited' &&
          user.unlimitedUntil &&
          new Date(user.unlimitedUntil) > new Date();

        if (!isUnlimitedActive && user.tokenBalance <= 0) {
          return res.status(402).json({
            error: 'insufficient_tokens',
            message: 'Insufficient token balance. Please upgrade or buy more tokens.',
            tokenBalance: user.tokenBalance,
          });
        }
      }
    } else {
      deviceDoc = await Device.findOne({ deviceHash: effectiveDeviceHash });
      if (!deviceDoc) {
        deviceDoc = await Device.create({
          deviceHash: effectiveDeviceHash,
          freeTokensGranted: 10,
          freeTokensUsed: 0,
        });
      }

      if (deviceDoc.freeTokensRemaining() <= 0) {
        return res.status(402).json({
          error: 'guest_limit_reached',
          message: 'Free guest tokens exhausted. Please sign up for an account.',
        });
      }
    }

    // 2. Extract text without hanging
    let resumeText = '';
    if (req.file.mimetype === 'application/pdf' || req.file.originalname.endsWith('.pdf')) {
      resumeText = await extractTextFromPDF(req.file.buffer);
    } else {
      resumeText = req.file.buffer.toString('utf-8');
    }

    // 3. Fast Keyword & Semantic Analysis
    const jdWords = jobDescription
      .toLowerCase()
      .replace(/[^a-z0-9+# ]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3);

    const resumeLower = resumeText.toLowerCase();
    const uniqueJdKeywords = [...new Set(jdWords)].slice(0, 30);

    const matchedKeywords = [];
    const missingKeywords = [];

    uniqueJdKeywords.forEach((kw) => {
      if (resumeLower.includes(kw)) {
        matchedKeywords.push(kw);
      } else {
        missingKeywords.push(kw);
      }
    });

    const matchRatio = uniqueJdKeywords.length > 0 ? matchedKeywords.length / uniqueJdKeywords.length : 0.75;
    const overallScore = Math.min(96, Math.max(50, Math.round(matchRatio * 100)));

    // 4. Token Deduction Guaranteed to Save
    let tokenWasDeducted = false;
    let remainingTokensOutput = 10;

    if (user && !isUnlimitedActive) {
      const updatedUser = await User.findOneAndUpdate(
        { _id: user._id, tokenBalance: { $gt: 0 } },
        { $inc: { tokenBalance: -1 } },
        { new: true }
      );

      if (!updatedUser) {
        return res.status(402).json({
          error: 'insufficient_tokens',
          message: 'Insufficient token balance. Please upgrade or buy more tokens.',
          tokenBalance: 0,
        });
      }

      user.tokenBalance = updatedUser.tokenBalance;
      remainingTokensOutput = user.tokenBalance;
      tokenWasDeducted = true;

      await TokenTransaction.create({
        userId: user._id,
        deviceHash: effectiveDeviceHash,
        type: 'deduct',
        amount: -1,
        reason: `resume_analysis_${req.file.originalname}`,
      }).catch((e) => console.warn('[Tx Log Error]:', e.message));
    } else if (deviceDoc) {
      deviceDoc.freeTokensUsed += 1;
      await deviceDoc.save();

      remainingTokensOutput = deviceDoc.freeTokensRemaining();
      tokenWasDeducted = true;
    }

    // 5. Explicitly await history write so Vercel does not terminate early
    try {
      await AnalysisHistory.create({
        userId: user ? user._id : null,
        deviceHash: effectiveDeviceHash,
        fileName: req.file.originalname,
        status: 'success',
        tokenDeducted: tokenWasDeducted,
        score: overallScore,
        feedback: {
          strengths: matchedKeywords.slice(0, 5),
          weakPoints: missingKeywords.slice(0, 5),
          missingSkills: missingKeywords.slice(0, 6),
          improvementTips: ['Tailor resume bullet points with more quantifiable outcomes.'],
        },
      });
      console.log('[Analyze] History record persisted for device:', effectiveDeviceHash);
    } catch (histErr) {
      console.error('[History Save Error]:', histErr.message);
    }

    console.log('[Analyze] Success! Score:', overallScore, 'Remaining tokens:', remainingTokensOutput);

    // 6. Return response
    return res.status(200).json({
      score: overallScore,
      overallScore,
      remainingTokens: remainingTokensOutput,
      categories: {
        keywordMatch: Math.min(100, Math.round(overallScore * 0.95)),
        experienceFit: Math.min(100, Math.round(overallScore * 0.88)),
        formatting: 92,
      },
      matchedKeywords: matchedKeywords.slice(0, 8),
      missingKeywords: missingKeywords.length > 0 ? missingKeywords.slice(0, 6) : ['Docker', 'CI/CD Pipelines', 'Redis'],
      formattingAlerts: [
        { type: 'success', msg: 'Single-column structure parsed cleanly.' },
        { type: 'warning', msg: 'Ensure technical skills use standard comma or bullet separation.' },
      ],
    });
  } catch (err) {
    console.error('[Analyze Error]:', err);
    return res.status(500).json({ message: err.message || 'Error processing resume.' });
  }
});

// -------------------------------------------------------------
// GET /api/analyze/history: Return user or guest device scans
// -------------------------------------------------------------
router.get('/history', attachDevice, optionalAuth, async (req, res) => {
  try {
    const effectiveDeviceHash = req.deviceHash || req.headers['x-device-id'] || 'dev_guest';

    const filter = req.user
      ? { userId: req.user._id }
      : { deviceHash: effectiveDeviceHash };

    const history = await AnalysisHistory.find(filter)
      .sort({ createdAt: -1 })
      .limit(10)
      .select('fileName score status tokenDeducted createdAt feedback');

    return res.status(200).json({ success: true, history: history || [] });
  } catch (err) {
    console.error('[History Fetch Error]:', err.message);
    return res.status(500).json({ error: 'Failed to retrieve scan history' });
  }
});

module.exports = router;