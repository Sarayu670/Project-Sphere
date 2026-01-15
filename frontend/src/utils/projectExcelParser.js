// Utility to parse project details from Excel file
export const parseProjectsFromExcel = (jsonData) => {
  const projects = [];
  const errors = [];
  let currentProject = null;

  jsonData.forEach((row, index) => {
    try {
      // Extract required fields
      const projectId = (row['Proj ID/Batch'] || row['ProjectID'] || row['Proj ID'] || '').toString().trim();
      const rollNumber = (row['Roll Number'] || row['RollNumber'] || row['Roll'] || '').toString().trim().toUpperCase();
      const studentName = (row['Student Name'] || row['StudentName'] || row['Student'] || '').toString().trim();
      const internalGuide = (row['Internal Guide'] || row['InternalGuide'] || row['Guide'] || '').toString().trim();
      const projectTitle = (row['Project Title'] || row['ProjectTitle'] || row['Title'] || '').toString().trim();

      // Skip completely empty rows
      if (!projectId && !rollNumber && !studentName && !internalGuide && !projectTitle) {
        return;
      }

      // Skip header row or rows with obvious headers
      if (projectId.toLowerCase().includes('proj') || rollNumber.toLowerCase().includes('roll')) {
        return;
      }

      // If this row has a Proj ID/Batch, it's the start of a new batch group
      if (projectId) {
        // Create new project for this batch
        currentProject = {
          projectId,
          projectTitle: projectTitle || '',
          internalGuide: internalGuide ? internalGuide.toLowerCase() : '',
          internalGuideOriginal: internalGuide || '',
          students: [],
          department: row['Department'] || row['department'] || 'CSE',
          year: extractYear(row['Batch'] || row['batch'] || projectId),
          branch: extractBranch(row['Batch'] || row['batch'] || projectId),
          section: extractSection(row['Batch'] || row['batch'] || projectId),
          batch: row['Batch'] || row['batch'] || ''
        };

        // Add first student if this row has student info
        if (rollNumber && studentName) {
          currentProject.students.push({
            name: studentName,
            rollNumber: rollNumber
          });
        }

        projects.push(currentProject);
      } 
      // If this row doesn't have Proj ID but has student info, add to current project
      else if (rollNumber && studentName && currentProject) {
        const studentExists = currentProject.students.some(s => s.rollNumber === rollNumber);
        if (!studentExists) {
          currentProject.students.push({
            name: studentName,
            rollNumber: rollNumber
          });
        }

        // Update project details if found in this row
        if (projectTitle && !currentProject.projectTitle) {
          currentProject.projectTitle = projectTitle;
        }
        if (internalGuide && !currentProject.internalGuide) {
          currentProject.internalGuide = internalGuide.toLowerCase();
          currentProject.internalGuideOriginal = internalGuide;
        }
      }
      // If row has Proj ID but no student info, update current project details
      else if (projectId && !rollNumber && !studentName) {
        if (projectTitle && currentProject) {
          currentProject.projectTitle = projectTitle;
        }
        if (internalGuide && currentProject) {
          currentProject.internalGuide = internalGuide.toLowerCase();
          currentProject.internalGuideOriginal = internalGuide;
        }
      }
    } catch (err) {
      errors.push({
        row: index + 2,
        error: err.message
      });
    }
  });

  // Validate all projects have required fields and at least one student
  const validProjects = projects.filter(p => {
    if (!p.projectId) {
      errors.push({
        project: 'Unknown',
        error: 'Missing project ID'
      });
      return false;
    }
    if (!p.projectTitle) {
      errors.push({
        project: p.projectId,
        error: 'Missing project title'
      });
      return false;
    }
    if (!p.internalGuide || p.internalGuide.trim() === '') {
      errors.push({
        project: p.projectId,
        error: 'Missing internal guide'
      });
      return false;
    }
    if (p.students.length === 0) {
      errors.push({
        project: p.projectId,
        error: 'No students assigned to project'
      });
      return false;
    }
    return true;
  });

  console.log('Parse Debug:', { 
    totalRows: jsonData.length,
    projectsCreated: projects.length,
    validProjects: validProjects.length,
    errors: errors.length,
    projects: projects,
    errors: errors
  });

  return { projects: validProjects, errors };
};

// Extract year from batch string or project ID
export const extractYear = (batchStr) => {
  if (!batchStr) return '3rd';
  if (batchStr.includes('2nd')) return '2nd';
  if (batchStr.includes('3rd')) return '3rd';
  if (batchStr.includes('4th')) return '4th';
  return '3rd';
};

// Extract branch from batch string
export const extractBranch = (batchStr) => {
  const branches = ['CSE', 'IT', 'ECE', 'CSM', 'EEE', 'CSD', 'ETM'];
  if (!batchStr) return 'CSE';
  
  for (const branch of branches) {
    if (batchStr.includes(branch)) return branch;
  }
  return 'CSE';
};

// Extract section from batch string
export const extractSection = (batchStr) => {
  const sections = ['A', 'B', 'C', 'D', 'E'];
  if (!batchStr) return 'A';
  
  for (const section of sections) {
    if (batchStr.includes(section)) return section;
  }
  return 'A';
};
