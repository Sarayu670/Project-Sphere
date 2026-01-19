const XLSX = require('xlsx');

/**
 * Excel Parser Utility - Updated for Domain, COE, RC extraction
 * Handles feature extraction and normalization from Excel files
 */

/**
 * Column mapping patterns for intelligent field detection
 */
const COLUMN_PATTERNS = {
    projectId: /proj\s*id|batch|proj.*batch/i,
    rollNumbers: /roll.*number|roll.*no|roll|htno|roll\s*no\(s\)/i,
    students: /student.*name|name|member|participant|student\s*name\(s\)/i,
    guideName: /guide|mentor|supervisor|faculty|advisor|internal\s*guide|name\s*of\s*guide/i,
    projectTitle: /project|title|problem|topic|statement|project\s*title/i,
    domain: /domain|research\s*area|area/i,
    coeRc: /coe|rc|center|excellence|within\s*gnits|gnits/i
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
 * Extract COE from "GNITS, CoE-Deep Learning in Eye Disease Prognosis" format
 */
function extractCOE(coeRcString) {
    if (!coeRcString || coeRcString === 'N/A') return 'N/A';
    const parts = coeRcString.split(',').map(p => p.trim());
    // Return first part (usually organization name)
    for (const part of parts) {
        if (!part.toLowerCase().includes('coe-') && !part.toLowerCase().includes('rc-')) {
            return part || 'N/A';
        }
    }
    return parts[0] || 'N/A';
}

/**
 * Extract RC from "GNITS, CoE-Deep Learning in Eye Disease Prognosis" format
 */
function extractRC(coeRcString) {
    if (!coeRcString || coeRcString === 'N/A') return 'N/A';
    const parts = coeRcString.split(',').map(p => p.trim());
    // Return part with CoE- or RC- prefix, or the longer descriptive part
    for (const part of parts) {
        if (part.toLowerCase().includes('coe-') || part.toLowerCase().includes('rc-')) {
            return part || 'N/A';
        }
    }
    // Return last part if no prefix found
    return parts[parts.length - 1] || 'N/A';
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
        console.log('[Parser] Headers detected:', headers);

        // Find column indices
        const projectIdIndex = findColumnIndex(headers, COLUMN_PATTERNS.projectId);
        const rollNumberIndex = findColumnIndex(headers, COLUMN_PATTERNS.rollNumbers);
        const studentNameIndex = findColumnIndex(headers, COLUMN_PATTERNS.students);
        const guideNameIndex = findColumnIndex(headers, COLUMN_PATTERNS.guideName);
        const projectTitleIndex = findColumnIndex(headers, COLUMN_PATTERNS.projectTitle);
        const domainIndex = findColumnIndex(headers, COLUMN_PATTERNS.domain);
        const coeRcIndex = findColumnIndex(headers, COLUMN_PATTERNS.coeRc);

        console.log('[Parser] Column indices:', {
            projectIdIndex, rollNumberIndex, studentNameIndex, guideNameIndex,
            projectTitleIndex, domainIndex, coeRcIndex
        });

        // Group rows by project ID
        const projectGroups = {};
        let lastProjectId = '';
        let lastGuideName = '';
        let lastProjectTitle = '';
        let lastDomain = 'N/A';
        let lastCoeRc = 'N/A';

        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];

            // Skip empty rows
            if (!row || row.every(cell => !cell || String(cell).trim() === '')) {
                continue;
            }

            // Extract fields
            const projectId = projectIdIndex >= 0 ? normalizeText(row[projectIdIndex]) : '';
            const rollNumber = rollNumberIndex >= 0 ? normalizeText(row[rollNumberIndex]) : '';
            const studentName = studentNameIndex >= 0 ? normalizeText(row[studentNameIndex]) : '';
            const guideName = guideNameIndex >= 0 ? normalizeText(row[guideNameIndex]) : '';
            const projectTitle = projectTitleIndex >= 0 ? normalizeText(row[projectTitleIndex]) : '';
            const domain = domainIndex >= 0 ? normalizeText(row[domainIndex]) : '';
            const coeRc = coeRcIndex >= 0 ? normalizeText(row[coeRcIndex]) : '';

            // Fill down values (for merged cells in Excel)
            const currentProjectId = projectId || lastProjectId;
            const currentGuideName = guideName || lastGuideName;
            const currentProjectTitle = projectTitle || lastProjectTitle;
            const currentDomain = domain || lastDomain;
            const currentCoeRc = coeRc || lastCoeRc;

            // Update last values
            if (projectId) lastProjectId = projectId;
            if (guideName) lastGuideName = guideName;
            if (projectTitle) lastProjectTitle = projectTitle;
            if (domain) lastDomain = domain;
            if (coeRc) lastCoeRc = coeRc;

            // Skip if no project ID
            if (!currentProjectId) continue;

            // Initialize project group if not exists
            if (!projectGroups[currentProjectId]) {
                projectGroups[currentProjectId] = {
                    projectId: currentProjectId,
                    guideName: currentGuideName || 'N/A',
                    projectTitle: currentProjectTitle || 'N/A',
                    domain: currentDomain || 'N/A',
                    coeRc: currentCoeRc || 'N/A',
                    students: [],
                    rollNumbers: [],
                    // Parse COE and RC
                    coe: extractCOE(currentCoeRc),
                    rc: extractRC(currentCoeRc)
                };
            }

            // Add student if both name and roll are present
            if (studentName && rollNumber) {
                // Prevent duplicate students
                if (!projectGroups[currentProjectId].students.includes(studentName)) {
                    projectGroups[currentProjectId].students.push(studentName);
                    projectGroups[currentProjectId].rollNumbers.push(rollNumber);
                }
            }

            // Update group fields
            if (projectGroups[currentProjectId].guideName === 'N/A' && currentGuideName) {
                projectGroups[currentProjectId].guideName = currentGuideName;
            }
            if (projectGroups[currentProjectId].projectTitle === 'N/A' && currentProjectTitle) {
                projectGroups[currentProjectId].projectTitle = currentProjectTitle;
            }
            if (projectGroups[currentProjectId].domain === 'N/A' && currentDomain) {
                projectGroups[currentProjectId].domain = currentDomain;
            }
        }

        // Convert grouped data to records array
        const records = Object.values(projectGroups).map(group => {
            console.log(`[Parser] Project "${group.projectId}": ${group.students.length} students, Domain: "${group.domain}", COE: "${group.coe}", RC: "${group.rc}"`);
            return {
                projectId: group.projectId || 'N/A',
                teamName: group.projectId || 'N/A', // Use projectId as teamName for compatibility
                students: group.students.length > 0 ? group.students : ['N/A'],
                rollNumbers: group.rollNumbers.length > 0 ? group.rollNumbers : [],
                guideName: group.guideName || 'N/A',
                projectTitle: group.projectTitle || 'N/A',
                domain: group.domain || 'N/A',
                coe: group.coe || 'N/A',
                rc: group.rc || 'N/A',
                year: '3rd', // Default year
                branch: 'CSE', // Default branch
                section: 'A', // Default section
                department: 'CSE' // Default department
            };
        });

        console.log(`[Parser] Successfully parsed ${records.length} projects`);
        return records;
    } catch (error) {
        console.error('[Parser] Error:', error);
        throw new Error(`Failed to parse Excel file: ${error.message}`);
    }
}

/**
 * Merge records from multiple Excel files
 */
function mergeRecords(...recordsArray) {
    const merged = [];
    const seen = new Set();

    recordsArray.forEach(records => {
        if (Array.isArray(records)) {
            records.forEach(record => {
                // Create unique key
                const key = `${record.projectId.toLowerCase()}|${record.projectTitle.toLowerCase()}`;

                if (!seen.has(key)) {
                    seen.add(key);
                    merged.push(record);
                }
            });
        }
    });

    console.log(`[Parser] Merged ${merged.length} unique records from all files`);
    return merged;
}

/**
 * Validate extracted record
 */
function validateRecord(record) {
    const errors = [];

    if (!record.projectId || record.projectId === 'N/A') {
        errors.push('Project ID is missing');
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
    normalizeText,
    extractCOE,
    extractRC
};
