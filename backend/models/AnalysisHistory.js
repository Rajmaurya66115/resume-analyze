const mongoose = require('mongoose');

const analysisHistorySchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    default: null 
  },
  deviceHash: { 
    type: String, 
    default: null,
    index: true 
  },
  fileName: { 
    type: String, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['success', 'failed'], 
    required: true 
  },
  tokenDeducted: { 
    type: Boolean, 
    required: true 
  },
  score: { 
    type: Number, 
    default: null 
  },
  feedback: {
    strengths: [String],
    weakPoints: [String],
    missingSkills: [String],
    improvementTips: [String],
  },
  errorMessage: { 
    type: String, 
    default: null 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
});

module.exports = mongoose.model('AnalysisHistory', analysisHistorySchema);