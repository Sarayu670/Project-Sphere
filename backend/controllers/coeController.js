const COE = require('../models/COE');

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
    const coe = await COE.findByIdAndDelete(req.params.id);
    if (!coe) {
      return res.status(404).json({ success: false, message: 'COE not found' });
    }
    res.status(200).json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

