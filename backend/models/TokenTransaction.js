const mongoose = require('mongoose');

// Append-only ledger. token_balance on User is a cache; this collection is
// the source of truth if the two ever need reconciling.
const tokenTransactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  deviceHash: { type: String, default: null },
  type: { type: String, enum: ['deduct', 'purchase', 'refund', 'reserve', 'release'], required: true },
  amount: { type: Number, required: true }, // negative for deduct/reserve, positive for purchase/refund/release
  reason: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('TokenTransaction', tokenTransactionSchema);
