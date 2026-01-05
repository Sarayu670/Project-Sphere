const ProblemStatement = require('../models/ProblemStatement');
const Batch = require('../models/Batch');

// @desc    Get all problem statements
// @route   GET /api/problems
exports.getAllProblems = async (req, res) => {
  try {
    const problems = await ProblemStatement.find()
      .populate('coeId', 'name')
      .populate('guideId', 'name email assignedBatches maxBatches');
    res.status(200).json({ success: true, data: problems });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get my problem statements (Guide)
// @route   GET /api/problems/my-problems
exports.getMyProblems = async (req, res) => {
  try {
    const problems = await ProblemStatement.find({ guideId: req.user._id })
      .populate('coeId', 'name')
      .populate('guideId', 'name email');
    res.status(200).json({ success: true, data: problems });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get problems by COE
// @route   GET /api/problems/coe/:coeId
exports.getProblemsByCOE = async (req, res) => {
  try {
    const problems = await ProblemStatement.find({ coeId: req.params.coeId })
      .populate('coeId', 'name')
      .populate('guideId', 'name email assignedBatches maxBatches');
    res.status(200).json({ success: true, data: problems });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single problem statement
// @route   GET /api/problems/:id
exports.getProblem = async (req, res) => {
  try {
    const problem = await ProblemStatement.findById(req.params.id)
      .populate('coeId', 'name')
      .populate('guideId', 'name email assignedBatches maxBatches');
    if (!problem) {
      return res.status(404).json({ success: false, message: 'Problem statement not found' });
    }
    res.status(200).json({ success: true, data: problem });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create problem statement (Guide creates their own)
// @route   POST /api/problems
exports.createProblem = async (req, res) => {
  try {
    const { coeId, title, description, targetYear, datasetUrl } = req.body;
    // Guide creates their own problem - use their ID
    const guideId = req.user.role === 'guide' ? req.user._id : req.body.guideId;

    const problem = await ProblemStatement.create({
      coeId, title, description, targetYear, guideId, datasetUrl
    });

    const populatedProblem = await ProblemStatement.findById(problem._id)
      .populate('coeId', 'name')
      .populate('guideId', 'name email');

    res.status(201).json({ success: true, data: populatedProblem });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update problem statement (Admin only)
// @route   PUT /api/problems/:id
exports.updateProblem = async (req, res) => {
  try {
    const problem = await ProblemStatement.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    })
      .populate('coeId', 'name')
      .populate('guideId', 'name email');
    if (!problem) {
      return res.status(404).json({ success: false, message: 'Problem statement not found' });
    }
    res.status(200).json({ success: true, data: problem });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete problem statement (Admin only)
// @route   DELETE /api/problems/:id
exports.deleteProblem = async (req, res) => {
  try {
    const problem = await ProblemStatement.findById(req.params.id);
    if (!problem) {
      return res.status(404).json({ success: false, message: 'Problem statement not found' });
    }

    // Clear this problem from all batches that opted for it
    await Batch.updateMany(
      { 'optedProblems.problemId': req.params.id },
      { $pull: { optedProblems: { problemId: req.params.id } } }
    );

    // Also clear legacy optedProblemId field
    await Batch.updateMany(
      { optedProblemId: req.params.id },
      {
        $set: {
          optedProblemId: null,
          coeId: null,
          allotmentStatus: 'none'
        }
      }
    );

    // Delete the problem
    await ProblemStatement.findByIdAndDelete(req.params.id);

    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

