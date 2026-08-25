const mongoose = require('mongoose');

const AIProblemStatementSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    index: true
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  domain: {
    type: String,
    enum: [
      'AI & Machine Learning',
      'Web Development',
      'Cybersecurity',
      'IoT & Embedded Systems',
      'Cloud Computing',
      'Blockchain',
      'Data Science',
      'Mobile App Development',
      'Other'
    ],
    default: 'Other',
    index: true
  },
  difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard'],
    default: 'Medium',
    index: true
  },
  technologies: [{
    type: String,
    trim: true
  }],
  sourceUrl: {
    type: String,
    trim: true
  },
  sourceName: {
    type: String,
    trim: true,
    default: 'Public Portal'
  },
  dateCollected: {
    type: Date,
    default: Date.now
  },
  keywords: [{
    type: String,
    trim: true
  }],
  status: {
    type: String,
    enum: ['approved', 'pending_approval', 'rejected'],
    default: 'approved',
    index: true
  },
  similarityScore: {
    type: Number,
    default: 0
  },
  requestsCount: {
    type: Number,
    default: 0
  },
  offeredByGuides: [{
    guideId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Guide'
    },
    coeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'COE'
    },
    targetYear: {
      type: String
    },
    offeredAt: {
      type: Date,
      default: Date.now
    }
  }],
  isSelectedByGuide: {
    type: Boolean,
    default: false,
    index: true
  }
}, { timestamps: true });


AIProblemStatementSchema.index({ title: 'text', description: 'text', technologies: 'text', keywords: 'text' });

module.exports = mongoose.model('AIProblemStatement', AIProblemStatementSchema);
