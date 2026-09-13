const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key_resume_12345';

function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token && token !== 'null' && token !== 'undefined') {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = { _id: decoded.userId || decoded.id, email: decoded.email };
      }
    }
  } catch (err) {
    // Expired or missing token is fine for optional auth
    req.user = null;
  }
  next();
}

function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'unauthorized', message: 'Sign in is required' });
    }

    const token = authHeader.split(' ')[1];
    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({ error: 'unauthorized', message: 'Invalid session token. Please sign in.' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { _id: decoded.userId || decoded.id, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'unauthorized', message: 'Session expired. Please sign in again.' });
  }
}

module.exports = { JWT_SECRET, optionalAuth, requireAuth };