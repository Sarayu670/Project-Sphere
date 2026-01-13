const ProjectEntry = require('../models/ProjectEntry');
const Batch = require('../models/Batch');
const Student = require('../models/Student');
const Guide = require('../models/Guide');
const TeamMember = require('../models/TeamMember');

// @desc    Import projects from Excel and create batches
// @route   POST /api/projects/import
exports.importProjects = async (req, res) => {
  try {
    const { projects } = req.body;
    const adminId = req.user.id;

    if (!projects || !Array.isArray(projects) || projects.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No projects provided'
      });
    }

    let successCount = 0;
    let batchesCreated = 0;
    let failedCount = 0;
    const errors = [];

    for (const projectData of projects) {
      try {
        // Validate project data
        if (!projectData.projectId || !projectData.projectTitle || !projectData.internalGuide || projectData.students.length === 0) {
          failedCount++;
          errors.push({
            project: projectData.projectId || 'Unknown',
            error: 'Missing required fields'
          });
          continue;
        }

        // Find or create guide with proper name matching
        const guideName = projectData.internalGuideOriginal || projectData.internalGuide;
        let guide = await Guide.findOne({ 
          name: new RegExp(`^${guideName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') 
        });

        if (!guide) {
          // Create new guide with default password
          const guideEmail = `${guideName.toLowerCase().replace(/\s+/g, '.')}@institute.edu`;
          
          try {
            guide = await Guide.create({
              name: guideName,
              email: guideEmail,
              password: 'default@123' // Should be changed by guide on first login
            });
          } catch (guideErr) {
            // If email already exists, find the existing guide
            if (guideErr.code === 11000) {
              guide = await Guide.findOne({ email: guideEmail });
            } else {
              throw guideErr;
            }
          }
        }

        // Create or find students
        let leaderStudent = null;
        let studentIds = [];

        for (const student of projectData.students) {
          let studentRecord = await Student.findOne({ 
            rollNumber: student.rollNumber.toUpperCase() 
          });

          if (!studentRecord) {
            const studentEmail = `${student.rollNumber.toLowerCase()}@institute.edu`;
            
            try {
              studentRecord = await Student.create({
                name: student.name,
                rollNumber: student.rollNumber.toUpperCase(),
                email: studentEmail,
                password: 'default@123',
                year: projectData.year || '3rd',
                branch: projectData.branch || 'CSE',
                section: projectData.section || 'A'
              });
            } catch (studentErr) {
              // If email exists, find the student
              if (studentErr.code === 11000) {
                studentRecord = await Student.findOne({ email: studentEmail });
              } else {
                throw studentErr;
              }
            }
          }

          studentIds.push(studentRecord._id);

          if (!leaderStudent) {
            leaderStudent = studentRecord;
          }
        }

        // Create batch
        let batch = await Batch.findOne({ 
          leaderStudentId: leaderStudent._id,
          teamName: projectData.projectId
        });

        if (!batch) {
          batch = await Batch.create({
            leaderStudentId: leaderStudent._id,
            teamName: projectData.projectId,
            year: projectData.year || '3rd',
            branch: projectData.branch || 'CSE',
            section: projectData.section || 'A',
            guideId: guide._id,
            allotmentStatus: 'allotted',
            status: 'In Progress'
          });

          // Create team members
          for (const studentId of studentIds) {
            const student = await Student.findById(studentId);
            
            // Check if team member already exists
            const existingMember = await TeamMember.findOne({
              batchId: batch._id,
              rollNo: student.rollNumber
            });

            if (!existingMember) {
              await TeamMember.create({
                batchId: batch._id,
                name: student.name,
                rollNo: student.rollNumber,
                branch: projectData.branch || 'CSE'
              });
            }
          }

          // Update guide's assigned batches count
          await Guide.findByIdAndUpdate(guide._id, {
            $inc: { assignedBatches: 1 }
          });

          batchesCreated++;
        }

        // Create project entry
        const existingProjectEntry = await ProjectEntry.findOne({
          projectId: projectData.projectId
        });

        if (!existingProjectEntry) {
          await ProjectEntry.create({
            projectId: projectData.projectId,
            projectTitle: projectData.projectTitle,
            students: projectData.students.map((s, idx) => ({
              name: s.name,
              rollNumber: s.rollNumber.toUpperCase(),
              studentId: studentIds[idx]
            })),
            internalGuide: projectData.internalGuide || projectData.internalGuideOriginal,
            guideId: guide._id,
            batchId: batch._id,
            department: projectData.department || 'CSE',
            year: projectData.year || '3rd',
            branch: projectData.branch || 'CSE',
            section: projectData.section || 'A',
            batch: projectData.batch || '',
            importedBy: adminId
          });
        }

        successCount++;
      } catch (err) {
        failedCount++;
        errors.push({
          project: projectData.projectId || 'Unknown',
          error: err.message
        });
        console.error('Project import error:', err);
      }
    }

    res.status(200).json({
      success: true,
      data: {
        success: successCount,
        created: batchesCreated,
        failed: failedCount,
        message: `Imported ${successCount} projects, created ${batchesCreated} batches`
      }
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all projects with search and filter
// @route   GET /api/projects
exports.getAllProjects = async (req, res) => {
  try {
    const { search, guideId, sort } = req.query;
    let query = {};

    if (search) {
      query.$or = [
        { projectTitle: new RegExp(search, 'i') },
        { internalGuide: new RegExp(search, 'i') },
        { projectId: new RegExp(search, 'i') }
      ];
    }

    if (guideId) {
      query.guideId = guideId;
    }

    let projectsQuery = ProjectEntry.find(query)
      .populate('guideId', 'name email')
      .populate('batchId', 'teamName')
      .sort({ createdAt: -1 });

    if (sort === 'guide') {
      projectsQuery = projectsQuery.sort({ internalGuide: 1 });
    } else if (sort === 'title') {
      projectsQuery = projectsQuery.sort({ projectTitle: 1 });
    }

    const projects = await projectsQuery.exec();

    res.status(200).json({
      success: true,
      count: projects.length,
      data: projects
    });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get projects for current guide
// @route   GET /api/projects/guide/myprojects
exports.getGuideProjects = async (req, res) => {
  try {
    const guideId = req.user.id;

    const projects = await ProjectEntry.find({ guideId })
      .populate('batchId', 'teamName')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: projects.length,
      data: projects
    });
  } catch (error) {
    console.error('Get guide projects error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Search projects
// @route   GET /api/projects/search
exports.searchProjects = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Search query required'
      });
    }

    const projects = await ProjectEntry.find({
      $or: [
        { projectTitle: new RegExp(q, 'i') },
        { internalGuide: new RegExp(q, 'i') },
        { projectId: new RegExp(q, 'i') },
        { 'students.name': new RegExp(q, 'i') },
        { 'students.rollNumber': new RegExp(q, 'i') }
      ]
    })
      .populate('guideId', 'name email')
      .populate('batchId', 'teamName')
      .limit(50);

    res.status(200).json({
      success: true,
      count: projects.length,
      data: projects
    });
  } catch (error) {
    console.error('Search projects error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Export projects to Excel
// @route   GET /api/projects/export
exports.exportProjects = async (req, res) => {
  try {
    const { search, guideId } = req.query;
    let query = {};

    if (search) {
      query.$or = [
        { projectTitle: new RegExp(search, 'i') },
        { internalGuide: new RegExp(search, 'i') },
        { projectId: new RegExp(search, 'i') }
      ];
    }

    if (guideId) {
      query.guideId = guideId;
    }

    const projects = await ProjectEntry.find(query)
      .populate('guideId', 'name email');

    // Return data for Excel export (will be handled by frontend)
    res.status(200).json({
      success: true,
      data: projects.map(p => ({
        'Project ID': p.projectId,
        'Project Title': p.projectTitle,
        'Internal Guide': p.internalGuide,
        'Students': p.students.map(s => `${s.name} (${s.rollNumber})`).join(', '),
        'Branch': p.branch,
        'Year': p.year,
        'Section': p.section,
        'Batch': p.batch,
        'Department': p.department,
        'Imported Date': new Date(p.importedAt).toLocaleDateString()
      }))
    });
  } catch (error) {
    console.error('Export projects error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
