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

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">🔍 Search Batches by Guide</h2>
        <p style={{ color: '#718096', marginTop: '8px' }}>
          Enter guide name to view all batches, students, and imported projects assigned to them (supports partial matching)
        </p>
      </div>

      <div className="card" style={{ padding: '24px', maxWidth: '100%' }}>
        <form onSubmit={handleSearch} style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500', color: '#2d3748' }}>
                Guide Name
              </label>
              <input
                type="text"
                value={guideName}
                onChange={(e) => setGuideName(e.target.value)}
                placeholder="e.g., Mrs. Nanda Devi. D.R"
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginTop: '12px' }}>
                <div style={{ padding: '12px', background: 'white', borderRadius: '6px', border: '1px solid #cbd5e0' }}>
                  <p style={{ fontSize: '12px', color: '#718096', marginBottom: '4px' }}>Total Batches</p>
                  <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#667eea' }}>{results.totalBatches}</p>
                </div>
                <div style={{ padding: '12px', background: 'white', borderRadius: '6px', border: '1px solid #cbd5e0' }}>
                  <p style={{ fontSize: '12px', color: '#718096', marginBottom: '4px' }}>Total Students</p>
                  <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#667eea' }}>{results.totalStudents}</p>
                </div>
                <div style={{ padding: '12px', background: 'white', borderRadius: '6px', border: '1px solid #cbd5e0' }}>
                  <p style={{ fontSize: '12px', color: '#718096', marginBottom: '4px' }}>Imported Projects</p>
                  <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#667eea' }}>{projects.length}</p>
                </div>
              </div>
            </div>

            {/* Single Unified Table */}
            {(results.batches.length > 0 || projects.length > 0) ? (
              <div>
                <h3 style={{ color: '#2d3748', marginBottom: '16px' }}>
                  📋 All Teams & Projects ({results.totalBatches + projects.length})
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
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: '600', fontSize: '14px' }}>COE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Regular Batches */}
                      {results.batches.map((batch) => {
                        if (batch.students && batch.students.length > 0) {
                          return batch.students.map((student, studentIdx) => (
                            <tr key={`batch-${batch._id}-${student._id || studentIdx}`} style={{
                              borderBottom: '1px solid #e2e8f0',
                              background: studentIdx % 2 === 0 ? '#fafbfc' : 'white'
                            }}>
                              {studentIdx === 0 ? (
                                <td rowSpan={batch.students.length} style={{
                                  padding: '12px',
                                  fontWeight: '600',
                                  color: '#2d3748',
                                  borderRight: '2px solid #cbd5e0',
                                  verticalAlign: 'top',
                                  background: '#f0f4ff'
                                }}>
                                  {batch.teamName}
                                  <div style={{ fontSize: '11px', color: '#667eea', marginTop: '4px', fontWeight: '500' }}>
                                    {batch.studentCount} members
                                  </div>
                                </td>
                              ) : null}
                              <td style={{ padding: '12px', fontSize: '13px', color: '#4a5568' }}>
                                {student.rollNumber || 'N/A'}
                              </td>
                              <td style={{ padding: '12px', fontSize: '13px', color: '#2d3748', fontWeight: '500' }}>
                                {student.name}
                                {batch.leaderStudent && student._id === batch.leaderStudent._id && (
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
                                  <td rowSpan={batch.students.length} style={{ padding: '12px', fontSize: '13px', color: '#4a5568', verticalAlign: 'top' }}>
                                    {results.guide.name}
                                  </td>
                                  <td rowSpan={batch.students.length} style={{ padding: '12px', fontSize: '13px', color: '#4a5568', verticalAlign: 'top' }}>
                                    N/A
                                  </td>
                                  <td rowSpan={batch.students.length} style={{
                                    padding: '12px',
                                    fontSize: '13px',
                                    color: 'white',
                                    background: '#667eea',
                                    fontWeight: '600',
                                    verticalAlign: 'top'
                                  }}>
                                    N/A
                                  </td>
                                </>
                              ) : null}
                            </tr>
                          ));
                        }
                        return null;
                      })}

                      {/* Imported Projects */}
                      {projects.map((project) => {
                        if (project.students && project.students.length > 0) {
                          return project.students.map((student, studentIdx) => (
                            <tr key={`project-${project._id}-${studentIdx}`} style={{
                              borderBottom: '1px solid #e2e8f0',
                              background: studentIdx % 2 === 0 ? '#f0fdf4' : 'white'
                            }}>
                              {studentIdx === 0 ? (
                                <td rowSpan={project.students.length} style={{
                                  padding: '12px',
                                  fontWeight: '600',
                                  color: '#2d3748',
                                  borderRight: '2px solid #cbd5e0',
                                  verticalAlign: 'top',
                                  background: '#ecfdf5'
                                }}>
                                  {project.teamName}
                                  <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px', fontWeight: '500' }}>
                                    {project.students.length} members
                                  </div>
                                </td>
                              ) : null}
                              <td style={{ padding: '12px', fontSize: '13px', color: '#4a5568' }}>
                                {project.rollNumbers && project.rollNumbers[studentIdx] ? project.rollNumbers[studentIdx] : 'N/A'}
                              </td>
                              <td style={{ padding: '12px', fontSize: '13px', color: '#2d3748', fontWeight: '500' }}>
                                {student}
                              </td>
                              {studentIdx === 0 ? (
                                <>
                                  <td rowSpan={project.students.length} style={{ padding: '12px', fontSize: '13px', color: '#4a5568', verticalAlign: 'top' }}>
                                    {project.guideName}
                                  </td>
                                  <td rowSpan={project.students.length} style={{ padding: '12px', fontSize: '13px', color: '#4a5568', verticalAlign: 'top' }}>
                                    {project.projectTitle}
                                  </td>
                                  <td rowSpan={project.students.length} style={{
                                    padding: '12px',
                                    fontSize: '13px',
                                    color: 'white',
                                    background: '#10b981',
                                    fontWeight: '600',
                                    verticalAlign: 'top'
                                  }}>
                                    {project.coe}
                                  </td>
                                </>
                              ) : null}
                            </tr>
                          ));
                        }
                        return null;
                      })}
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
