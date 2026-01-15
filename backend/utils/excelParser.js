const XLSX = require('xlsx');

/**
 * Excel Parser Utility
 * Handles feature extraction and normalization from Excel files with different schemas
 */

/**
 * Column mapping patterns for intelligent field detection
 * Uses regex patterns to match various column name formats
 */
const COLUMN_PATTERNS = {
    teamName: /team|batch|group|squad/i,
    students: /student.*name|name|member|participant/i,
    rollNumbers: /roll.*number|roll.*no|roll|htno/i,
    guideName: /guide|mentor|supervisor|faculty|advisor|internal\s*guide/i,
    projectTitle: /project|title|problem|topic|statement/i,
    coe: /coe|domain|area|thrust|center|excellence|research/i,
    year: /year|class.*year/i,
    branch: /branch|department|dept/i,
    section: /section|sec/i
};

/**
 * Normalize text field
 */
function normalizeText(text) {
    if (text === undefined || text === null) return '';
    return String(text).trim();
}

/**
 * Find column index by pattern matching
 */
function findColumnIndex(headers, pattern) {
    return headers.findIndex(header =>
        header && pattern.test(String(header))
    );
}

/**
 * Find all column indices matching a pattern
 */
function findAllColumnIndices(headers, pattern) {
    const indices = [];
    headers.forEach((header, index) => {
        if (header && pattern.test(String(header))) {
            indices.push(index);
        }
    });
    return indices;
}

/**
 * Parse Excel file and extract data
 */
