const jwt = require('jsonwebtoken');
const Student = require('../models/Student');
const Guide = require('../models/Guide');
const Admin = require('../models/Admin');

// Protect routes
exports.protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user based on role
    let user;
    if (decoded.role === 'student') {
      user = await Student.findById(decoded.id);
    } else if (decoded.role === 'guide') {
      user = await Guide.findById(decoded.id);
    } else if (decoded.role === 'admin') {
      user = await Admin.findById(decoded.id);
    }

    if (!user) {
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    req.user = user;
    req.user.role = decoded.role;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }
};

// Authorize roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: `User role ${req.user.role} is not authorized to access this route` 
      });
    }
    next();
  };
};

// Coordinators are guides with an additional, fixed section assignment.
// This check is intentionally server-side so the UI cannot broaden access.
exports.authorizeCoordinator = (req, res, next) => {
  const scope = req.user?.coordinatorSection;
  if (
    req.user?.role !== 'guide' ||
    !req.user?.isCoordinator ||
    !scope?.year ||
    !scope?.branch ||
    !scope?.section
  ) {
    return res.status(403).json({
      success: false,
      message: 'Coordinator access is required for this route'
    });
  }
  next();
};

// Allow either admin or a coordinator (guide with coordinator flags)
exports.authorizeAdminOrCoordinator = (req, res, next) => {
  if (req.user?.role === 'admin') {
    return next();
  }
  // Fall back to coordinator check
  return exports.authorizeCoordinator(req, res, next);
};

// Inject a department-based filter scope for admin requests.
// If admin.department is set and not 'ALL', restricts queries to that branch.
// Call this after protect() + authorize('admin') on routes that return branch data.
exports.injectDeptScope = (req, res, next) => {
  if (req.user?.role === 'admin') {
    const dept = req.user.department;
    req.deptFilter = (dept && dept !== 'ALL') ? { branch: dept } : {};
  } else {
    req.deptFilter = {};
  }
  next();
};
