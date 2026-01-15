const Project = require('../models/Project');
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

                // Check if project already exists
                const existingProject = await Project.findOne({
                    teamName: record.teamName,
                    projectTitle: record.projectTitle
                });

                if (existingProject) {
                    results.failed++;
                    results.warnings.push({
                        teamName: record.teamName,
                        projectTitle: record.projectTitle,
                        errors: ['Project already exists in database']
                    });
                    continue;
                }

                // Create new project
                await Project.create({
                    teamName: record.teamName,
                    students: record.students,
                    guideName: record.guideName,
                    projectTitle: record.projectTitle,
                    coe: record.coe,
                    source: 'excel_import'
                });

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