function parseExcelFile(fileBuffer) {
    try {
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: '',
            blankrows: false
        });

        if (jsonData.length < 2) {
            throw new Error('Excel file must have at least a header row and one data row');
        }

        const headers = jsonData[0].map(h => normalizeText(h));

        // Find column indices
        const teamNameIndex = findColumnIndex(headers, COLUMN_PATTERNS.teamName);
        const guideNameIndex = findColumnIndex(headers, COLUMN_PATTERNS.guideName);
        const projectTitleIndex = findColumnIndex(headers, COLUMN_PATTERNS.projectTitle);
        const coeIndex = findColumnIndex(headers, COLUMN_PATTERNS.coe);
        const yearIndex = findColumnIndex(headers, COLUMN_PATTERNS.year);
        const branchIndex = findColumnIndex(headers, COLUMN_PATTERNS.branch);
        const sectionIndex = findColumnIndex(headers, COLUMN_PATTERNS.section);

        // Find all student name and roll number columns
        const studentNameIndices = findAllColumnIndices(headers, COLUMN_PATTERNS.students);
        const rollNumberIndices = findAllColumnIndices(headers, COLUMN_PATTERNS.rollNumbers);

        // Group rows by team/batch name
        const teamGroups = {};
        let lastTeamName = '';
        let lastGuideName = '';
        let lastProjectTitle = '';
        let lastCoe = 'N/A';
        let lastYear = '4th';
        let lastBranch = 'CSE';
        let lastSection = 'A';

        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];

            // Skip empty rows
            if (!row || row.every(cell => !cell || String(cell).trim() === '')) {
                continue;
            }

            // Extract team name
            let teamName = teamNameIndex >= 0 ? normalizeText(row[teamNameIndex]) : '';

            // Extract all student names and roll numbers from multiple columns on this row
            const rowStudents = [];
            const rowRolls = [];

            studentNameIndices.forEach((idx, sIdx) => {
                const name = normalizeText(row[idx]);
                // Try to find matching roll number in the same relative position if multiple roll columns exist
                const rollIdx = rollNumberIndices[sIdx] !== undefined ? rollNumberIndices[sIdx] : (rollNumberIndices[0] || -1);
                const roll = rollIdx >= 0 ? normalizeText(row[rollIdx]) : '';

                if (name && name !== 'N/A' && name !== '-') {
                    rowStudents.push(name);
                    rowRolls.push(roll);
                }
            });

            // Fill down team name if empty (MERGED CELLS)
            if (!teamName && lastTeamName && rowStudents.length > 0) {
                teamName = lastTeamName;
            }

            if (!teamName) continue;
            lastTeamName = teamName;

            // Extract other fields
            let guideName = guideNameIndex >= 0 ? normalizeText(row[guideNameIndex]) : '';
            let projectTitle = projectTitleIndex >= 0 ? normalizeText(row[projectTitleIndex]) : '';
            let coe = coeIndex >= 0 ? normalizeText(row[coeIndex]) : '';
            let year = yearIndex >= 0 ? normalizeText(row[yearIndex]) : '';
            let branch = branchIndex >= 0 ? normalizeText(row[branchIndex]) : '';
            let section = sectionIndex >= 0 ? normalizeText(row[sectionIndex]) : '';

            // Fill down other fields if they are merged too
            if (!guideName && lastGuideName) guideName = lastGuideName;
            if (!projectTitle && lastProjectTitle) projectTitle = lastProjectTitle;
            if (!coe && lastCoe !== 'N/A') coe = lastCoe;
            if (!year && lastYear) year = lastYear;
            if (!branch && lastBranch) branch = lastBranch;
            if (!section && lastSection) section = lastSection;

            if (guideName) lastGuideName = guideName;
            if (projectTitle) lastProjectTitle = projectTitle;
            if (coe) lastCoe = coe;
            if (year) lastYear = year;
            if (branch) lastBranch = branch;
            if (section) lastSection = section;

            // Initialize team group if not exists
            if (!teamGroups[teamName]) {
                teamGroups[teamName] = {
                    teamName,
                    guideName: guideName || 'N/A',
                    projectTitle: projectTitle || 'N/A',
                    coe: coe || 'N/A',
                    year: year || '4th',
                    branch: branch || 'CSE',
                    section: section || 'A',
                    students: [],
                    rollNumbers: []
                };
            }

            // Add students found on this row
            rowStudents.forEach((s, idx) => {
                // Prevent duplicate students in the SAME team (if row has redundant data)
                if (!teamGroups[teamName].students.includes(s)) {
                    teamGroups[teamName].students.push(s);
                    if (rowRolls[idx]) {
                        teamGroups[teamName].rollNumbers.push(rowRolls[idx]);
                    }
                }
            });

            // Update fields if they were N/A before but now have values
            if (teamGroups[teamName].guideName === 'N/A' && guideName) teamGroups[teamName].guideName = guideName;
            if (teamGroups[teamName].projectTitle === 'N/A' && projectTitle) teamGroups[teamName].projectTitle = projectTitle;
            if (teamGroups[teamName].coe === 'N/A' && coe && coe !== 'N/A') teamGroups[teamName].coe = coe;
        }

        // Convert grouped data to records array
        const records = Object.values(teamGroups).map(group => {
            console.log(`[Parser] Team "${group.teamName}": Extracted ${group.students.length} students`);
            return {
                teamName: group.teamName || 'N/A',
                students: group.students.length > 0 ? group.students : ['N/A'],
                rollNumbers: group.rollNumbers.length > 0 ? group.rollNumbers : [],
                guideName: group.guideName || 'N/A',
                projectTitle: group.projectTitle || 'N/A',
                coe: group.coe || 'N/A',
                year: group.year,
                branch: group.branch,
                section: group.section
            };
        });

        return records;
    } catch (error) {
        throw new Error(`Failed to parse Excel file: ${error.message}`);
    }
}

/**
 * Merge records from multiple Excel files
 * Removes duplicates based on teamName + projectTitle
 * @param {Array} recordsArray - Array of record arrays
 * @returns {Array} Merged and deduplicated records
 */
function mergeRecords(...recordsArray) {
    const merged = [];
    const seen = new Set();

    recordsArray.forEach(records => {
        records.forEach(record => {
            // Create unique key
            const key = `${record.teamName.toLowerCase()}|${record.projectTitle.toLowerCase()}`;

            if (!seen.has(key)) {
                seen.add(key);
                merged.push(record);
            }
        });
    });

    return merged;
}

/**
 * Validate extracted record
 * @param {Object} record - Record to validate
 * @returns {Object} Validation result { valid: boolean, errors: Array }
 */
function validateRecord(record) {
    const errors = [];

    if (!record.teamName || record.teamName === 'N/A') {
        errors.push('Team name is missing');
    }

    if (!record.guideName || record.guideName === 'N/A') {
        errors.push('Guide name is missing');
    }

    if (!record.projectTitle || record.projectTitle === 'N/A') {
        errors.push('Project title is missing');
    }

    if (!record.students || record.students.length === 0 || record.students[0] === 'N/A') {
        errors.push('No student names found');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

module.exports = {
    parseExcelFile,
    mergeRecords,
    validateRecord,
    normalizeText
};
