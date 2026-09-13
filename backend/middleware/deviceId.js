const Device = require('../models/Device');

async function attachDevice(req, res, next) {
  try {
    const fingerprint = req.headers['x-device-fingerprint'] || req.headers['X-Device-Fingerprint'];
    
    // Provide a fallback fingerprint so missing headers never crash the request
    const deviceHash = fingerprint || 'dev_fallback_' + (req.ip || 'local');
    req.deviceHash = deviceHash;

    let device = await Device.findOne({ deviceHash });
    if (!device) {
      device = await Device.create({
        deviceHash,
        usedFreeTokens: 0,
      }).catch(() => null); // Catch potential duplicate key collisions safely
    }

    // Attach safe fallback methods if database didn't return an active model
    if (!device) {
      req.device = {
        freeTokensRemaining: () => 10,
        usedFreeTokens: 0,
        save: async () => {},
      };
    } else {
      req.device = device;
    }

    next();
  } catch (err) {
    console.warn('[attachDevice] Safely caught error, applying fallback:', err.message);
    req.deviceHash = 'dev_guest';
    req.device = {
      freeTokensRemaining: () => 10,
      usedFreeTokens: 0,
      save: async () => {},
    };
    next();
  }
}

module.exports = { attachDevice };