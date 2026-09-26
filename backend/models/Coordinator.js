const mongoose = require('mongoose');

const CoordinatorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Coordinator name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
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
  year: {
    type: String,
    enum: ['2nd', '3rd', '4th'],
    required: [true, 'Year is required']
  },
  guideId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Guide',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Coordinator', CoordinatorSchema);
