const TeamMember = require('../models/TeamMember');
const Batch = require('../models/Batch');

// @desc    Get team members for a batch
// @route   GET /api/team-members/:batchId
exports.getTeamMembers = async (req, res) => {
  try {
    const teamMembers = await TeamMember.find({ batchId: req.params.batchId });
    res.status(200).json({ success: true, data: teamMembers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add team member (Student only)
// @route   POST /api/team-members
exports.addTeamMember = async (req, res) => {
  try {
    const { name, rollNo, branch } = req.body;

    // Get student's batch
    const batch = await Batch.findOne({ leaderStudentId: req.user._id });
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Create a batch first' });
    }

    const teamMember = await TeamMember.create({
      batchId: batch._id,
      name,
      rollNo,
      branch
    });

    res.status(201).json({ success: true, data: teamMember });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update team member
// @route   PUT /api/team-members/:id
exports.updateTeamMember = async (req, res) => {
  try {
    const teamMember = await TeamMember.findById(req.params.id);
    
    if (!teamMember) {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }

    // Check if user is leader of this batch
    const batch = await Batch.findOne({ 
      _id: teamMember.batchId, 
      leaderStudentId: req.user._id 
    });
    
    if (!batch) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const updatedMember = await TeamMember.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({ success: true, data: updatedMember });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete team member
// @route   DELETE /api/team-members/:id
exports.deleteTeamMember = async (req, res) => {
  try {
    const teamMember = await TeamMember.findById(req.params.id);
    
    if (!teamMember) {
      return res.status(404).json({ success: false, message: 'Team member not found' });
    }

    // Check if user is leader of this batch
    const batch = await Batch.findOne({ 
      _id: teamMember.batchId, 
      leaderStudentId: req.user._id 
    });
    
    if (!batch) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await TeamMember.findByIdAndDelete(req.params.id);
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

