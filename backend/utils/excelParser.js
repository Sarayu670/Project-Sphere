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
    batchId: /batch.*id|batchid|proj.*id|proj.*batch|batch.*no/i,
    teamName: /team|batch(?!.*(id|no))|group|squad/i,
    students: /student.*name|name.*of.*the.*student/i,
    rollNumbers: /roll.*no.*\(s\)|roll.*number|roll.*no|roll\s*no|htno/i,
    guideName: /name.*of.*the.*guide|internal.*guide|guide.*name|name.*of.*guide|mentor|supervisor|faculty|advisor|(?!.*email)\bguide\b/i,
    guideEmail: /guide.*email|guide.*mail|email.*guide|mail.*id.*guide|mail.*id/i,
    projectTitle: /project.*title|title/i,
    domain: /\bdomain\b/i,
    researchArea: /research.*area|\barea\b/i,
    thrustArea: /thrust.*area|thrust/i,
    outcome: /outcome|status.*outcome|patent|publication|patented|published/i,
    coe: /\bcoe\b|\brc\b|center.*excellence|center.*of.*excellence/i,
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
 * Normalize year to match schema enum
 */
function normalizeYear(yearStr) {
    if (!yearStr) return '4th';
    const str = String(yearStr).trim().toUpperCase();
    if (str === 'I' || str === '1' || str === '1ST') return '1st';
    if (str === 'II' || str === '2' || str === '2ND') return '2nd';
    if (str === 'III' || str === '3' || str === '3RD') return '3rd';
    if (str === 'IV' || str === '4' || str === '4TH') return '4th';
    return '4th'; // default fallback
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
 * Extract COE name from cell value or header text
 * Example: "GNITS, COE-Deep Learning in Eye Disease Prognosis" => "Deep Learning in Eye Disease Prognosis"
 * Example: "Within GNITS, CoE-Advanced Research in AI" => "Advanced Research in AI"
 */
function extractCOENameFromText(text) {
    if (!text) return 'N/A';

    let str = String(text).trim();
    if (!str) return 'N/A';

    // Remove institution/context prefixes without touching the actual COE/RC value.
    // Important: do not match "rc" inside words like "Research".
    const cleaned = str
        .replace(/^within\s+gnits\s*,?\s*/i, '')
        .replace(/^gnits\s*,\s*/i, '')
        .trim();

    const keywordMatch = cleaned.match(/(?:coe|rc|research\s+centre|research\s+center)[-\s:,]*(.+)$/i);
    const labelMatch = cleaned.match(
        /^(?:coe\s*\/\s*rc|coe|rc|research\s+cent(?:er|re))\b\s*[-:/,]?\s*(.+)$/i
    );

    const candidate = (keywordMatch && keywordMatch[1])
        ? keywordMatch[1]
        : (labelMatch && labelMatch[1])
            ? labelMatch[1]
            : cleaned;

    const normalized = String(candidate)
        .trim()
        .replace(/^(?:center of excellence|centre of excellence|coe|research center|research centre|resource center|resource centre|rc)[-:\s]*/i, '')
        .replace(/^(?:for|of|in|on|the)\s+/i, '')
        .trim();

    return normalized || 'N/A';
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
        const batchIdIndex = findColumnIndex(headers, COLUMN_PATTERNS.batchId);
        const teamNameIndex = findColumnIndex(headers, COLUMN_PATTERNS.teamName);
        const guideNameIndex = findColumnIndex(headers, COLUMN_PATTERNS.guideName);
        const guideEmailIndex = findColumnIndex(headers, COLUMN_PATTERNS.guideEmail);
        const projectTitleIndex = findColumnIndex(headers, COLUMN_PATTERNS.projectTitle);
        const domainIndex = headers.findIndex(header => {
            const value = normalizeText(header);
            return value && /\bdomain\b/i.test(value);
        });
        const researchAreaIndex = headers.findIndex(header => {
            const value = normalizeText(header);
            return value && !/domain|thrust/i.test(value) && /research.*area|\barea\b/i.test(value);
        });
        const thrustAreaIndex = headers.findIndex(header => {
            const value = normalizeText(header);
            return value && /thrust.*area|thrust/i.test(value);
        });
        const outcomeIndex = findColumnIndex(headers, COLUMN_PATTERNS.outcome);
        const coeIndex = findColumnIndex(headers, COLUMN_PATTERNS.coe);
        const yearIndex = findColumnIndex(headers, COLUMN_PATTERNS.year);
        const branchIndex = findColumnIndex(headers, COLUMN_PATTERNS.branch);
        const sectionIndex = findColumnIndex(headers, COLUMN_PATTERNS.section);

        // Find all student name and roll number columns
        const studentNameIndices = findAllColumnIndices(headers, COLUMN_PATTERNS.students);
        const rollNumberIndices = findAllColumnIndices(headers, COLUMN_PATTERNS.rollNumbers);

        console.log('[Parser] Headers from file:', headers);
        console.log('[Parser] Detected Column Mapping:', {
            batchId: batchIdIndex >= 0 ? `Matched '${headers[batchIdIndex]}'` : 'NOT FOUND',
            teamName: teamNameIndex >= 0 ? `Matched '${headers[teamNameIndex]}'` : 'NOT FOUND',
            guideName: guideNameIndex >= 0 ? `Matched '${headers[guideNameIndex]}'` : 'NOT FOUND',
            guideEmail: guideEmailIndex >= 0 ? `Matched '${headers[guideEmailIndex]}'` : 'NOT FOUND',
            projectTitle: projectTitleIndex >= 0 ? `Matched '${headers[projectTitleIndex]}'` : 'NOT FOUND',
            domain: domainIndex >= 0 ? `Matched '${headers[domainIndex]}'` : 'NOT FOUND',
            researchArea: researchAreaIndex >= 0 ? `Matched '${headers[researchAreaIndex]}'` : 'NOT FOUND',
            thrustArea: thrustAreaIndex >= 0 ? `Matched '${headers[thrustAreaIndex]}'` : 'NOT FOUND',
            outcome: outcomeIndex >= 0 ? `Matched '${headers[outcomeIndex]}'` : 'NOT FOUND',
            coe: coeIndex >= 0 ? `Matched '${headers[coeIndex]}'` : 'NOT FOUND',
            students: studentNameIndices.map(idx => headers[idx]),
            rollNumbers: rollNumberIndices.map(idx => headers[idx])
        });

        // Group rows by BatchID (or team name as fallback)
        const batchGroups = {};
        let lastBatchId = '';
        let lastTeamName = '';
        let lastGuideName = '';
        let lastGuideEmail = '';
        let lastProjectTitle = '';
        let lastDomain = 'N/A';
        let lastResearchArea = 'N/A';
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

            // Extract BatchID (primary identifier) and team name (fallback)
            let batchId = batchIdIndex >= 0 ? normalizeText(row[batchIdIndex]) : '';
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

            // Fill down BatchID and team name if empty (MERGED CELLS)
            if (!batchId && lastBatchId && rowStudents.length > 0) {
                batchId = lastBatchId;
            }
            if (!teamName && lastTeamName && rowStudents.length > 0) {
                teamName = lastTeamName;
            }

            // Use BatchID as primary key, fallback to teamName
            const groupKey = batchId || teamName;
            if (!groupKey) continue;

            lastBatchId = batchId;
            lastTeamName = teamName;

            // Extract other fields
            let guideName = guideNameIndex >= 0 ? normalizeText(row[guideNameIndex]) : '';
            let guideEmail = guideEmailIndex >= 0 ? normalizeText(row[guideEmailIndex]) : '';
            let projectTitle = projectTitleIndex >= 0 ? normalizeText(row[projectTitleIndex]) : '';
            let domain = domainIndex >= 0 ? normalizeText(row[domainIndex]) : '';
            let researchArea = researchAreaIndex >= 0 ? normalizeText(row[researchAreaIndex]) : '';
            let thrustArea = thrustAreaIndex >= 0 ? normalizeText(row[thrustAreaIndex]) : '';
            let outcome = outcomeIndex >= 0 ? normalizeText(row[outcomeIndex]) : '';
            // Extract COE from cell value and parse it
            let coeRaw = coeIndex >= 0 ? normalizeText(row[coeIndex]) : '';
            let coe = coeRaw ? extractCOENameFromText(coeRaw) : 'N/A';
            let yearRaw = yearIndex >= 0 ? normalizeText(row[yearIndex]) : '';
            let year = yearRaw ? normalizeYear(yearRaw) : '';
            let branchRaw = branchIndex >= 0 ? normalizeText(row[branchIndex]) : '';
            let branch = branchRaw ? branchRaw.toUpperCase() : '';
            let sectionRaw = sectionIndex >= 0 ? normalizeText(row[sectionIndex]) : '';
            let section = sectionRaw ? sectionRaw.toUpperCase() : '';

            // Check if this is a new batch or continuation of the same batch
            const isNewBatch = !batchGroups[groupKey];

            // Fill down other fields ONLY if they are merged within the SAME batch
            // For a new batch, we should NOT fill down from the previous batch
            if (!guideName && !isNewBatch && lastGuideName) guideName = lastGuideName;
            if (!guideEmail && !isNewBatch && lastGuideEmail) guideEmail = lastGuideEmail;
            if (!projectTitle && !isNewBatch && lastProjectTitle) projectTitle = lastProjectTitle;
            if (!domain && !isNewBatch && lastDomain !== 'N/A') domain = lastDomain;
            if (!researchArea && !isNewBatch && lastResearchArea !== 'N/A') researchArea = lastResearchArea;
            if (!coeRaw && !isNewBatch && lastCoe !== 'N/A') coe = lastCoe;
            if (!year && lastYear) year = lastYear;
            if (!branch && lastBranch) branch = lastBranch;
            if (!section && lastSection) section = lastSection;

            // Update last values for fill-down (but only after we've used them)
            if (guideName) lastGuideName = guideName;
            if (guideEmail) lastGuideEmail = guideEmail;
            if (projectTitle) lastProjectTitle = projectTitle;
            if (domain) lastDomain = domain;
            if (researchArea) lastResearchArea = researchArea;
            if (coe && coe !== 'N/A') lastCoe = coe;
            if (year) lastYear = year;
            if (branch) lastBranch = branch;
            if (section) lastSection = section;

            // Initialize batch group if not exists
            if (!batchGroups[groupKey]) {
                batchGroups[groupKey] = {
                    batchId: batchId || 'N/A',
                    teamName: teamName || batchId || 'N/A',
                    guideName: guideName || 'N/A',
                    guideEmail: guideEmail || 'N/A',
                    projectTitle: projectTitle || 'N/A',
                    domain: domain || 'N/A',
                    researchArea: researchArea || 'N/A',
                    thrustArea: thrustArea || researchArea || 'N/A',
                    outcome: outcome || 'None',
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
                // Prevent duplicate students in the SAME batch (if row has redundant data)
                if (!batchGroups[groupKey].students.includes(s)) {
                    batchGroups[groupKey].students.push(s);
                    if (rowRolls[idx]) {
                        batchGroups[groupKey].rollNumbers.push(rowRolls[idx]);
                    }
                }
            });

            // Update fields if they were N/A before but now have values
            if (batchGroups[groupKey].guideName === 'N/A' && guideName) batchGroups[groupKey].guideName = guideName;
            if (batchGroups[groupKey].guideEmail === 'N/A' && guideEmail) batchGroups[groupKey].guideEmail = guideEmail;
            if (batchGroups[groupKey].projectTitle === 'N/A' && projectTitle) batchGroups[groupKey].projectTitle = projectTitle;
            if (batchGroups[groupKey].domain === 'N/A' && domain && domain !== 'N/A') batchGroups[groupKey].domain = domain;
            if (batchGroups[groupKey].researchArea === 'N/A' && researchArea && researchArea !== 'N/A') batchGroups[groupKey].researchArea = researchArea;
            if (batchGroups[groupKey].thrustArea === 'N/A' && thrustArea && thrustArea !== 'N/A') batchGroups[groupKey].thrustArea = thrustArea;
            if (batchGroups[groupKey].coe === 'N/A' && coe && coe !== 'N/A') batchGroups[groupKey].coe = coe;
        }

        // Convert grouped data to records array
        const records = Object.values(batchGroups).map(group => {
            console.log(`[Parser] Batch "${group.batchId || group.teamName}": Extracted ${group.students.length} students`);
            return {
                batchId: group.batchId,
                teamName: group.teamName || 'N/A',
                students: group.students.length > 0 ? group.students : ['N/A'],
                rollNumbers: group.rollNumbers.length > 0 ? group.rollNumbers : [],
                guideName: group.guideName || 'N/A',
                guideEmail: group.guideEmail || 'N/A',
                projectTitle: group.projectTitle || 'N/A',
                domain: group.domain || 'N/A',
                researchArea: group.researchArea || 'N/A',
                thrustArea: group.thrustArea || group.researchArea || 'N/A',
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
