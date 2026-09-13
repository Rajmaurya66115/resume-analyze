require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./db');

const authRoutes = require('./routes/auth');
const analyzeRoutes = require('./routes/analyze');
const purchaseRoutes = require('./routes/purchase');
const contactRoutes = require('./routes/contact');

const app = express();

// Trust Vercel's reverse proxy for express-rate-limit
app.set('trust proxy', 1);

// 1. Security Headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// 2. CORS Handling
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
        callback(new Error(`Blocked by CORS: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-razorpay-signature', 'x-device-id'],
  })
);

// 3. Request Parsing
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

// 4. Connect to DB Before Every Route
app.use(async (req, res, next) => {
  if (req.path === '/api/health') return next();
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('[DB Middleware Error]:', err.message);
    return res.status(500).json({
      error: 'database_unavailable',
      message: 'Failed to connect to MongoDB Atlas. Check credentials or network access.',
    });
  }
});

// 5. Rate Limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'too_many_requests', message: 'Too many authentication attempts.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

// 6. Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/analyze', apiLimiter, analyzeRoutes);
app.use('/api/purchase', purchaseRoutes);
app.use('/api/contact', contactRoutes);

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

if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;