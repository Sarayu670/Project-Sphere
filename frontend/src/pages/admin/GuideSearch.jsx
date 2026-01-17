import { useState } from 'react';
import * as api from '../../services/api';

function GuideSearch() {
  const [guideName, setGuideName] = useState('');
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
      // Search both batches and imported projects
      const [batchesResponse, projectsResponse] = await Promise.all([
        api.searchBatchesByGuide(guideName),
        api.searchProjects(guideName) // Search projects by guide name
      ]);

      setResults(batchesResponse.data.data);
      setProjects(projectsResponse.data.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to search');
      setResults(null);
      setProjects([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper to deduplicate and merge batches and projects
  const getUnifiedTeams = () => {
    if (!results) return [];

    const teamMap = new Map();

    // First, add all batches from results
    if (results.batches) {
      results.batches.forEach(batch => {
        teamMap.set(batch.teamName.toLowerCase(), {
          _id: batch._id,
          teamName: batch.teamName,
          students: batch.students,
          studentCount: batch.studentCount,
          leaderStudent: batch.leaderStudent,
          guideName: results.guide.name,
          projectTitle: 'N/A',
          coe: 'N/A',
          isProject: false
        });
      });
    }

    // Then, merge or add projects
    projects.forEach(project => {
      const key = project.teamName.toLowerCase();
      const existing = teamMap.get(key);

      if (existing) {
        // Project exists, update metadata and prefer its student list if it has one
        existing.projectTitle = project.projectTitle;
        existing.coe = project.coe;
        existing.isProject = true;

        // Use project's student list if it looks more authoritative
        if (project.students && project.students.length > 0) {
          existing.students = project.students.map((s, idx) => ({
            name: s,
            rollNumber: project.rollNumbers?.[idx] || 'N/A'
          }));
          existing.studentCount = project.students.length;
        }
      } else {
        teamMap.set(key, {
          _id: project._id,
          teamName: project.teamName,
          students: project.students.map((s, idx) => ({
            name: s,
            rollNumber: project.rollNumbers?.[idx] || 'N/A'
          })),
          studentCount: project.students.length,
          guideName: project.guideName,
          projectTitle: project.projectTitle,
          coe: project.coe,
          isProject: true
        });
      }
    });

    return Array.from(teamMap.values());
  };

  const unifiedTeams = getUnifiedTeams();

  return (
    <div>
      <div className="card" style={{ padding: '24px', maxWidth: '100%' }}>
        <form onSubmit={handleSearch} style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#2d3748' }}>
                Search by Guide or Problem
              </label>
              <input
                type="text"
                value={guideName}
                onChange={(e) => setGuideName(e.target.value)}
                placeholder="e.g., Mrs. Nanda Devi. D.R or Machine Learning"
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
              <h3 style={{ color: '#2d3748', marginBottom: '12px' }}>👨‍🏫 Guide: {results.guide.name}</h3>
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
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>COE/Domain</th>
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
                              {team.leaderStudent && student._id === team.leaderStudent._id && (
                                <span style={{
                                  marginLeft: '8px',
                                  padding: '2px 8px',
                                  background: '#667eea',
                                  color: 'white',
                                  borderRadius: '4px',
                                  fontSize: '10px',
                                  fontWeight: '600'
                                }}>
                                  LEADER
                                </span>
                              )}
                            </td>
                            {studentIdx === 0 ? (
                              <>
                                <td rowSpan={team.students.length} style={{ padding: '12px', fontSize: '13px', color: '#4a5568', verticalAlign: 'top' }}>
                                  {team.guideName}
                                </td>
                                <td rowSpan={team.students.length} style={{ padding: '12px', fontSize: '13px', color: '#4a5568', verticalAlign: 'top' }}>
                                  {team.projectTitle}
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
