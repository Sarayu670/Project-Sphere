const mongoose = require('mongoose');

const AdaptiveRecommendationSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['warning', 'action_item', 'resource', 'praise', 'schedule_adjustment'],
    default: 'action_item'
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  suggestedAction: {
    type: String,
    trim: true
  },
  targetRole: {
    type: String,
    enum: ['student', 'guide', 'both'],
    default: 'both'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const ActivityItemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['timeline_event', 'roadmap_milestone', 'submission', 'meeting'],
    default: 'timeline_event'
  },
  status: {
    type: String,
    enum: ['completed', 'pending', 'delayed'],
    required: true
  },
  dueDate: Date,
  completedDate: Date,
  details: String
});

const AIProgressAnalysisSchema = new mongoose.Schema({
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: true,
    unique: true,
    index: true
  },
  healthScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 100
  },
  healthStatus: {
    type: String,
    enum: ['On Track', 'At Risk', 'Delayed', 'Ahead of Schedule'],
    default: 'On Track'
  },
  completedActivities: [ActivityItemSchema],
  pendingActivities: [ActivityItemSchema],
  delayedActivities: [ActivityItemSchema],
  adaptiveRecommendations: [AdaptiveRecommendationSchema],
  lastAnalyzedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('AIProgressAnalysis', AIProgressAnalysisSchema);
