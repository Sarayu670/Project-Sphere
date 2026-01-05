const Student = require('../models/Student');
const Guide = require('../models/Guide');
const Admin = require('../models/Admin');
const generateToken = require('../utils/generateToken');

// @desc    Register student
// @route   POST /api/auth/register/student
exports.registerStudent = async (req, res) => {
  try {
    const { name, email, password, rollNumber, year, branch, section } = req.body;

    const existingStudent = await Student.findOne({ email });
    if (existingStudent) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    const existingRollNumber = await Student.findOne({ rollNumber });
    if (existingRollNumber) {
      return res.status(400).json({ success: false, message: 'Roll number already exists' });
    }

    const student = await Student.create({ name, email, password, rollNumber, year, branch, section });
    const token = generateToken(student._id, 'student');

    res.status(201).json({
      success: true,
      token,
      user: { id: student._id, name: student.name, email: student.email, rollNumber: student.rollNumber, role: 'student', year, branch, section }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Register guide
// @route   POST /api/auth/register/guide
exports.registerGuide = async (req, res) => {
  try {
    const { name, email, password, department, specialization } = req.body;

    const existingGuide = await Guide.findOne({ email });
    if (existingGuide) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    const guide = await Guide.create({ name, email, password, department, specialization });
    const token = generateToken(guide._id, 'guide');

    res.status(201).json({
      success: true,
      token,
      user: { id: guide._id, name: guide.name, email: guide.email, role: 'guide' }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Register admin
// @route   POST /api/auth/register/admin
exports.registerAdmin = async (req, res) => {
  try {
    const { name, email, password, department } = req.body;

    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    const admin = await Admin.create({ name, email, password, department });
    const token = generateToken(admin._id, 'admin');

    res.status(201).json({
      success: true,
      token,
      user: { id: admin._id, name: admin.name, email: admin.email, role: 'admin' }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Login user (auto-detect role)
// @route   POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    let user;
    let userRole;

    // If role is specified, search in that collection
    if (role) {
      if (role === 'student') {
        // For students, check both email and rollNumber
        user = await Student.findOne({ 
          $or: [{ email: email }, { rollNumber: email }] 
        }).select('+password');
        userRole = 'student';
      } else if (role === 'guide') {
        user = await Guide.findOne({ email }).select('+password');
        userRole = 'guide';
      } else if (role === 'admin') {
        user = await Admin.findOne({ email }).select('+password');
        userRole = 'admin';
      }
    } else {
      // Auto-detect role by searching all collections
      // For students, check both email and rollNumber
      user = await Student.findOne({ 
        $or: [{ email: email }, { rollNumber: email }] 
      }).select('+password');
      userRole = 'student';

      if (!user) {
        user = await Guide.findOne({ email }).select('+password');
        userRole = 'guide';
      }

      if (!user) {
        user = await Admin.findOne({ email }).select('+password');
        userRole = 'admin';
      }
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = generateToken(user._id, userRole);

    res.status(200).json({
      success: true,
      token,
      user: { id: user._id, name: user.name, email: user.email, role: userRole }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      user: { id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

