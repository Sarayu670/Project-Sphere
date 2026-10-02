import { useState } from 'react';
import * as api from '../../services/api';

function GuideSearch() {
  const [guideName, setGuideName] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();

    if (!guideName.trim()) {
      setError('Please enter a guide name');
      return;
    }

    setLoading(true);
    setError('');
    setResults(null);
    setProjects([]);

    try {
      // Search batches (required)
      const batchesResponse = await api.searchBatchesByGuide(guideName, searchType);
      setResults(batchesResponse.data.data);

      // Search projects (optional - don't fail if this errors)
      try {
        const projectsResponse = await api.searchProjects(guideName, searchType);
        setProjects(projectsResponse.data.data || []);
      } catch (projectErr) {
        console.warn('Project search failed (non-critical):', projectErr.message);
        setProjects([]);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to search');
      setResults(null);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper to clean COE/RC value by stripping 'for', 'CoE for', 'RC for', etc.
  const cleanCoeRcValue = (value) => {
    if (!value || value === 'N/A' || value === '--') return '';
    let str = String(value).trim().replace(/\s+/g, ' ');
    const explicitLabelPattern = /^(?:within\s+gnits\s*[,;:.-]?\s*|gnits\s*[,;:.-]?\s*)*(?:center\s+of\s+excellence|centre\s+of\s+excellence|research\s+cent(?:er|re)|resource\s+cent(?:er|re)|coe|rc)\b\s*[-:/,]?\s*(?:for\s+)?/i;
    let cleaned = str.replace(explicitLabelPattern, '').trim();
    cleaned = cleaned.replace(/^for\s+/i, '').trim();
    return cleaned || str;
  };

  // Helper to normalize team identifiers for matching (e.g., "CSE C7" -> "c7", "C7" -> "c7")
  const normalizeIdentifier = (str) => {
    if (!str || str === 'N/A') return '';
    return String(str)
      .trim()
      .toLowerCase()
      .replace(/^(?:cse|it|ece|csm|eee|csd|etm)\s+/i, '')
      .replace(/[^a-z0-9]/g, '');
  };

  // Extract set of roll numbers from a student list
  const getRollSet = (students) => {
    const set = new Set();
    if (Array.isArray(students)) {
      students.forEach(s => {
        const roll = (typeof s === 'string' ? '' : (s.rollNumber || s.rollNo || '')).trim().toLowerCase();
        if (roll && roll !== 'n/a' && roll !== '-') {
          set.add(roll);
        }
      });
    }
    return set;
  };

  // Check if two team items represent the same physical team
  const isSameTeam = (a, b) => {
    // 1. Roll numbers match check
    const rollsA = getRollSet(a.students);
    const rollsB = getRollSet(b.students);
    if (rollsA.size > 0 && rollsB.size > 0) {
      let matches = 0;
      rollsA.forEach(r => { if (rollsB.has(r)) matches++; });
      if (matches >= 2 || (matches > 0 && matches === Math.min(rollsA.size, rollsB.size))) {
        return true;
      }
    }

    // 2. Normalized batchId match check
    const bIdA = normalizeIdentifier(a.batchId);
    const bIdB = normalizeIdentifier(b.batchId);
    if (bIdA && bIdB && bIdA === bIdB) return true;

    // 3. Normalized teamName match check
    const tNameA = normalizeIdentifier(a.teamName);
    const tNameB = normalizeIdentifier(b.teamName);
    if (tNameA && tNameB && tNameA === tNameB) return true;

    // 4. Cross match batchId and teamName
    if (bIdA && tNameB && bIdA === tNameB) return true;
    if (bIdB && tNameA && bIdB === tNameA) return true;

    return false;
  };

  // Helper to deduplicate and merge batches and projects
  const getUnifiedTeams = () => {
    if (!results && (!projects || projects.length === 0)) return [];

    const rawList = [];

    // Collect all batches
    if (results?.batches) {
      results.batches.forEach(batch => {
        const coeDisplay = cleanCoeRcValue(batch.coe);
        const rcDisplay = cleanCoeRcValue(batch.rc);
        const coeRc = (coeDisplay && rcDisplay) ? `${coeDisplay}, ${rcDisplay}` : (coeDisplay || rcDisplay || 'N/A');

        rawList.push({
          _id: batch._id,
          batchId: batch.batchId || 'N/A',
          teamName: batch.teamName || 'N/A',
          students: (batch.students || []).map(s => typeof s === 'string' ? { name: s, rollNumber: 'N/A' } : s),
          studentCount: batch.studentCount || (batch.students ? batch.students.length : 0),
          leaderStudent: batch.leaderStudent,
          guideName: batch.guideName || results.guide?.name || 'N/A',
          projectTitle: batch.projectTitle || 'N/A',
          researchArea: batch.researchArea || 'N/A',
          coe: coeRc,
          isProject: false
        });
      });
    }

    // Collect all projects
    if (Array.isArray(projects)) {
      projects.forEach(project => {
        const pStudents = (project.students || []).map((s, idx) => ({
          name: typeof s === 'string' ? s : s.name,
          rollNumber: project.rollNumbers?.[idx] || (typeof s === 'object' ? (s.rollNumber || s.rollNo || 'N/A') : 'N/A')
        }));
        const coeDisplay = cleanCoeRcValue(project.coe);
        const rcDisplay = cleanCoeRcValue(project.rc);
        const projectCoeRc = (coeDisplay && rcDisplay) ? `${coeDisplay}, ${rcDisplay}` : (coeDisplay || rcDisplay || 'N/A');

        rawList.push({
          _id: project._id,
          batchId: project.batchId || 'N/A',
          teamName: project.teamName || 'N/A',
          students: pStudents,
          studentCount: pStudents.length,
          leaderStudent: null,
          guideName: project.guideName || 'N/A',
          projectTitle: project.projectTitle || 'N/A',
          researchArea: project.researchArea || 'N/A',
          coe: projectCoeRc,
          isProject: true
        });
      });
    }

    // Merge duplicate items in rawList
    const merged = [];

    rawList.forEach(item => {
      const existing = merged.find(target => isSameTeam(target, item));

      if (!existing) {
        merged.push({ ...item });
      } else {
        // Merge item into existing
        if (item.teamName && item.teamName !== 'N/A') {
          if (!existing.teamName || existing.teamName === 'N/A' || (item.teamName.length < existing.teamName.length && !item.teamName.toLowerCase().startsWith('cse '))) {
            existing.teamName = item.teamName;
          }
        }
        if (item.batchId && item.batchId !== 'N/A' && (existing.batchId === 'N/A' || item.batchId.length < existing.batchId.length)) {
          existing.batchId = item.batchId;
        }

        if (item.isProject) existing.isProject = true;
        if (item.projectTitle && item.projectTitle !== 'N/A') existing.projectTitle = item.projectTitle;
        if (item.researchArea && item.researchArea !== 'N/A') existing.researchArea = item.researchArea;
        if (item.guideName && item.guideName !== 'N/A') existing.guideName = item.guideName;

        // Merge COE/RC strings
        const coeSet = new Set();
        [existing.coe, item.coe].forEach(cStr => {
          if (cStr && cStr !== 'N/A') {
            cStr.split(',').forEach(part => {
              const cleaned = cleanCoeRcValue(part);
              if (cleaned) coeSet.add(cleaned);
            });
          }
        });
        existing.coe = Array.from(coeSet).join(', ') || 'N/A';

        // Merge students (dedup by roll number if available, else by student name)
        const studentMap = new Map();
        [...(existing.students || []), ...(item.students || [])].forEach(s => {
          const roll = (s.rollNumber || s.rollNo || '').trim().toUpperCase();
          const key = (roll && roll !== 'N/A') ? roll : s.name?.trim().toLowerCase();
          if (key && !studentMap.has(key)) {
            studentMap.set(key, s);
          }
        });
        existing.students = Array.from(studentMap.values());
        existing.studentCount = existing.students.length;
      }
    });

    return merged;
  };

  const unifiedTeams = getUnifiedTeams();

  // Download search results as Excel with ALL columns
  const downloadAsExcel = () => {
    if (unifiedTeams.length === 0) {
      alert('No results to download');
      return;
    }

    try {
      // Prepare CSV data with all columns
      let csvContent = 'data:text/csv;charset=utf-8,';
      csvContent += 'S.No,Proj ID/Batch,Roll No(s),Student Name(s),Guide,Project Title,Research Area,COE/RC\n';

      let sNo = 1;
      unifiedTeams.forEach((team) => {
        const teamName = team.teamName || '-';
        const guide = team.guideName || '-';
        const projectTitle = team.projectTitle || '-';
        const researchArea = team.researchArea || '-';
        const coe = team.coe || '-';
        const students = team.students || [];

        if (students.length === 0) {
          // If no students, show team with empty student fields
          const row = [
            sNo,
            `"${teamName.replace(/"/g, '""')}"`,
            '-',
            '-',
            `"${guide.replace(/"/g, '""')}"`,
            `"${projectTitle.replace(/"/g, '""')}"`,
            `"${researchArea.replace(/"/g, '""')}"`,
            `"${coe.replace(/"/g, '""')}"`
          ];
          csvContent += row.join(',') + '\n';
          sNo++;
        } else {
          // Show team info on first student row, leave empty for subsequent students
          students.forEach((student, idx) => {
            const rollNumber = student.rollNumber || '-';
            const studentName = student.name || '-';
            const row = [
              idx === 0 ? sNo : '',  // S.No only on first student
              idx === 0 ? `"${teamName.replace(/"/g, '""')}"` : '',  // Team only on first
              rollNumber,
              `"${studentName.replace(/"/g, '""')}"`,
              idx === 0 ? `"${guide.replace(/"/g, '""')}"` : '',  // Guide only on first
              idx === 0 ? `"${projectTitle.replace(/"/g, '""')}"` : '',  // Project only on first
              idx === 0 ? `"${researchArea.replace(/"/g, '""')}"` : '',  // Research area only on first
              idx === 0 ? `"${coe.replace(/"/g, '""')}"` : ''  // COE only on first
            ];
            csvContent += row.join(',') + '\n';
          });
          sNo++;
        }
      });

      // Create download link
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `guide_search_results_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Failed to download:', error);
      alert('Failed to download file');
    }
  };

  return (
    <div>
      <div className="card" style={{ padding: '24px', maxWidth: '100%' }}>
        <form onSubmit={handleSearch} style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            {/* New Search Type Dropdown */}
            <div style={{ width: '200px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#2d3748' }}>
                Search By
              </label>
              <select
                value={searchType}
                onChange={(e) => setSearchType(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #cbd5e0',
                  borderRadius: '6px',
                  fontSize: '14px',
                  backgroundColor: 'white'
                }}
              >
                <option value="all">All Fields</option>
                <option value="guide">Guide Name</option>
                <option value="problem">Problem Title</option>
                <option value="research">Research Area</option>
                <option value="coe">COE / RC</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#2d3748' }}>
                Search Term
              </label>
              <input
                type="text"
                value={guideName}
                onChange={(e) => setGuideName(e.target.value)}
                placeholder="e.g., Deep Learning, IOT, or Guide Name"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #cbd5e0',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '12px 24px',
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
            {results && unifiedTeams.length > 0 && (
              <button
                type="button"
                onClick={downloadAsExcel}
                style={{
                  padding: '12px 24px',
                  background: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  whiteSpace: 'nowrap'
                }}
                title="Download search results as CSV"
              >
                📥 Download Results
              </button>
            )}
          </div>
        </form>

        {error && (
          <div style={{ padding: '12px', background: '#fed7d7', border: '1px solid #fc8181', borderRadius: '6px', color: '#c53030', marginBottom: '20px' }}>
            {error}
          </div>
        )}

        {results && (
          <div>
            <div style={{ marginBottom: '24px', padding: '16px', background: '#edf2f7', borderRadius: '8px' }}>
              <h3 style={{ color: '#2d3748', marginBottom: '12px' }}>
                👨‍🏫 {unifiedTeams.some(t => t.guideName !== results.guide.name) ? 'Search Results' : `Guide: ${results.guide.name}`}
              </h3>
              <div style={{ maxWidth: '240px' }}>
                <div style={{ padding: '16px', background: 'white', borderRadius: '8px', border: '1px solid #cbd5e0', textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', color: '#718096', marginBottom: '8px' }}>Total Batches</p>
                  <p style={{ fontSize: '28px', fontWeight: 'bold', color: '#667eea' }}>{unifiedTeams.length}</p>
                </div>
              </div>
            </div>

            {/* Single Unified Table */}
            {unifiedTeams.length > 0 ? (
              <div>
                <h3 style={{ color: '#2d3748', marginBottom: '16px' }}>
                  📋 All Teams & Projects ({unifiedTeams.length})
                </h3>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    background: 'white',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    borderRadius: '8px',
                    overflow: 'hidden'
                  }}>
                    <thead>
                      <tr style={{ background: '#667eea', color: 'white' }}>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>Batch/Team</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>Roll Number</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>Student Name</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>Guide</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>Project Title</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>Research Area</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>COE/RC</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unifiedTeams.map((team) => (
                        team.students.map((student, studentIdx) => (
                          <tr key={`${team._id}-${studentIdx}`} style={{
                            borderBottom: '1px solid #e2e8f0',
                            borderTop: studentIdx === 0 ? '3px solid #cbd5e0' : 'none',
                            background: team.isProject
                              ? (studentIdx % 2 === 0 ? '#f0fdf4' : 'white')
                              : (studentIdx % 2 === 0 ? '#fafbfc' : 'white')
                          }}>
                            {studentIdx === 0 ? (
                              <td rowSpan={team.students.length} style={{
                                padding: '12px',
                                fontWeight: '600',
                                color: '#2d3748',
                                borderRight: '2px solid #cbd5e0',
                                verticalAlign: 'top',
                                background: team.isProject ? '#ecfdf5' : '#f0f4ff'
                              }}>
                                {team.teamName}
                                <div style={{
                                  fontSize: '11px',
                                  color: team.isProject ? '#10b981' : '#667eea',
                                  marginTop: '4px',
                                  fontWeight: '500'
                                }}>
                                  {team.studentCount} members
                                </div>
                              </td>
                            ) : null}
                            <td style={{ padding: '12px', fontSize: '13px', color: '#4a5568' }}>
                              {student.rollNumber || 'N/A'}
                            </td>
                            <td style={{ padding: '12px', fontSize: '13px', color: '#2d3748', fontWeight: '500' }}>
                              {student.name}
                            </td>
                            {studentIdx === 0 ? (
                              <>
                                <td rowSpan={team.students.length} style={{ padding: '12px', fontSize: '13px', color: '#4a5568', verticalAlign: 'top' }}>
                                  {team.guideName}
                                </td>
                                <td rowSpan={team.students.length} style={{ padding: '12px', fontSize: '13px', color: '#4a5568', verticalAlign: 'top' }}>
                                  {team.projectTitle}
                                </td>
                                <td rowSpan={team.students.length} style={{ padding: '12px', fontSize: '13px', color: '#4a5568', verticalAlign: 'top' }}>
                                  {team.researchArea || 'N/A'}
                                </td>
                                <td rowSpan={team.students.length} style={{
                                  padding: '12px',
                                  fontSize: '13px',
                                  color: 'white',
                                  background: team.isProject ? '#10b981' : '#667eea',
                                  fontWeight: '600',
                                  verticalAlign: 'top'
                                }}>
                                  {team.coe}
                                </td>
                              </>
                            ) : null}
                          </tr>
                        ))
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', background: '#f7fafc', borderRadius: '8px', color: '#718096' }}>
                No teams or projects found for this guide
              </div>
            )}
          </div>
        )}

        {!results && !error && guideName && !loading && (
          <div style={{ padding: '20px', textAlign: 'center', background: '#f7fafc', borderRadius: '8px', color: '#718096' }}>
            Click "Search" to find batches for this guide
          </div>
        )}
      </div>
    </div>
  );
}

export default GuideSearch;
