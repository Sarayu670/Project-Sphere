const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  completed: {
    type: Boolean,
    default: false
  },
  completedAt: {
    type: Date,
    default: null
  }
});

const MilestoneSchema = new mongoose.Schema({
  phase: {
    type: Number,
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  targetWeek: {
    type: Number,
    default: 1
  },
  estimatedDays: {
    type: Number,
    default: 7
  },
  tasks: [TaskSchema],
  deliverables: [{
    type: String,
    trim: true
  }],
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed', 'delayed'],
    default: 'not_started'
  },
  completedAt: {
    type: Date,
    default: null
  }
});

const ProjectRoadmapSchema = new mongoose.Schema({
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: true,
    unique: true,
    index: true
  },
  problemTitle: {
    type: String,
    required: true,
    trim: true
  },
  problemDescription: {
    type: String,
    trim: true
  },
  domain: {
    type: String,
    trim: true,
    default: 'General'
  },
  techStack: [{
    type: String,
    trim: true
  }],
  aiSummary: {
    type: String,
    trim: true
  },
  milestones: [MilestoneSchema],
  generatedBy: {
    type: String,
    enum: ['ai', 'guide', 'system'],
    default: 'ai'
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('ProjectRoadmap', ProjectRoadmapSchema);
