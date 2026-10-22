const Project = require('../models/Project');
const Batch = require('../models/Batch');
const Student = require('../models/Student');
const Guide = require('../models/Guide');
const TeamMember = require('../models/TeamMember');
const COE = require('../models/COE');
const ProblemStatement = require('../models/ProblemStatement');
const { parseExcelFile, mergeRecords, validateRecord } = require('../utils/excelParser');
const bcrypt = require('bcryptjs');

/**
 * Prefix a team name with the joining year: "S193" -> "2023-S193".
 * Any existing year prefix is replaced, so re-imports never produce "2023-2023-S193".
 */
const withJoiningYear = (teamName, joiningYear) => {
    const name = String(teamName || '').trim().replace(/^(19|20)\d{2}-/, '');
    return `${joiningYear}-${name}`;
};

/**
 * Guess the joining year from roll numbers (JNTU format: "23251A05M43" -> 2023).
 * Returns the most common year among valid roll numbers, or null if none parse.
 */
const inferJoiningYearFromRolls = (rollNumbers = []) => {
    const counts = {};
    rollNumbers.forEach(roll => {
        const match = /^(\d{2})/.exec(String(roll || '').trim());
        if (match && !String(roll).startsWith('TEMP_')) {
            const year = 2000 + Number(match[1]);
            counts[year] = (counts[year] || 0) + 1;
        }
    });
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return entries.length ? Number(entries[0][0]) : null;
};


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

        const projectTypes = Batch.schema.path('projectType').enumValues.filter(Boolean);
        if (!projectTypes.includes(req.body.projectType)) {
            return res.status(400).json({
                success: false,
                message: 'Please select a valid project type'
            });
        }

        const joiningYear = Number(req.body.joiningYear);
        const maxJoiningYear = new Date().getFullYear() + 1;
        if (!Number.isInteger(joiningYear) || joiningYear < 2000 || joiningYear > maxJoiningYear) {
            return res.status(400).json({
                success: false,
                message: 'Please select a valid joining year'
            });
        }

        const filterOptions = {
            year: Batch.schema.path('year').enumValues,
            branch: Batch.schema.path('branch').enumValues,
            section: Batch.schema.path('section').enumValues
        };
        const filters = {};
        for (const field of Object.keys(filterOptions)) {
            const value = req.body[field] || 'all';
            if (value !== 'all' && !filterOptions[field].includes(value)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid ${field} filter`
                });
            }
            filters[field] = value === 'all' ? null : value;
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
                const records = parseExcelFile(file.buffer, {
                    year: filters.year,
                    branch: filters.branch,
                    section: filters.section
                });
                allRecords.push(records.map(record => ({
                    ...record,
                    projectType: req.body.projectType
                })));
                console.log(`Extracted ${records.length} records from ${file.originalname}`);
            } catch (error) {
                results.errors.push({
                    file: file.originalname,
                    error: error.message
                });
            }
        }

        // Merge records from all files and remove duplicates
        const mergedRecords = mergeRecords(...allRecords).filter(record =>
            Object.entries(filters).every(([field, value]) =>
                !value || String(record[field]).toLowerCase() === value.toLowerCase()
            )
        );
        console.log(`Total unique records after merging: ${mergedRecords.length}`);

        if (mergedRecords.length === 0) {
            const parseErrors = results.errors.map(({ file, error }) => `${file}: ${error}`).join('; ');
            return res.status(400).json({
                success: false,
                message: parseErrors
                    ? `No valid batches were available to import. ${parseErrors}`
                    : 'No batches matched the selected year, branch, and section filters'
            });
        }

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

                // Team name shown everywhere: "<joiningYear>-<team>". record.teamName stays raw
                // so student default passwords / placeholder roll numbers don't change.
                const displayTeamName = withJoiningYear(record.teamName, joiningYear);

                // Sanity check (warning only): roll numbers usually start with the intake year
                const rollYear = inferJoiningYearFromRolls(record.rollNumbers);
                if (rollYear && rollYear !== joiningYear) {
                    results.warnings.push({
                        teamName: displayTeamName,
                        projectTitle: record.projectTitle,
                        errors: [`Roll numbers suggest joining year ${rollYear}, but ${joiningYear} was selected. Imported anyway.`]
                    });
                }

                // Sync with Batch and Students
                // 1. Find or create Guide (with error handling for duplicates)
                let guide = null;
                console.log(`[Import] Record guide data: guideName="${record.guideName}", guideEmail="${record.guideEmail}"`);
                if (record.guideName && record.guideName !== 'N/A') {
                    const guideEmail = (record.guideEmail && record.guideEmail !== 'N/A')
                        ? record.guideEmail.toLowerCase().trim()
                        : `${record.guideName.toLowerCase().replace(/[^a-z0-9]/g, '')}${Date.now()}@guide.gnits.ac.in`;

                    try {
                        const escapedName = record.guideName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        guide = await Guide.findOne({
                            $or: [
                                { email: guideEmail },
                                { name: { $regex: `^${escapedName}$`, $options: 'i' } }
                            ]
                        });

                        if (guide) {
                            guide.name = record.guideName;
                            if (record.guideEmail && record.guideEmail !== 'N/A') {
                                guide.email = guideEmail;
                            }
                            await guide.save();
                        } else {
                            guide = await Guide.create({
                                name: record.guideName,
                                email: guideEmail,
                                password: 'gnits@123',
                                role: 'guide'
                            });
                        }
                        console.log(`[Import] Guide synced: ${guide.name} (${guide.email})`);
                    } catch (error) {
                        if (error.code === 11000) {
                            guide = await Guide.findOne({ email: guideEmail }) || await Guide.findOne({ name: record.guideName });
                            console.log(`[Import] Guide found after duplicate key: ${guide?.name}`);
                        } else {
                            console.error(`[Import] Error syncing guide ${record.guideName}: ${error.message}`);
                        }
                    }
                }


                // 2. Find or create Students
                const studentPromises = record.students.map(async (sName, j) => {
                    const sRoll = record.rollNumbers[j] || `TEMP_${record.teamName}_${j}`;
                    const studentEmail = `${sRoll.toLowerCase()}@gnits.ac.in`;
                    const sPassword = record.batchId && record.batchId !== 'N/A' ? `${record.batchId}@123` : `${record.teamName}@123`;

                    try {
                        // Hash password ONCE manually - bypass pre-save hook
                        const hashedStudentPassword = await bcrypt.hash(sPassword, 10);
                        const student = await Student.findOneAndUpdate(
                            { rollNumber: sRoll },
                            {
                                $set: {
                                    name: sName,
                                    email: studentEmail,
                                    password: hashedStudentPassword,
                                    year: record.year || '4th',
                                    branch: record.branch || 'CSE',
                                    section: record.section || 'A'
                                },
                                $setOnInsert: {
                                    rollNumber: sRoll
                                }
                            },
                            { upsert: true, new: true, setDefaultsOnInsert: true }
                        );

                        return student._id;
                    } catch (error) {
                        // Handle duplicate key error - student already exists
                        if (error.code === 11000) {
                            console.log(`[Import] Student already exists: ${sRoll}, fetching...`);
                            const existingStudent = await Student.findOne({ rollNumber: sRoll });
                            return existingStudent._id;
                        } else {
                            throw error;
                        }
                    }
                });

                const studentIds = await Promise.all(studentPromises);

                // 3. Find or create COE
                let coe = null;
                if (record.coe && record.coe !== 'N/A') {
                    try {
                        coe = await COE.findOneAndUpdate(
                            { name: record.coe },
                            { name: record.coe, description: `Center of Excellence: ${record.coe}` },
                            { upsert: true, new: true, setDefaultsOnInsert: true }
                        );
                    } catch (error) {
                        console.error(`Error upserting COE: ${error.message}`);
                    }
                }

                // 4. Find or create ProblemStatement
                let problem = null;
                if (record.projectTitle && record.projectTitle !== 'N/A') {
                    try {
                        problem = await ProblemStatement.findOneAndUpdate(
                            { title: record.projectTitle },
                            {
                                title: record.projectTitle,
                                description: `Project: ${record.projectTitle}`,
                                researchArea: record.researchArea || 'N/A',
                                coeId: coe ? coe._id : null,
                                guideId: guide ? guide._id : null,
                                targetYear: record.year || '4th',
                                status: 'active'
                            },
                            { upsert: true, new: true, setDefaultsOnInsert: true }
                        );
                    } catch (error) {
                        if (error.code === 11000) {
                            problem = await ProblemStatement.findOne({ title: record.projectTitle });
                        } else {
                            console.error(`Error creating ProblemStatement: ${error.message}`);
                        }
                    }
                }

                // 5. Find or create Batch. Identity = joiningYear + year/branch/section/type + team code,
                //    so a new intake reusing a code (e.g. S193) never overwrites an older batch.
                const batchIdentifier = record.batchId && record.batchId !== 'N/A' ? record.batchId : record.teamName;
                const identityCodes = [...new Set([batchIdentifier, record.teamName, displayTeamName])];
                const identityFilter = {
                    year: record.year,
                    branch: record.branch,
                    section: record.section,
                    projectType: record.projectType,
                    $or: [
                        { batchId: { $in: identityCodes } },
                        { teamName: { $in: identityCodes } }
                    ]
                };
                let batch = await Batch.findOne({ ...identityFilter, joiningYear });
                if (!batch) {
                    // Legacy batch imported before joining years existed: upgrade it in place
                    batch = await Batch.findOne({ ...identityFilter, joiningYear: null });
                }

                // CRITICAL: If batch exists, unlink old members to prevent cumulative growth
                if (batch) {
                    console.log(`[Import] Refreshing members for batch: ${batch.batchId || batch.teamName}`);
                    await Student.updateMany({ batchId: batch._id }, { batchId: null });
                    await TeamMember.deleteMany({ batchId: batch._id });

                    // Update batch fields
                    if (record.batchId && record.batchId !== 'N/A') batch.batchId = record.batchId;
                    if (guide) {
                        batch.guideId = guide._id;
                        batch.allotmentStatus = 'allotted';
                        batch.status = 'In Progress';
                    }
                    if (problem) batch.problemId = problem._id;
                    if (coe) {
                        batch.coeId = coe._id;
                        batch.coe = { name: record.coe, coeId: coe._id };
                    } else if (record.coe && record.coe !== 'N/A') {
                        batch.coe = { name: record.coe, coeId: null };
                    }
                    if (studentIds.length > 0) batch.leaderStudentId = studentIds[0];
                    if (record.year) batch.year = record.year;
                    if (record.branch) batch.branch = record.branch;
                    if (record.section) batch.section = record.section;
                    batch.projectType = record.projectType;
                    batch.joiningYear = joiningYear;
                    batch.teamName = displayTeamName;
                    if (record.domain && record.domain !== 'N/A') batch.domain = record.domain;
                    if (record.researchArea && record.researchArea !== 'N/A') {
                        batch.researchArea = record.researchArea;
                    }
                    if (record.thrustArea && record.thrustArea !== 'N/A') batch.thrustArea = record.thrustArea;
                    if (record.outcome && record.outcome !== 'N/A') batch.outcome = record.outcome;
                    await batch.save();
                } else {
                    batch = await Batch.create({
                        batchId: record.batchId && record.batchId !== 'N/A' ? record.batchId : undefined,
                        teamName: displayTeamName,
                        joiningYear,
                        leaderStudentId: studentIds[0] || null,
                        guideId: guide ? guide._id : null,
                        allotmentStatus: guide ? 'allotted' : 'none',
                        status: guide ? 'In Progress' : 'Not Started',
                        problemId: problem ? problem._id : null,
                        coeId: coe ? coe._id : null,
                        coe: record.coe && record.coe !== 'N/A' ? { name: record.coe, coeId: coe ? coe._id : null } : undefined,
                        year: record.year || '4th',
                        branch: record.branch || 'CSE',
                        section: record.section || 'A',
                        projectType: record.projectType,
                        domain: record.domain && record.domain !== 'N/A' ? record.domain : undefined,
                        researchArea: record.researchArea && record.researchArea !== 'N/A' ? record.researchArea : undefined,
                        thrustArea: record.thrustArea && record.thrustArea !== 'N/A' ? record.thrustArea : (record.researchArea || undefined),
                        outcome: record.outcome && record.outcome !== 'N/A' ? record.outcome : 'None'
                    });
                }


                // 6. Link students to batch and create TeamMembers (optimized with parallel processing)
                if (batch) {
                    const linkingPromises = studentIds.map(async (sId) => {
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
                    });

                    await Promise.all(linkingPromises);
                }

                // Create or Update project (Deduplicate by batchId or teamName)
                const projectIdentifier = record.batchId && record.batchId !== 'N/A' ? record.batchId : record.teamName;
                let project = await Project.findOne({ teamName: displayTeamName });
                if (!project) {
                    // Legacy project saved before joining years (raw, unprefixed team name)
                    project = await Project.findOne({
                        teamName: { $in: [...new Set([record.teamName, projectIdentifier])] }
                    });
                }

                if (project) {
                    // Update existing project
                    if (record.batchId && record.batchId !== 'N/A') project.batchId = record.batchId;
                    project.teamName = displayTeamName;
                    project.students = record.students;
                    project.rollNumbers = record.rollNumbers || [];
                    project.guideName = record.guideName;
                    project.projectTitle = record.projectTitle !== 'N/A' ? record.projectTitle : project.projectTitle;
                    project.domain = record.domain || 'N/A';
                    project.researchArea = record.researchArea || 'N/A';
                    project.thrustArea = record.thrustArea || record.researchArea || 'N/A';
                    project.outcome = record.outcome || 'None';
                    project.coe = record.coe;
                    await project.save();
                } else {
                    // Create new project
                    await Project.create({
                        batchId: record.batchId || 'N/A',
                        teamName: displayTeamName,
                        students: record.students,
                        rollNumbers: record.rollNumbers || [],
                        guideName: record.guideName,
                        projectTitle: record.projectTitle,
                        domain: record.domain || 'N/A',
                        researchArea: record.researchArea || 'N/A',
                        thrustArea: record.thrustArea || record.researchArea || 'N/A',
                        outcome: record.outcome || 'None',
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
        const { q, type = 'all' } = req.query;

        if (!q || q.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        const searchTerm = q.trim();
        const searchRegex = new RegExp(searchTerm, 'i');

        // Build restrictive query based on type
        let query = {};
        if (type === 'all') {
            query = {
                $or: [
                    { guideName: searchRegex },
                    { projectTitle: searchRegex },
                    { domain: searchRegex },
                    { researchArea: searchRegex },
                    { coe: searchRegex }
                ]
            };
        } else if (type === 'guide') {
            query = { guideName: searchRegex };
        } else if (type === 'problem') {
            query = { projectTitle: searchRegex };
        } else if (type === 'research') {
            query = { researchArea: searchRegex };
        } else if (type === 'domain') {
            query = { domain: searchRegex };
        } else if (type === 'coe') {
            query = { coe: searchRegex };
        }

        const projects = await Project.find(query).sort({ createdAt: -1 });

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
