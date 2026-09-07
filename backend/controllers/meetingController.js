const mongoose = require('mongoose');
const Meeting = require('../models/Meeting');

// Get all meeting plans (Admin only)
exports.getAllPlans = async (req, res) => {
  try {
    const plans = await Meeting.find();
    res.status(200).json({
      success: true,
      data: plans
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get meeting plans for the logged-in coordinator's own section
// @route   GET /api/meetings/section
exports.getSectionPlans = async (req, res) => {
  try {
    const Batch = require('../models/Batch');
    const { year, branch, section } = req.user.coordinatorSection;
    const batches = await Batch.find({ year, branch, section }).select('_id');
    const batchIds = batches.map(batch => batch._id);
    const plans = await Meeting.find({ batchId: { $in: batchIds } });
    res.status(200).json({ success: true, data: plans });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get meeting plan for a batch (auto-initialize if missing)
exports.getMeetingPlan = async (req, res) => {
  try {
    const { batchId } = req.params;
    const Batch = require('../models/Batch');

    if (!mongoose.Types.ObjectId.isValid(batchId)) {
        return res.status(400).json({ success: false, message: 'Invalid batch ID format' });
    }

    const oid = new mongoose.Types.ObjectId(batchId);
    let plan = await Meeting.findOne({ batchId: oid });
    
    // Auto-initialize or RE-INITIALIZE if malformed (empty arrays)
    if (!plan || !plan.scheduledDates || plan.scheduledDates.length === 0) {
      // Fetch batch to get allotment date
      const batch = await Batch.findById(oid);
      if (!batch) {
        return res.status(404).json({ success: false, message: 'Batch not found' });
      }

      // Initialize plan
      const startDate = batch.allottedAt || batch.createdAt || new Date();
      const scheduledDates = [];
      for (let i = 0; i < 6; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + (i * 15));
        scheduledDates.push(d.toISOString().split('T')[0]);
      }

      const defaultPlan = {
        batchId: oid,
        scheduledDates,
        completed: new Array(6).fill(false),
        remarks: new Array(6).fill(''),
        completedDates: new Array(6).fill(null)
      };

      if (!plan) {
        plan = await Meeting.create(defaultPlan);
      } else {
        // Repair existing malformed plan
        plan = await Meeting.findOneAndUpdate({ batchId: oid }, defaultPlan, { new: true });
      }
    }

    res.status(200).json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('[MeetingController] getMeetingPlan error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Create or update meeting plan
exports.updateMeetingPlan = async (req, res) => {
  try {
    const { batchId } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(batchId)) {
        return res.status(400).json({ success: false, message: 'Invalid batch ID format' });
    }
    
    const oid = new mongoose.Types.ObjectId(batchId);
    let plan = await Meeting.findOne({ batchId: oid });
    
    if (plan) {
      // Update existing
      plan = await Meeting.findOneAndUpdate(
        { batchId: oid },
        { ...updateData, updatedAt: Date.now() },
        { new: true, runValidators: true }
      );
    } else {
      // Create new
      plan = await Meeting.create({
        batchId: oid,
        ...updateData
      });
    }

    res.status(200).json({
      success: true,
      data: plan
    });
  } catch (error) {
    console.error('[MeetingController] updateMeetingPlan error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
