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

        // 4. Update students with batchId (Crucial for consistency)
        for (const studentId of studentIds) {
          await Student.findByIdAndUpdate(studentId, { batchId: batch._id });
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

// @desc    Import batches with students from Excel file
// @route   POST /api/admin/import-batch-data
exports.importBatchData = async (req, res) => {
  try {
    const XLSX = require('xlsx');

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    const results = { success: 0, failed: 0, errors: [], batchCount: 0, studentCount: 0 };

    // Group data by batch ID with fill-down logic for merged cells
    const batchGroups = {};
    let lastProjId = '';

    for (const row of data) {
      // Check multiple common column names
      let projId = row['Proj ID/Batch'] || row['Batch'] || row['Batch/Team'] || row['Team'] || '';

      // Fill down if empty but we have student data (implies merged cell)
      if (!projId && lastProjId && (row['Roll Number'] || row['Student Name'])) {
        projId = lastProjId;
      }

      if (projId) {
        lastProjId = projId; // Update last seen ID

        if (!batchGroups[projId]) {
          batchGroups[projId] = [];
        }
        batchGroups[projId].push(row);
      }
    }

    // Process each batch
    for (const [projId, batchRows] of Object.entries(batchGroups)) {
      try {
        // Get batch details from first row
        const firstRow = batchRows[0];
        const guideName = firstRow['Internal Guide'] || '';
        const projectTitle = firstRow['Project Title'] || '';
        const teamName = projId;

        if (!guideName || !projectTitle) {
          results.errors.push({
            batch: projId,
            error: 'Missing Internal Guide or Project Title'
          });
          results.failed += batchRows.length;
          continue;
        }

        // Find or create guide - use case-insensitive name search
        let guide = await Guide.findOne({
          name: { $regex: `^${guideName}$`, $options: 'i' }
        });

        if (!guide) {
          try {
            // Generate unique email using timestamp to avoid duplicates
            const emailBase = guideName.toLowerCase().replace(/[^a-z0-9]/g, '');
            const uniqueEmail = `${emailBase}${Date.now()}@guide.gnits.ac.in`;

            guide = await Guide.create({
              name: guideName,
              email: uniqueEmail,
              password: 'defaultPassword123',
              role: 'guide'
            });
          } catch (err) {
            // If creation fails, try finding again (in case it was created by another request)
            guide = await Guide.findOne({
              name: { $regex: `^${guideName}$`, $options: 'i' }
            });

            if (!guide) {
              // Still not found after creation attempt, skip this batch
              results.errors.push({
                batch: projId,
                error: `Could not find or create guide "${guideName}"`
              });
              results.failed += batchRows.length;
              continue;
            }
          }
        }

        // Process students in this batch first to create leader
        const studentIds = [];
        let leaderStudentId = null;

        for (const row of batchRows) {
          try {
            const rollNumber = row['Roll Number'] || '';
            const studentName = row['Student Name'] || '';

            if (!rollNumber || !studentName) {
              results.errors.push({
                batch: projId,
                student: studentName || rollNumber,
                error: 'Missing Roll Number or Student Name'
              });
              results.failed++;
              continue;
            }

            // Check if student already exists
            let student = await Student.findOne({ rollNumber: rollNumber });

            if (!student) {
              // Create new student with all required fields
              student = await Student.create({
                name: studentName,
                email: `${rollNumber}@student.gnits.ac.in`,
                rollNumber: rollNumber,
                password: rollNumber, // Use roll number as default password
                year: '2nd',
                branch: 'CSE',
                section: 'A',
                role: 'student'
              });
            }

            studentIds.push(student._id);

            // Set first student as leader for this batch
            if (!leaderStudentId) {
              leaderStudentId = student._id;
            }

            results.studentCount++;
            results.success++;
          } catch (err) {
            results.errors.push({
              batch: projId,
              student: row['Student Name'],
              error: err.message
            });
            results.failed++;
          }
        }

        // Create batch with leader student
        if (leaderStudentId && studentIds.length > 0) {
          let batch = await Batch.findOne({ teamName: teamName });

          if (!batch) {
            batch = await Batch.create({
              leaderStudentId: leaderStudentId,
              teamName: teamName,
              guideId: guide._id,
              year: '2nd',
              branch: 'CSE',
              section: 'A',
              status: 'Not Started',
              allotmentStatus: 'none'
            });
            results.batchCount++;
          }

          // Update all students with batch ID
          for (const studentId of studentIds) {
            const updatedStudent = await Student.findByIdAndUpdate(studentId, { batchId: batch._id }, { new: true });

            // Allow duplicate TeamMember creation just in case, or check first
            // But since this is inside importBatchData and we grouped by batch, we can assume we need to create them.
            // Check if TeamMember exists
            const existingMember = await TeamMember.findOne({ rollNo: updatedStudent.rollNumber });
            if (!existingMember) {
              await TeamMember.create({
                batchId: batch._id,
                name: updatedStudent.name,
                rollNo: updatedStudent.rollNumber,
                branch: updatedStudent.branch || 'CSE' // Default if missing
              });
            } else {
              // Update existing member if needed
              existingMember.batchId = batch._id;
              existingMember.name = updatedStudent.name;
              existingMember.branch = updatedStudent.branch || existingMember.branch;
              await existingMember.save();
            }
          }
        }
      } catch (err) {
        results.errors.push({
          batch: projId,
          error: err.message
        });
        results.failed += batchRows.length;
      }
    }

    res.status(200).json({
      success: true,
      data: results,
      message: `Import completed: ${results.batchCount} batches, ${results.studentCount} students (${results.success} succeeded, ${results.failed} failed)`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Search batches by guide name
// @route   GET /api/admin/search-batches-by-guide
exports.searchBatchesByGuide = async (req, res) => {
  try {
    const { guideName } = req.query;

    if (!guideName || guideName.trim() === '') {
      return res.status(400).json({ success: false, message: 'Guide name is required' });
    }

    // Find guide by name (case-insensitive PARTIAL match)
    // This will match "Leela" in "Mrs. A. Leela Kumari"
    const guide = await Guide.findOne({
      name: { $regex: guideName, $options: 'i' }
    });

    if (!guide) {
      return res.status(404).json({ success: false, message: `Guide "${guideName}" not found` });
    }

    // Find all batches for this guide and populate all data
    const batches = await Batch.find({ guideId: guide._id }).lean();

    // Get students for each batch
    const batchesWithStudents = await Promise.all(
      batches.map(async (batch) => {
        const students = await Student.find({ batchId: batch._id }).select('name rollNumber');
        const leader = await Student.findById(batch.leaderStudentId).select('name rollNumber');
        return {
          _id: batch._id,
          teamName: batch.teamName,
          year: batch.year,
          branch: batch.branch,
          section: batch.section,
          status: batch.status,
          leaderStudent: leader,
          students: students,
          studentCount: students.length
        };
      })
    );

    res.status(200).json({
      success: true,
      data: {
        guide: {
          id: guide._id,
          name: guide.name
        },
        batches: batchesWithStudents,
        totalBatches: batchesWithStudents.length,
        totalStudents: batchesWithStudents.reduce((sum, batch) => sum + (batch.students?.length || 0), 0)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
