require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');

const authRoutes = require('./routes/auth');
const analyzeRoutes = require('./routes/analyze');
const purchaseRoutes = require('./routes/purchase');

const app = express();

// 1. Production Security Headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// 2. Dynamic CORS: Automatically permits localhost and all Vercel domains
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);

      const isLocal = origin.includes('localhost');
      const isVercel = origin.endsWith('.vercel.app');
      const isCustomFrontend = process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL;

      if (isLocal || isVercel || isCustomFrontend) {
        callback(null, true);
      } else {
        callback(new Error(`Blocked by CORS policy: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-razorpay-signature', 'x-device-id'],
  })
);

// 3. Raw Body Capture for Razorpay Webhook
app.use(
  express.json({
    verify: (req, res, buf) => {
      if (req.originalUrl.startsWith('/api/purchase/webhook')) {
        req.rawBody = buf.toString();
      }
    },
  })
);
app.use(express.urlencoded({ extended: true }));

// 4. Serverless Database Connection Caching (Must run BEFORE routes)
const MONGODB_URI = process.env.MONGODB_URI;
let cachedDb = null;

async function connectDB() {
  if (cachedDb && mongoose.connection.readyState === 1) {
    return cachedDb;
  }
  try {
    cachedDb = await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log('Connected to MongoDB');
    return cachedDb;
  } catch (err) {
    console.error('Database connection failed:', err.message);
    throw err;
  }
}

// Middleware: connect to DB before any route handler executes
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(500).json({ error: 'database_unavailable', message: 'Database connection failed.' });
  }
});

// 5. Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'too_many_requests', message: 'Too many authentication attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

// 6. Routes (Now protected by active DB connection above)
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/analyze', apiLimiter, analyzeRoutes);
app.use('/api/purchase', purchaseRoutes);

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]:', err.message);
  res.status(err.status || 500).json({
    error: 'server_error',
    message: process.env.NODE_ENV === 'production' ? 'An internal error occurred.' : err.message,
  });
});

// Run locally if in dev
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`Local development server running on port ${PORT}`));
}

module.exports = app;