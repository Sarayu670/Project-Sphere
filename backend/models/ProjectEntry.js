const mongoose = require('mongoose');

const ProjectEntrySchema = new mongoose.Schema({
  // Project identification
  projectId: {
    type: String,
    required: [true, 'Project ID is required'],
    trim: true,
    index: true
  },
  projectTitle: {
    type: String,
    required: [true, 'Project title is required'],
    trim: true
  },
  
  // Students information
  students: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    rollNumber: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student'
    }
  }],
  
  // Guide information
  internalGuide: {
    type: String,
    required: [true, 'Internal guide is required'],
    trim: true
  },
  guideId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Guide'
  },
  
  // Batch mapping (created when importing)
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch'
  },
  
  // Additional metadata
  department: {
    type: String,
    trim: true
  },
  year: {
    type: String,
    enum: ['2nd', '3rd', '4th']
  },
  branch: {
    type: String,
    enum: ['CSE', 'IT', 'ECE', 'CSM', 'EEE', 'CSD', 'ETM']
  },
  section: {
    type: String,
    enum: ['A', 'B', 'C', 'D', 'E']
  },
  batch: {
    type: String,
    trim: true
  },
  
  // Import tracking
  importedAt: {
    type: Date,
    default: Date.now
  },
  importedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, { timestamps: true });

// Index for search functionality
ProjectEntrySchema.index({ projectTitle: 'text', internalGuide: 'text' });
ProjectEntrySchema.index({ projectId: 1, guideId: 1 });

module.exports = mongoose.model('ProjectEntry', ProjectEntrySchema);
