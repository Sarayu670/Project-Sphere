const Student = require('../models/Student');
const Guide = require('../models/Guide');
const Admin = require('../models/Admin');
const generateToken = require('../utils/generateToken');

// @desc    Register student
// @route   POST /api/auth/register/student
exports.registerStudent = async (req, res) => {
  try {
    return res.status(403).json({
      success: false,
      message: 'Student registration is currently disabled. Please contact your administrator.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Register guide
// @route   POST /api/auth/register/guide
exports.registerGuide = async (req, res) => {
  try {
    const { name, email, password, department, specialization, isCoordinator, coordinatorBranch, coordinatorSection, coordinatorYear } = req.body;

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    const existingGuide = await Guide.findOne({ email });
    if (existingGuide) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }

    const guideData = { name, email, password, department, specialization };

    if (isCoordinator) {
      guideData.isCoordinator = true;
      guideData.coordinatorSection = {
        branch: coordinatorBranch || '',
        section: coordinatorSection || '',
        year: coordinatorYear || ''
      };
    }

    const guide = await Guide.create(guideData);
    const token = generateToken(guide._id, 'guide');

    res.status(201).json({
      success: true,
      token,
      user: {
        id: guide._id,
        name: guide.name,
        email: guide.email,
        role: 'guide',
        isCoordinator: guide.isCoordinator || false,
        coordinatorSection: guide.coordinatorSection || null
      }
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

    // Email domain validation
    if (!email.endsWith('@gmail.com') && !email.endsWith('.ac.in')) {
      return res.status(400).json({ success: false, message: 'Please use a valid @gmail.com or GNITS (.ac.in) email address' });
    }

    // Password complexity validation - Relaxed
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

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

    // Role is REQUIRED and must match exactly
    if (!role) {
      return res.status(400).json({ success: false, message: 'Please select a role' });
    }

    if (!['student', 'guide', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role specified' });
    }

    let user;
    let userRole;

    // Search only in the specified role's collection
    if (role === 'student') {
      // For students, check email or rollNumber
      const loginTerm = email.trim();
      user = await Student.findOne({
        $or: [
          { email: loginTerm.toLowerCase() },
          { rollNumber: { $regex: new RegExp(`^${loginTerm}$`, 'i') } }
        ]
      }).select('+password');
      userRole = 'student';
    } else if (role === 'guide') {
      const loginTerm = email.trim().toLowerCase();
      user = await Guide.findOne({ email: loginTerm }).select('+password');
      userRole = 'guide';
    } else if (role === 'admin') {
      user = await Admin.findOne({ email }).select('+password');
      userRole = 'admin';
    }

    if (!user) {
      console.log(`[AUTH] No ${role} account found for email: "${email}"`);
      return res.status(401).json({ success: false, message: `No ${role} account found with these credentials` });
    }

    console.log(`[AUTH] Found user: name="${user.name}", email="${user.email}", role="${role}"`);
    console.log(`[AUTH] Password from request: "${password}"`);
    console.log(`[AUTH] Stored hash: "${user.password}"`);
    
    const bcryptDirect = require('bcryptjs');
    const directMatch = await bcryptDirect.compare(password, user.password);
    console.log(`[AUTH] Direct bcrypt.compare result: ${directMatch}`);
    
    const isMatch = await user.matchPassword(password);
    console.log(`[AUTH] matchPassword result: ${isMatch}`);
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
    const baseUser = { id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role };
    // Include coordinator fields for guides
    if (req.user.role === 'guide') {
      baseUser.isCoordinator = req.user.isCoordinator || false;
      baseUser.coordinatorSection = req.user.coordinatorSection || null;
    }
    res.status(200).json({ success: true, user: baseUser });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reset password directly
// @route   POST /api/auth/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { email, role, newPassword } = req.body;

    if (!email || !role || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    if (!['student', 'guide', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }

    let user;

    if (role === 'student') {
      user = await Student.findOne({ email });
    } else if (role === 'guide') {
      user = await Guide.findOne({ email });
    } else if (role === 'admin') {
      user = await Admin.findOne({ email });
    }

    if (!user) {
      return res.status(404).json({ success: false, message: `No ${role} account found with this credentials` });
    }

    // Update password directly
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

