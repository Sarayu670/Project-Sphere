const mongoose = require('mongoose');

const MeetingSchema = new mongoose.Schema({
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Batch',
    required: true,
    unique: true
  },
  scheduledDates: [{
    type: String, // YYYY-MM-DD
    required: true
  }],
  completed: [{
    type: Boolean,
    default: false
  }],
  completedDates: [{
    type: String, // YYYY-MM-DD or null
    default: null
  }],
  remarks: [{
    type: String,
    default: ''
  }],
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('Meeting', MeetingSchema);
