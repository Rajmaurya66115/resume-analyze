const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String }, // Optional if using Google/GitHub Auth
  googleId: { type: String, default: null },
  githubId: { type: String, default: null },
  authProvider: { type: String, default: 'local' },
  avatarUrl: { type: String, default: null },
  deviceHash: { type: String, default: null },
  tokenBalance: { type: Number, default: 0 },
  plan: {
    type: String,
    enum: ['free', 'starter', 'pro', 'unlimited'],
    default: 'free',
  },
  unlimitedUntil: { type: Date, default: null },
  resetPasswordToken: { type: String, default: null }, // Required for Forgot Password
  resetPasswordExpires: { type: Date, default: null }, // Required for Forgot Password
  createdAt: { type: Date, default: Date.now },
});

userSchema.methods.hasUnlimitedAccess = function () {
  return this.plan === 'unlimited' && this.unlimitedUntil && this.unlimitedUntil > new Date();
};

module.exports = mongoose.model('User', userSchema);