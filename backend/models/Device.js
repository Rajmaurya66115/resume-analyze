const mongoose = require('mongoose');

// One row per physical device (fingerprinted), independent of any user account.
// This is what free-tier abuse prevention hangs off of: reinstalling the app
// creates a new app-storage record but NOT a new Device record, because the
// fingerprint is derived from hardware/OS signals, not app storage.
const deviceSchema = new mongoose.Schema({
  deviceHash: { type: String, required: true, unique: true, index: true }, // sha256 of fingerprint
  freeTokensGranted: { type: Number, default: 10 },
  freeTokensUsed: { type: Number, default: 0 },
  linkedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now },
});

deviceSchema.methods.freeTokensRemaining = function () {
  return Math.max(0, this.freeTokensGranted - this.freeTokensUsed);
};

module.exports = mongoose.model('Device', deviceSchema);
