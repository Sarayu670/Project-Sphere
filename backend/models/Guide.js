const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const GuideSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  department: {
    type: String,
    trim: true
  },
  specialization: {
    type: String,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    default: 'guide'
  },
  maxBatches: {
    type: Number,
    default: 3
  },
  assignedBatches: {
    type: Number,
    default: 0
  },
  // A guide may additionally coordinate one specific class section.
  // Keeping this on Guide preserves the existing three-role auth flow.
  isCoordinator: {
    type: Boolean,
    default: false
  },
  coordinatorSection: {
    branch: {
      type: String,
      enum: ['CSE', 'IT', 'ECE', 'CSM', 'EEE', 'CSD', 'ETM'],
      default: undefined
    },
    section: {
      type: String,
      enum: ['A', 'B', 'C', 'D', 'E'],
      default: undefined
    },
    year: {
      type: String,
      enum: ['2nd', '3rd', '4th'],
      default: undefined
    }
  }
}, { timestamps: true });

// Hash password before saving
GuideSchema.pre('save', async function() {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match password
GuideSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('Guide', GuideSchema);

