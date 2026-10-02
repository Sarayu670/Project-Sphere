const mongoose = require('mongoose');

const AICrawlerLogSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now
  },
  source: {
    type: String,
    default: 'All Sources'
  },
  totalCollected: {
    type: Number,
    default: 0
  },
  duplicatesRemoved: {
    type: Number,
    default: 0
  },
  domainDistribution: {
    type: Map,
    of: Number,
    default: {}
  },
  status: {
    type: String,
    enum: ['completed', 'failed', 'in_progress'],
    default: 'completed'
  },
  triggeredBy: {
    type: String,
    enum: ['manual', 'cron', 'system'],
    default: 'manual'
  },
  details: {
    type: String,
    default: ''
  }
}, { timestamps: true });

module.exports = mongoose.model('AICrawlerLog', AICrawlerLogSchema);
