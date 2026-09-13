const mongoose = require('mongoose');

const analysisHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null while still a guest
  deviceHash: { type: String, required: true },
  fileName: { type: String, required: true },
  status: { type: String, enum: ['success', 'failed'], required: true },
  tokenDeducted: { type: Boolean, required: true },
  score: { type: Number, default: null },
  feedback: {
    strengths: [String],
    weakPoints: [String],
    missingSkills: [String],
    improvementTips: [String],
  },
  errorMessage: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('AnalysisHistory', analysisHistorySchema);
