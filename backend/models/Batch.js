const mongoose = require('mongoose');

const BatchSchema = new mongoose.Schema({
  leaderStudentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Leader student is required']
  },
  teamName: {
    type: String,
    required: [true, 'Team name is required'],
    trim: true
  },
  // Year, Branch, Section - inherited from student leader
  year: {
    type: String,
    enum: ['2nd', '3rd', '4th'],
    required: [true, 'Year is required']
  },
  branch: {
    type: String,
    enum: ['CSE', 'IT', 'ECE', 'CSM', 'EEE', 'CSD', 'ETM'],
    required: [true, 'Branch is required']
  },
  section: {
    type: String,
    enum: ['A', 'B', 'C', 'D', 'E'],
    required: [true, 'Section is required']
  },
  // Multiple opted problems (up to 3)
  optedProblems: [{
    problemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ProblemStatement'
    },
    coeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'COE'
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending'
    },
    optedAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Keep for backward compatibility - the single opted problem
  optedProblemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProblemStatement',
    default: null
  },
  problemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProblemStatement',
    default: null
  },
  guideId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Guide',
    default: null
  },
  coeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'COE',
    default: null
  },
  allotmentStatus: {
    type: String,
    enum: ['none', 'pending', 'allotted', 'rejected'],
    default: 'none'
  },
  status: {
    type: String,
    enum: ['Not Started', 'In Progress', 'Completed'],
    default: 'Not Started'
  }
}, { timestamps: true });

module.exports = mongoose.model('Batch', BatchSchema);

