const COE = require('../models/COE');
const ProblemStatement = require('../models/ProblemStatement');
const Guide = require('../models/Guide');
const Batch = require('../models/Batch');
const Student = require('../models/Student');
const Admin = require('../models/Admin');
const TeamMember = require('../models/TeamMember');

// @desc    Get admin dashboard stats
// @route   GET /api/admin/dashboard
exports.getDashboard = async (req, res) => {
  try {
    const totalCOEs = await COE.countDocuments();
    const totalProblems = await ProblemStatement.countDocuments();
    const totalGuides = await Guide.countDocuments();
    const totalBatches = await Batch.countDocuments();
    const totalStudents = await Student.countDocuments();

    const batchesByStatus = await Batch.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalCOEs,
        totalProblems,
        totalGuides,
        totalBatches,
        totalStudents,
        batchesByStatus
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all data for admin overview
// @route   GET /api/admin/overview
exports.getOverview = async (req, res) => {
  try {
    const coes = await COE.find();
    
    const problems = await ProblemStatement.find()
      .populate('coeId', 'name')
      .populate('guideId', 'name email assignedBatches maxBatches');
    
    const guides = await Guide.find().select('-password');
    
    const batches = await Batch.find()
      .populate('leaderStudentId', 'name email')
      .populate('problemId', 'title')
      .populate('guideId', 'name email');

    res.status(200).json({
      success: true,
      data: { coes, problems, guides, batches }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create admin (Initial setup)
// @route   POST /api/admin/create
exports.createAdmin = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ success: false, message: 'Admin already exists' });
    }

    const admin = await Admin.create({ name, email, password });
    res.status(201).json({ 
      success: true, 
      data: { id: admin._id, name: admin.name, email: admin.email, role: 'admin' }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get batch-guide mapping
// @route   GET /api/admin/batch-guide-mapping
exports.getBatchGuideMapping = async (req, res) => {
  try {
    const batches = await Batch.find({ guideId: { $ne: null } })
      .populate('leaderStudentId', 'name email')
      .populate('problemId', 'title')
      .populate('guideId', 'name email');

    const guides = await Guide.find().select('-password');

    const mapping = guides.map(guide => ({
      guide: { id: guide._id, name: guide.name, email: guide.email },
      assignedBatches: guide.assignedBatches,
      maxBatches: guide.maxBatches,
      batches: batches.filter(b => b.guideId && b.guideId._id.toString() === guide._id.toString())
    }));

    res.status(200).json({ success: true, data: mapping });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Import student batches from Excel data
// @route   POST /api/admin/import-batches
exports.importBatches = async (req, res) => {
  try {
    const { batches } = req.body;
    
    if (!batches || !Array.isArray(batches)) {
      return res.status(400).json({ success: false, message: 'Invalid batches data' });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const batchData of batches) {
      try {
        let { teamName, members, year, branch, section } = batchData;

        if (!teamName || !members || !members.length || !year || !branch || !section) {
          throw new Error(`Missing required fields for team: ${teamName || 'Unknown'}`);
        }

        teamName = teamName.trim();

        // 1. Process members and create students if needed
        const studentIds = [];
        for (const member of members) {
          let student = await Student.findOne({ rollNumber: member.rollNo });
          
          // Default password: team_name@123
          const password = `${teamName}@123`;

          if (!student) {
            // Generate a default email if not provided
            const email = `${member.rollNo.toLowerCase()}@gmail.com`;
            
            student = await Student.create({
              name: member.name,
              rollNumber: member.rollNo,
              email,
              password,
              year,
              branch,
              section
            });
          } else {
            // Update password for existing student to match import default
            student.password = password;
            // Also update other info to be safe
            student.year = year;
            student.branch = branch;
            student.section = section;
            await student.save();
          }
          studentIds.push(student._id);
        }

        // 2. Create Batch
        // Use the first member as leader
        const leaderStudentId = studentIds[0];
        
        // Check if a batch already exists for this leader
        let batch = await Batch.findOne({ leaderStudentId });
        if (batch) {
          throw new Error(`Batch already exists for leader: ${members[0].rollNo}`);
        }

        batch = await Batch.create({
          leaderStudentId,
          teamName,
          year,
          branch,
          section
        });

        // 3. Create TeamMembers
        for (let i = 0; i < members.length; i++) {
          await TeamMember.create({
            batchId: batch._id,
            name: members[i].name,
            rollNo: members[i].rollNo,
            branch: branch // Use team branch
          });
        }

        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push({
          team: batchData.teamName || 'Unknown',
          error: err.message
        });
      }
    }

    res.status(200).json({
      success: true,
      data: results,
      message: `Import completed: ${results.success} succeeded, ${results.failed} failed`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

