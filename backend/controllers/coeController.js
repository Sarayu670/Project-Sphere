const COE = require('../models/COE');
const Batch = require('../models/Batch');
const ProblemStatement = require('../models/ProblemStatement');
const Guide = require('../models/Guide');
const Student = require('../models/Student');

// @desc    Get all COEs
// @route   GET /api/coe
exports.getAllCOEs = async (req, res) => {
  try {
    const coes = await COE.find();
    res.status(200).json({ success: true, data: coes });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single COE
// @route   GET /api/coe/:id
exports.getCOE = async (req, res) => {
  try {
    const coe = await COE.findById(req.params.id);
    if (!coe) {
      return res.status(404).json({ success: false, message: 'COE not found' });
    }
    res.status(200).json({ success: true, data: coe });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create COE
// @route   POST /api/coe
exports.createCOE = async (req, res) => {
  try {
    const { name, description } = req.body;
    const coe = await COE.create({ name, description });
    res.status(201).json({ success: true, data: coe });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update COE
// @route   PUT /api/coe/:id
exports.updateCOE = async (req, res) => {
  try {
    const coe = await COE.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!coe) {
      return res.status(404).json({ success: false, message: 'COE not found' });
    }
    res.status(200).json({ success: true, data: coe });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete COE
// @route   DELETE /api/coe/:id
exports.deleteCOE = async (req, res) => {
  try {
    const coeId = req.params.id;
    const coe = await COE.findById(coeId);
    
    if (!coe) {
      return res.status(404).json({ success: false, message: 'COE not found' });
    }

    // Update Batches to remove reference
    await Batch.updateMany({ coeId: coeId }, { $set: { coeId: null } });
    
    // Update ProblemStatements to remove reference
    await ProblemStatement.updateMany({ coeId: coeId }, { $set: { coeId: null } });

    await COE.findByIdAndDelete(coeId);
    
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get COE details with related data
// @route   GET /api/coe/:id/details
exports.getCOEDetails = async (req, res) => {
  try {
    const coeId = req.params.id;
    const coe = await COE.findById(coeId);
    
    if (!coe) {
      return res.status(404).json({ success: false, message: 'COE not found' });
    }

    // Get problem statements for this COE
    const problemStatements = await ProblemStatement.find({ coeId }).populate('guideId', 'name');
    
    // Get batches for this COE - check both direct coeId and problemId.coeId
    const allBatches = await Batch.find()
      .populate('problemId')
      .populate('guideId', 'name')
      .populate('leaderStudentId', 'name rollNumber');
    
    const batches = allBatches.filter(b => {
      if (b.coeId && b.coeId.toString() === coeId) return true;
      if (b.problemId?.coeId && b.problemId.coeId.toString() === coeId) return true;
      return false;
    });
    
    // Get all students in these batches
    const batchIds = batches.map(b => b._id);
    const students = await Student.find({ batchId: { $in: batchIds } }).select('name rollNumber batchId');
    
    // Get unique guides
    const guideIds = [...new Set(problemStatements.map(p => p.guideId?._id).filter(Boolean))];
    const guides = await Guide.find({ _id: { $in: guideIds } }).select('name');

    res.status(200).json({
      success: true,
      data: {
        coe,
        problemStatements,
        guides,
        students,
        batches,
        counts: {
          problemStatements: problemStatements.length,
          guides: guides.length,
          batches: batches.length,
          students: students.length
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

