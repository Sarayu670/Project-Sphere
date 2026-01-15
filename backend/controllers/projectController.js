const Project = require('../models/Project');
const Batch = require('../models/Batch');
const Student = require('../models/Student');
const Guide = require('../models/Guide');
const TeamMember = require('../models/TeamMember');
const { parseExcelFile, mergeRecords, validateRecord } = require('../utils/excelParser');

/**
 * @desc    Import projects from Excel files
 * @route   POST /api/projects/import
 * @access  Admin only
 */
exports.importExcelFiles = async (req, res) => {
    try {
        // Check if files are uploaded
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please upload at least one Excel file'
            });
        }

        const results = {
            success: 0,
            failed: 0,
            errors: [],
            warnings: []
        };

        // Parse all uploaded Excel files
        const allRecords = [];

        for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];

            try {
                console.log(`Processing file ${i + 1}: ${file.originalname}`);
                const records = parseExcelFile(file.buffer);
                allRecords.push(records);
                console.log(`Extracted ${records.length} records from ${file.originalname}`);
            } catch (error) {
                results.errors.push({
                    file: file.originalname,
                    error: error.message
                });
            }
        }

        // Merge records from all files and remove duplicates
        const mergedRecords = mergeRecords(...allRecords);
        console.log(`Total unique records after merging: ${mergedRecords.length}`);

        // Process each record
        for (const record of mergedRecords) {
            try {
                // Validate record
                const validation = validateRecord(record);

                if (!validation.valid) {
                    results.failed++;
                    results.warnings.push({
                        teamName: record.teamName,
                        projectTitle: record.projectTitle,
                        errors: validation.errors
                    });
                    continue;
                }

                // Sync with Batch and Students
                // 1. Find or create Guide
                let guide = null;
                if (record.guideName && record.guideName !== 'N/A') {
                    guide = await Guide.findOne({ name: { $regex: new RegExp(`^${record.guideName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
                    if (!guide) {
                        const email = record.guideName.toLowerCase().replace(/[^a-z0-9]/g, '') + '@gmail.com';
                        guide = await Guide.create({
                            name: record.guideName,
                            email: email,
                            password: 'password123'
                        });
                    }
                }

                // 2. Find or create Students
                let studentIds = [];
                for (let j = 0; j < record.students.length; j++) {
                    const sName = record.students[j];
                    const sRoll = record.rollNumbers[j] || `TEMP_${record.teamName}_${j}`;

                    let student = await Student.findOne({ rollNumber: sRoll });
                    if (!student) {
                        const email = sRoll.toLowerCase() + '@gmail.com';
                        student = await Student.create({
                            name: sName,
                            email: email,
                            password: 'password123',
                            rollNumber: sRoll,
                            year: record.year || '4th',
                            branch: record.branch || 'CSE',
                            section: record.section || 'A'
                        });
                    } else {
                        // Update metadata if student exists
                        if (record.year) student.year = record.year;
                        if (record.branch) student.branch = record.branch;
                        if (record.section) student.section = record.section;
                        await student.save();
                    }
                    studentIds.push(student._id);
                }

                // 3. Find or create Batch
                let batch = await Batch.findOne({ teamName: record.teamName });

                // CRITICAL: If batch exists, unlink old members to prevent cumulative growth
                if (batch) {
                    console.log(`[Import] Refreshing members for batch: ${batch.teamName}`);
                    await Student.updateMany({ batchId: batch._id }, { batchId: null });
                    await TeamMember.deleteMany({ batchId: batch._id });

                    if (guide) batch.guideId = guide._id;
                    if (studentIds.length > 0) batch.leaderStudentId = studentIds[0];
                    if (record.year) batch.year = record.year;
                    if (record.branch) batch.branch = record.branch;
                    if (record.section) batch.section = record.section;
                    await batch.save();
                } else {
                    batch = await Batch.create({
                        teamName: record.teamName,
                        leaderStudentId: studentIds[0] || null,
                        guideId: guide ? guide._id : null,
                        year: record.year || '4th',
                        branch: record.branch || 'CSE',
                        section: record.section || 'A'
                    });
                }

                // 4. Link students to batch and create TeamMembers
                if (batch) {
                    for (const sId of studentIds) {
                        const s = await Student.findByIdAndUpdate(sId, { batchId: batch._id }, { new: true });

                        await TeamMember.findOneAndUpdate(
                            { rollNo: s.rollNumber },
                            {
                                batchId: batch._id,
                                name: s.name,
                                rollNo: s.rollNumber,
                                branch: s.branch
                            },
                            { upsert: true }
                        );
                    }
                }

                // Create or Update project (Deduplicate by teamName)
                let project = await Project.findOne({ teamName: record.teamName });

                if (project) {
                    // Update existing project
                    project.students = record.students;
                    project.rollNumbers = record.rollNumbers || [];
                    project.guideName = record.guideName;
                    project.projectTitle = record.projectTitle !== 'N/A' ? record.projectTitle : project.projectTitle;
                    project.coe = record.coe;
                    await project.save();
                } else {
                    // Create new project
                    await Project.create({
                        teamName: record.teamName,
                        students: record.students,
                        rollNumbers: record.rollNumbers || [],
                        guideName: record.guideName,
                        projectTitle: record.projectTitle,
                        coe: record.coe,
                        source: 'excel_import'
                    });
                }

                results.success++;
            } catch (error) {
                results.failed++;
                results.errors.push({
                    teamName: record.teamName,
                    projectTitle: record.projectTitle,
                    error: error.message
                });
            }
        }

        res.status(200).json({
            success: true,
            data: results,
            message: `Import completed: ${results.success} succeeded, ${results.failed} failed`
        });

    } catch (error) {
        console.error('Excel import error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to import Excel files',
            error: error.message
        });
    }
};

/**
 * @desc    Smart search projects by guide name or project title
 * @route   GET /api/projects/search?q=keyword
 * @access  Public
 */
exports.searchProjects = async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        const searchTerm = q.trim();

        // Create case-insensitive regex pattern for partial matching
        const searchRegex = new RegExp(searchTerm, 'i');

        // Search in both guideName and projectTitle fields
        const projects = await Project.find({
            $or: [
                { guideName: searchRegex },
                { projectTitle: searchRegex }
            ]
        }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: projects.length,
            data: projects
        });

    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search projects',
            error: error.message
        });
    }
};

/**
 * @desc    Get all projects
 * @route   GET /api/projects
 * @access  Public
 */
exports.getAllProjects = async (req, res) => {
    try {
        const projects = await Project.find().sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: projects.length,
            data: projects
        });

    } catch (error) {
        console.error('Get projects error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get projects',
            error: error.message
        });
    }
};

/**
 * @desc    Delete all projects (for testing/reset)
 * @route   DELETE /api/projects/all
 * @access  Admin only
 */
exports.deleteAllProjects = async (req, res) => {
    try {
        const result = await Project.deleteMany({});

        res.status(200).json({
            success: true,
            message: `Deleted ${result.deletedCount} projects`
        });

    } catch (error) {
        console.error('Delete projects error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete projects',
            error: error.message
        });
    }
};

