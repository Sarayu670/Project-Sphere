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
    students: /student|member|name|participant/i,
    guideName: /guide|mentor|supervisor|faculty|advisor|internal\s*guide/i,
    projectTitle: /project|title|problem|topic|statement/i,
    coe: /coe|domain|area|thrust|center|excellence|research/i
};

/**
 * Normalize text field
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
function normalizeText(text) {
    if (!text) return '';
    return String(text).trim();
}

/**
 * Find column index by pattern matching
 * @param {Array} headers - Array of header names
 * @param {RegExp} pattern - Pattern to match
 * @returns {number} Column index or -1 if not found
 */
function findColumnIndex(headers, pattern) {
    return headers.findIndex(header =>
        header && pattern.test(String(header))
    );
}

/**
 * Find all column indices matching a pattern
 * @param {Array} headers - Array of header names
 * @param {RegExp} pattern - Pattern to match
 * @returns {Array} Array of column indices
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
 * Extract student names from multiple columns
 * @param {Object} row - Row data
 * @param {Array} headers - Array of header names
 * @returns {Array} Array of student names
 */
function extractStudentNames(row, headers) {
    const studentIndices = findAllColumnIndices(headers, COLUMN_PATTERNS.students);
    const students = [];

    studentIndices.forEach(index => {
        const value = normalizeText(row[headers[index]]);
        if (value && value !== 'N/A' && value !== '-') {
            students.push(value);
        }
    });

    return students;
}

/**
 * Parse Excel file and extract data
 * @param {Buffer} fileBuffer - Excel file buffer
 * @returns {Array} Array of extracted records
 */
function parseExcelFile(fileBuffer) {
    try {
        // Read workbook from buffer
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });

        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            defval: '',
            blankrows: false
        });

        if (jsonData.length < 2) {
            throw new Error('Excel file must have at least a header row and one data row');
        }

        // Extract headers (first row)
        const headers = jsonData[0].map(h => normalizeText(h));

        // Find column indices
        const teamNameIndex = findColumnIndex(headers, COLUMN_PATTERNS.teamName);
        const guideNameIndex = findColumnIndex(headers, COLUMN_PATTERNS.guideName);
        const projectTitleIndex = findColumnIndex(headers, COLUMN_PATTERNS.projectTitle);
        const coeIndex = findColumnIndex(headers, COLUMN_PATTERNS.coe);

        // Find student name column and roll number column
        const studentNameIndex = headers.findIndex(h => /student.*name|name/i.test(h));
        const rollNumberIndex = headers.findIndex(h => /roll.*number|roll.*no|roll/i.test(h));

        // Group rows by team/batch name
        const teamGroups = {};

        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];

            // Skip empty rows
            if (!row || row.every(cell => !cell || String(cell).trim() === '')) {
                continue;
            }

            // Extract team name
            const teamName = teamNameIndex >= 0 ? normalizeText(row[teamNameIndex]) : '';

            if (!teamName) continue;

            // Extract other fields
            const guideName = guideNameIndex >= 0 ? normalizeText(row[guideNameIndex]) : '';
            const projectTitle = projectTitleIndex >= 0 ? normalizeText(row[projectTitleIndex]) : '';
            const coe = coeIndex >= 0 ? normalizeText(row[coeIndex]) : 'N/A';

            // Extract student name and roll number
            const studentName = studentNameIndex >= 0 ? normalizeText(row[studentNameIndex]) : '';
            const rollNumber = rollNumberIndex >= 0 ? normalizeText(row[rollNumberIndex]) : '';

            // Initialize team group if not exists
            if (!teamGroups[teamName]) {
                teamGroups[teamName] = {
                    teamName,
                    guideName,
                    projectTitle,
                    coe,
                    students: [],
                    rollNumbers: []
                };
            }

            // Add student to the team group
            if (studentName) {
                teamGroups[teamName].students.push(studentName);
            }
            if (rollNumber) {
                teamGroups[teamName].rollNumbers.push(rollNumber);
            }

            // Update guide/project/coe if they were empty before
            if (!teamGroups[teamName].guideName && guideName) {
                teamGroups[teamName].guideName = guideName;
            }
            if (!teamGroups[teamName].projectTitle && projectTitle) {
                teamGroups[teamName].projectTitle = projectTitle;
            }
            if (teamGroups[teamName].coe === 'N/A' && coe && coe !== 'N/A') {
                teamGroups[teamName].coe = coe;
            }
        }

        // Convert grouped data to records array
        const records = Object.values(teamGroups).map(group => ({
            teamName: group.teamName || 'N/A',
            students: group.students.length > 0 ? group.students : ['N/A'],
            rollNumbers: group.rollNumbers.length > 0 ? group.rollNumbers : [],
            guideName: group.guideName || 'N/A',
            projectTitle: group.projectTitle || 'N/A',
            coe: group.coe || 'N/A'
        }));

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
