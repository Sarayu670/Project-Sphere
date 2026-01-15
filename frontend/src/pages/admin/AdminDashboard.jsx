import { useState, useEffect } from 'react';
import * as api from '../../services/api';
import COEManagement from './COEManagement';
import TimelineManagement from './TimelineManagement';
import BatchImport from './BatchImport';

import ImportProjectData from './ImportProjectData';
import GuideSearch from './GuideSearch';
import './AdminDashboard.css';

const YEARS = ['2nd', '3rd', '4th'];
const BRANCHES = ['CSE', 'IT', 'ECE', 'CSM', 'EEE', 'CSD', 'ETM'];
const SECTIONS = ['A', 'B', 'C', 'D', 'E'];

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [coes, setCoes] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCOE, setSelectedCOE] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [activeTab, setActiveTab] = useState('timeline');

  // Filters
  const [filterYear, setFilterYear] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterSection, setFilterSection] = useState('');

  const fetchData = async () => {
    try {
      console.log('AdminDashboard: Fetching data...');
      const [statsRes, coesRes, batchesRes] = await Promise.all([
        api.getAdminDashboard(),
        api.getAllCOEs(),
        api.getAllBatches()
      ]);
      console.log('AdminDashboard: Stats:', statsRes.data.data);
      console.log('AdminDashboard: COEs:', coesRes.data.data);
      console.log('AdminDashboard: Batches:', batchesRes.data.data);
      setStats(statsRes.data.data);
      setCoes(coesRes.data.data);
      setBatches(batchesRes.data.data);
    } catch (error) {
      console.error('AdminDashboard: Failed to fetch data:', error);
      console.error('AdminDashboard: Error response:', error.response);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const getBatchesForCOE = (coeId) => batches.filter(b => b.coeId?._id === coeId || b.coeId === coeId);
  const getStatusColor = (status) => status === 'Completed' ? 'success' : status === 'In Progress' ? 'warning' : 'info';

  // Filter batches by year, branch, section
  const getFilteredBatches = () => {
    return batches.filter(b => {
      if (filterYear && b.year !== filterYear) return false;
      if (filterBranch && b.branch !== filterBranch) return false;
      if (filterSection && b.section !== filterSection) return false;
      return true;
    });
  };

  const handleSelectBatch = (batch) => {
    setSelectedBatch(batch);
    // Scroll to top of the page to show the batch details
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) return <div className="loading">Loading...</div>;

  console.log('AdminDashboard: Rendering with activeTab:', activeTab);

  const filteredBatches = getFilteredBatches();

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>👑 Admin Dashboard</h1>
        <p>Project Coordinator - Monitor all COEs, teams, and progress</p>
      </div>

      <div className="stats-row">
        <div className="stat-card"><div className="stat-icon">🏛️</div><div className="stat-value">{stats?.totalCOEs || 0}</div><div className="stat-label">COEs</div></div>
        <div className="stat-card"><div className="stat-icon">📋</div><div className="stat-value">{stats?.totalProblems || 0}</div><div className="stat-label">Problems</div></div>
        <div className="stat-card"><div className="stat-icon">👨‍🏫</div><div className="stat-value">{stats?.totalGuides || 0}</div><div className="stat-label">Guides</div></div>
        <div className="stat-card"><div className="stat-icon">👥</div><div className="stat-value">{stats?.totalBatches || 0}</div><div className="stat-label">Teams</div></div>
        <div className="stat-card"><div className="stat-icon">✅</div><div className="stat-value">{batches.filter(b => b.status === 'Completed').length}</div><div className="stat-label">Completed</div></div>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'timeline' ? 'active' : ''}`} onClick={() => setActiveTab('timeline')}>📅 Timeline</button>
        <button className={`tab ${activeTab === 'filter' ? 'active' : ''}`} onClick={() => { setActiveTab('filter'); setSelectedBatch(null); }}>🔍 Filter by Class</button>
        <button className={`tab ${activeTab === 'guide-search' ? 'active' : ''}`} onClick={() => setActiveTab('guide-search')}>👨‍🏫 Search Guide Batches</button>
        <button className={`tab ${activeTab === 'import' ? 'active' : ''}`} onClick={() => setActiveTab('import')}>📤 Batch Import</button>

        <button className={`tab ${activeTab === 'project-import' ? 'active' : ''}`} onClick={() => setActiveTab('project-import')}>📊 Import Projects</button>
        <button className={`tab ${activeTab === 'coes' ? 'active' : ''}`} onClick={() => { setActiveTab('coes'); setSelectedCOE(null); }}>🏛️ COE Overview</button>
        <button className={`tab ${activeTab === 'manage' ? 'active' : ''}`} onClick={() => setActiveTab('manage')}>⚙️ Manage COEs</button>
      </div>

      {activeTab === 'timeline' && <TimelineManagement />}

      {activeTab === 'import' && (
        <div className="tab-content">
          <BatchImport
            onImportComplete={() => {
              setActiveTab('filter');
              fetchData();
            }}
            onCancel={() => setActiveTab('filter')}
          />
        </div>
      )}

      {activeTab === 'guide-search' && (
        <div className="tab-content">
          <GuideSearch />
        </div>
      )}



      {activeTab === 'project-import' && (
        <div className="tab-content">
          <ImportProjectData />
        </div>
      )}

      {activeTab === 'filter' && !selectedBatch && (
        <div className="tab-content">
          <h2>🔍 Filter Teams by Year, Branch & Section</h2>

          <div className="card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '15px', alignItems: 'end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Year</label>
                <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
                  <option value="">All Years</option>
                  {YEARS.map(y => <option key={y} value={y}>{y} Year</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Branch</label>
                <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
                  <option value="">All Branches</option>
                  {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Section</label>
                <select value={filterSection} onChange={(e) => setFilterSection(e.target.value)}>
                  <option value="">All Sections</option>
                  {SECTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <button className="btn btn-secondary" onClick={() => { setFilterYear(''); setFilterBranch(''); setFilterSection(''); }}>
                Clear Filters
              </button>
            </div>
          </div>

          {(filterYear || filterBranch || filterSection) && (
            <p style={{ color: '#666', marginBottom: '15px' }}>
              Showing: {filterYear || 'All Years'} • {filterBranch || 'All Branches'} • Section {filterSection || 'All'}
              <strong> ({filteredBatches.length} teams)</strong>
            </p>
          )}

          {filteredBatches.length === 0 ? (
            <div className="card empty-state">
              <h3>No Teams Found</h3>
              <p>No teams match the selected filters</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Team Name</th>
                    <th>Team Members</th>
                    <th>Class</th>
                    <th>COE</th>
                    <th>Guide</th>
                    <th>Problem</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBatches.map((batch) => (
                    <tr key={batch._id}>
                      <td><strong>{batch.teamName}</strong></td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {batch.teamMembers && batch.teamMembers.map((member, idx) => (
                            <div key={idx} style={{ fontSize: '12px', color: '#4a5568' }}>
                              • {member.rollNo || member.name}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td>{batch.year} {batch.branch}-{batch.section}</td>
                      <td>{batch.coeId?.name || 'Not Assigned'}</td>
                      <td>{batch.guideId?.name || 'Not Assigned'}</td>
                      <td>{batch.problemId?.title || 'Not Assigned'}</td>
                      <td>
                        <button className="btn btn-primary btn-sm" onClick={() => handleSelectBatch(batch)}>View Details</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'filter' && selectedBatch && (
        <div className="tab-content">
          <button className="btn btn-secondary" onClick={() => setSelectedBatch(null)} style={{ marginBottom: '20px' }}>← Back to List</button>

          <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid #667eea' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
              <div>
                <h3>{selectedBatch.teamName}</h3>
                <p><strong>Year:</strong> {selectedBatch.year}</p>
                <p><strong>Branch:</strong> {selectedBatch.branch}</p>
                <p><strong>Section:</strong> {selectedBatch.section}</p>
              </div>
              <div>
                <p><strong>COE:</strong> {selectedBatch.coeId?.name || 'Not Assigned'}</p>
                <p><strong>Guide:</strong> {selectedBatch.guideId?.name || 'Not Assigned'}</p>
                <p><strong>Problem:</strong> {selectedBatch.problemId?.title || 'Not Assigned'}</p>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>👥 Team Members</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {selectedBatch.leaderStudentId && (
                <div style={{
                  padding: '12px',
                  background: '#f7fafc',
                  borderRadius: '6px',
                  borderLeft: '4px solid #cbd5e0',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: '500', color: '#2d3748', marginBottom: '4px' }}>
                      👤 {selectedBatch.leaderStudentId.name} <span style={{ fontSize: '12px', color: '#667eea' }}>(leader)</span>
                    </div>
                    <div style={{ fontSize: '14px', color: '#2d3748' }}>
                      {selectedBatch.leaderStudentId.rollNumber}
                    </div>
                    <div style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>
                      {selectedBatch.year} {selectedBatch.branch}-{selectedBatch.section}
                    </div>
                  </div>
                </div>
              )}
              {selectedBatch.teamMembers && selectedBatch.teamMembers.length > 0 ? (
                selectedBatch.teamMembers.filter(m => m.rollNo !== selectedBatch.leaderStudentId?.rollNumber && m._id !== selectedBatch.leaderStudentId?._id).map((member, idx) => (
                  <div key={idx} style={{
                    padding: '12px',
                    background: '#f7fafc',
                    borderRadius: '6px',
                    borderLeft: '4px solid #cbd5e0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: '500', color: '#2d3748', marginBottom: '4px' }}>
                        👤 {member.name}
                      </div>
                      <div style={{ fontSize: '14px', color: '#2d3748' }}>
                        {member.rollNo}
                      </div>
                      <div style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>
                        {selectedBatch.year} {selectedBatch.branch}-{selectedBatch.section}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '12px', color: '#718096', fontStyle: 'italic' }}>
                  No other team members
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'coes' && !selectedCOE && (
        <div className="tab-content">
          <h2>🏛️ Centers of Excellence</h2>
          <p style={{ color: '#666', marginBottom: '20px' }}>Click on a COE to view teams and their progress</p>
          <div className="grid grid-3">
            {coes.map(coe => {
              const coeBatches = getBatchesForCOE(coe._id);
              const completed = coeBatches.filter(b => b.status === 'Completed').length;
              const inProgress = coeBatches.filter(b => b.status === 'In Progress').length;
              return (
                <div key={coe._id} className="coe-card" onClick={() => setSelectedCOE(coe)}>
                  <div className="coe-icon">🏛️</div>
                  <h3>{coe.name}</h3>
                  <p style={{ color: '#666', fontSize: '14px' }}>{coe.description || 'No description'}</p>
                  <div className="coe-stats">
                    <div><strong>{coeBatches.length}</strong> Teams</div>
                    <div><strong>{inProgress}</strong> In Progress</div>
                    <div><strong>{completed}</strong> Completed</div>
                  </div>
                  <div className="coe-action">View Teams →</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeTab === 'coes' && selectedCOE && (
        <div className="tab-content">
          <button className="btn btn-secondary" onClick={() => setSelectedCOE(null)} style={{ marginBottom: '20px' }}>← Back to COEs</button>
          <h2>🏛️ {selectedCOE.name}</h2>
          <p style={{ color: '#666', marginBottom: '20px' }}>{selectedCOE.description}</p>

          {getBatchesForCOE(selectedCOE._id).length === 0 ? (
            <div className="card empty-state"><h3>No Teams Yet</h3><p>No teams have been assigned to this COE</p></div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Team Name</th>
                    <th>Class</th>
                    <th>Leader</th>
                    <th>Problem Statement</th>
                    <th>Guide/Mentor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {getBatchesForCOE(selectedCOE._id).map(batch => (
                    <tr key={batch._id}>
                      <td><strong>{batch.teamName}</strong></td>
                      <td>{batch.year} {batch.branch}-{batch.section}</td>
                      <td>{batch.leaderStudentId?.name}<br /><small style={{ color: '#888' }}>{batch.leaderStudentId?.email}</small></td>
                      <td>{batch.problemId?.title || batch.optedProblemId?.title || '-'}</td>
                      <td>{batch.guideId?.name || <span style={{ color: '#f59e0b' }}>Pending</span>}<br /><small style={{ color: '#888' }}>{batch.guideId?.email}</small></td>
                      <td><span className={`badge badge-${getStatusColor(batch.status)}`}>{batch.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'manage' && <COEManagement onUpdate={fetchData} />}
    </div>
  );
}

export default AdminDashboard;

