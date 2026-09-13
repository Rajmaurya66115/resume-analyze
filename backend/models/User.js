const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  deviceHash: { type: String, default: null }, // device it converted from, for audit trail
  tokenBalance: { type: Number, default: 0 },
  plan: {
    type: String,
    enum: ['free', 'starter', 'pro', 'unlimited'],
    default: 'free',
  },
  unlimitedUntil: { type: Date, default: null }, // only relevant when plan === 'unlimited'
  createdAt: { type: Date, default: Date.now },
});

userSchema.methods.hasUnlimitedAccess = function () {
  return this.plan === 'unlimited' && this.unlimitedUntil && this.unlimitedUntil > new Date();
};

module.exports = mongoose.model('User', userSchema);
