import { useState, useEffect, useCallback } from 'react';
import * as XLSX from 'xlsx';
import * as api from '../../services/api';
import COEandRCManagement from '../../components/COEandRCManagement';
import TimelineManagement from './TimelineManagement';
import usePolling from '../../utils/usePolling';
import GuideSearch from './GuideSearch';
import AdminAIManagement from '../../components/AdminAIManagement';
import './AdminDashboard.css';


const YEARS = ['2nd', '3rd', '4th'];
const BRANCHES = ['CSE', 'IT', 'ECE', 'CSM', 'EEE', 'CSD', 'ETM'];
const SECTIONS = ['A', 'B', 'C', 'D', 'E'];

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [coes, setCoes] = useState([]);
  const [rcs, setRcs] = useState([]);
  const [guides, setGuides] = useState([]);
  const [coordinators, setCoordinators] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [activeTab, setActiveTab] = useState(
    () => sessionStorage.getItem('adminActiveTab') || 'timeline'
  );

  // Filters
  const [filterYear, setFilterYear] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterSection, setFilterSection] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, coesRes, rcsRes, guidesRes, coordinatorsRes, batchesRes] = await Promise.all([
        api.getAdminDashboard(),
        api.getAllCOEs(),
        api.getAllRCs(),
        api.getAllGuides(),
        api.getAllCoordinators(),
        api.getAllBatches()
      ]);
      setStats(statsRes.data.data);
      setCoes(coesRes.data.data);
      setRcs(rcsRes.data.data);
      setGuides(guidesRes.data.data);
      setCoordinators(coordinatorsRes.data.data || []);
      setBatches(batchesRes.data.data);
    } catch (error) {
      console.error('AdminDashboard: Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Silently poll every 25s — new teams and submissions appear automatically
  usePolling(fetchData, 25000);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    sessionStorage.setItem('adminActiveTab', tab);
  };

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
    setIsEditingAssignments(false);
    // Scroll to top of the page to show the batch details
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const [isEditingAssignments, setIsEditingAssignments] = useState(false);
  const [coordinatorFile, setCoordinatorFile] = useState(null);
  const [coordinatorStatus, setCoordinatorStatus] = useState('');
  const [coordinatorError, setCoordinatorError] = useState('');
  const [coordinatorLoading, setCoordinatorLoading] = useState(false);
  const [editForm, setEditForm] = useState({
    coeId: '',
    rcId: '',
    guideId: '',
    researchArea: '',
    thrustArea: '',
    outcome: 'None',
    problemTitle: ''
  });

  const handleEditClick = () => {
    setEditForm({
      coeId: selectedBatch.coeId?._id || selectedBatch.problemId?.coeId?._id || selectedBatch.coeId || '',
      rcId: selectedBatch.rcId?._id || selectedBatch.rc?.rcId || '',
      guideId: selectedBatch.guideId?._id || selectedBatch.guideId || '',
      researchArea: selectedBatch.problemId?.researchArea || selectedBatch.researchArea || '',
      thrustArea: selectedBatch.thrustArea || selectedBatch.domain || '',
      outcome: selectedBatch.outcome || 'None',
      problemTitle: selectedBatch.problemId?.title || ''
    });
    setIsEditingAssignments(true);
  };

  const handleSaveAssignments = async () => {
    try {
      const res = await api.updateBatchByAdmin(selectedBatch._id, editForm);
      setIsEditingAssignments(false);
      
      const newBatchData = res.data.data;
      setSelectedBatch(newBatchData);
      setBatches(batches.map(b => b._id === newBatchData._id ? newBatchData : b));
    } catch (error) {
      console.error('Failed to update assignments:', error);
      alert('Failed to update assignments');
    }
  };

  const handleDownloadCoordinatorTemplate = () => {
    const rows = [
      { name: 'John Doe', branch: 'CSE', section: 'A', year: '3rd', email: 'john.doe@gmail.com' },
      { name: 'Jane Smith', branch: 'IT', section: 'B', year: '2nd', email: 'jane.smith@gmail.com' }
    ];

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Coordinators');
    XLSX.writeFile(wb, 'Coordinator_Import_Template.xlsx');
  };

  const handleDeleteCoordinator = async (coordinatorId) => {
    if (!window.confirm('Delete this coordinator from the database and remove their coordinator access?')) {
      return;
    }

    try {
      setCoordinatorError('');
      const response = await api.deleteCoordinator(coordinatorId);
      setCoordinatorStatus(response.data.message || 'Coordinator deleted successfully.');
      setCoordinators(prev => prev.filter(coord => coord._id !== coordinatorId));
    } catch (error) {
      setCoordinatorError(error.response?.data?.message || 'Failed to delete coordinator.');
      setCoordinatorStatus('');
    }
  };

  const handleCoordinatorImport = async () => {
    if (!coordinatorFile) {
      setCoordinatorError('Please select a coordinator file first.');
      return;
    }

    setCoordinatorLoading(true);
    setCoordinatorError('');
    setCoordinatorStatus('Importing coordinators...');

    try {
      const response = await api.importCoordinators(coordinatorFile);
      const importResult = response.data.data;
      let statusMessage = response.data.message || 'Coordinator import completed.';
      if (importResult?.errors?.length > 0) {
        const errorDetails = importResult.errors.map((e, i) => `Row ${i + 1}: ${e.error}`).join(' | ');
        statusMessage += ` Details: ${errorDetails}`;
      }
      setCoordinatorStatus(statusMessage);
      const updatedCoordinators = await api.getAllCoordinators();
      setCoordinators(updatedCoordinators.data.data || []);
      setCoordinatorFile(null);
      document.getElementById('coordinator-file-input').value = '';
    } catch (error) {
      setCoordinatorError(error.response?.data?.message || 'Failed to import coordinators.');
      setCoordinatorStatus('');
    } finally {
      setCoordinatorLoading(false);
    }
  };

  const handleDownloadReport = () => {
    const reportData = filteredBatches.map((batch, index) => {
      const membersList = batch.teamMembers && batch.teamMembers.length > 0
        ? batch.teamMembers.map(m => `${m.name || ''} (${m.rollNo || ''})`).join(', ')
        : (batch.leaderStudentId ? `${batch.leaderStudentId.name} (${batch.leaderStudentId.rollNumber})` : 'N/A');

      return {
        'S.No': index + 1,
        'Team Name': batch.teamName || '',
        'Leader Roll No': batch.leaderStudentId?.rollNumber || (batch.teamMembers?.[0]?.rollNo || ''),
        'Leader Name': batch.leaderStudentId?.name || (batch.teamMembers?.[0]?.name || ''),
        'Team Members': membersList,
        'Year': batch.year || '',
        'Branch': batch.branch || '',
        'Section': batch.section || '',
        'COE / RC': batch.problemId?.coeId?.name || batch.coeId?.name || batch.coe?.name || 'Not Assigned',
        'Domain': batch.domain || 'Not Assigned',
        'Thrust Area': batch.thrustArea || batch.domain || 'Not Assigned',
        'Guide': batch.guideId?.name || 'Not Assigned',
        'Problem Title': batch.problemId?.title || 'Not Assigned',
        'Outcome': batch.outcome || 'None',
        'Allotment Status': batch.allotmentStatus || 'none',
        'Progress Status': batch.status || 'Not Started'
      };
    });

    const ws = XLSX.utils.json_to_sheet(reportData);
    ws['!cols'] = [
      { wch: 6 },  // S.No
      { wch: 12 }, // Team Name
      { wch: 16 }, // Leader Roll No
      { wch: 22 }, // Leader Name
      { wch: 35 }, // Team Members
      { wch: 8 },  // Year
      { wch: 10 }, // Branch
      { wch: 10 }, // Section
      { wch: 22 }, // COE/RC
      { wch: 20 }, // Domain
      { wch: 25 }, // Thrust Area
      { wch: 20 }, // Guide
      { wch: 35 }, // Problem Title
      { wch: 15 }, // Outcome
      { wch: 18 }, // Allotment Status
      { wch: 18 }  // Progress Status
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Teams Report');
    
    const yearStr = filterYear ? `${filterYear}_Year` : 'All_Years';
    const branchStr = filterBranch ? filterBranch : 'All_Branches';
    const secStr = filterSection ? `Sec_${filterSection}` : 'All_Sections';
    
    XLSX.writeFile(wb, `Project_Sphere_Report_${yearStr}_${branchStr}_${secStr}.xlsx`);
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterYear, filterBranch, filterSection]);

  if (loading && !stats) return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '15px', marginBottom: '20px' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="stat-card" style={{ opacity: 0.4 }}>
            <div style={{ height: '40px', background: '#e2e8f0', borderRadius: '8px', marginBottom: '8px' }} />
            <div style={{ height: '14px', background: '#e2e8f0', borderRadius: '4px', width: '60%', margin: '0 auto' }} />
          </div>
        ))}
      </div>
    </div>
  );

  console.log('AdminDashboard: Rendering with activeTab:', activeTab);

  const filteredBatches = getFilteredBatches();

  // Pagination logic
  const totalPages = Math.ceil(filteredBatches.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedBatches = filteredBatches.slice(startIndex, endIndex);

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>👑 Admin Dashboard</h1>
        <p>Monitor all years, branches, sections, COEs, teams, and progress</p>
      </div>

      <div className="stats-row">
        <div className="stat-card"><div className="stat-icon">🏛️</div><div className="stat-value">{stats?.totalCOEs || 0}</div><div className="stat-label">COEs</div></div>
        <div className="stat-card"><div className="stat-icon">📋</div><div className="stat-value">{stats?.totalProblems || 0}</div><div className="stat-label">Problems</div></div>
        <div className="stat-card"><div className="stat-icon">👨‍🏫</div><div className="stat-value">{stats?.totalGuides || 0}</div><div className="stat-label">Guides</div></div>
        <div className="stat-card"><div className="stat-icon">👥</div><div className="stat-value">{stats?.totalBatches || 0}</div><div className="stat-label">Teams</div></div>
        <div className="stat-card"><div className="stat-icon">✅</div><div className="stat-value">{batches.filter(b => b.status === 'Completed').length}</div><div className="stat-label">Completed</div></div>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'timeline' ? 'active' : ''}`} onClick={() => handleTabChange('timeline')}>📅 Timeline</button>
        <button className={`tab ${activeTab === 'filter' ? 'active' : ''}`} onClick={() => { handleTabChange('filter'); setSelectedBatch(null); }}>🔍 Filter by Class</button>
        <button className={`tab ${activeTab === 'guide-search' ? 'active' : ''}`} onClick={() => handleTabChange('guide-search')}>👨‍🏫 Search Batches</button>
        <button className={`tab ${activeTab === 'manage-coe-rc' ? 'active' : ''}`} onClick={() => handleTabChange('manage-coe-rc')}>🏛️ Manage COE/RC</button>
        <button className={`tab ${activeTab === 'import-coordinators' ? 'active' : ''}`} onClick={() => handleTabChange('import-coordinators')}>👥 Import Coordinators</button>
        <button className={`tab ${activeTab === 'ai-agent' ? 'active' : ''}`} onClick={() => handleTabChange('ai-agent')}>🤖 AI Agent</button>
      </div>

      {activeTab === 'timeline' && <TimelineManagement />}

      {activeTab === 'import-coordinators' && (
        <div className="tab-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0 }}>Import Coordinators</h2>
              <p style={{ margin: '6px 0 0', color: '#64748b' }}>Existing coordinator accounts are listed below.</p>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" onClick={handleDownloadCoordinatorTemplate}>📥 Download Template</button>
              <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
                <input id="coordinator-file-input" type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setCoordinatorFile(e.target.files[0] || null)} style={{ display: 'none' }} />
                Choose File
              </label>
              <button type="button" className="btn btn-primary" onClick={handleCoordinatorImport} disabled={!coordinatorFile || coordinatorLoading}>
                {coordinatorLoading ? 'Importing...' : 'Import Coordinators'}
              </button>
            </div>
          </div>

          {coordinatorError && (
            <div style={{ padding: '12px 14px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '8px', marginBottom: '16px' }}>
              {coordinatorError}
            </div>
          )}

          {coordinatorStatus && (
            <div style={{ padding: '12px 14px', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', borderRadius: '8px', marginBottom: '16px' }}>
              {coordinatorStatus}
            </div>
          )}

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Branch</th>
                  <th>Section</th>
                  <th>Year</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {coordinators.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', color: '#64748b', padding: '18px' }}>No coordinators imported yet.</td>
                  </tr>
                ) : (
                  coordinators.map((coordinator) => (
                    <tr key={coordinator._id} className="coordinator-row">
                      <td>{coordinator.name}</td>
                      <td>{coordinator.branch || '—'}</td>
                      <td>{coordinator.section || '—'}</td>
                      <td>{coordinator.year || '—'}</td>
                      <td>{coordinator.email}</td>
                      <td className="coordinator-action-cell">
                        <button type="button" className="coordinator-delete-btn" onClick={() => handleDeleteCoordinator(coordinator._id)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {activeTab === 'ai-agent' && (
        <div className="tab-content">
          <AdminAIManagement />
        </div>
      )}

      {activeTab === 'guide-search' && (
        <div className="tab-content">
          <GuideSearch />
        </div>
      )}

      {activeTab === 'filter' && !selectedBatch && (
        <div className="tab-content">
          <h2>🔍 Filter Teams by Year, Branch & Section</h2>

          <div className="card" style={{ marginBottom: '20px', maxWidth: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr) auto', gap: '20px', alignItems: 'end' }}>
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
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-secondary" onClick={() => { setFilterYear(''); setFilterBranch(''); setFilterSection(''); }}>
                  Clear Filters
                </button>
                <button className="btn btn-primary" style={{ backgroundColor: '#28a745', borderColor: '#28a745' }} onClick={handleDownloadReport}>
                  📥 Download Report
                </button>
              </div>
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
                    <th>COE/RC</th>
                    <th>Domain</th>
                    <th>Thrust Area</th>
                    <th>Guide</th>
                    <th>Problem</th>
                    <th>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBatches.map((batch) => (
                    <tr key={batch._id}>
                      <td>
                        <button
                          onClick={() => handleSelectBatch(batch)}
                          title="Click to view & edit team details"
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            margin: 0,
                            color: '#2b6cb0',
                            fontWeight: 'bold',
                            fontSize: '14px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            textAlign: 'left'
                          }}
                        >
                          <span>{batch.teamName}</span>
                          <span style={{ fontSize: '12px', opacity: 0.7 }} title="Edit Team">✏️</span>
                        </button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {batch.teamMembers && batch.teamMembers.map((member, idx) => (
                            <div key={idx} style={{ fontSize: '12px', color: '#4a5568' }}>
                              • {member.rollNo || member.name}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td>{batch.problemId?.coeId?.name || batch.coeId?.name || batch.coe?.name || 'Not Assigned'}</td>
                      <td>{batch.domain || 'Not Assigned'}</td>
                      <td>{batch.thrustArea || batch.domain || 'Not Assigned'}</td>
                      <td>{batch.guideId?.name || 'Not Assigned'}</td>
                      <td>{batch.problemId?.title || 'Not Assigned'}</td>
                      <td>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '600',
                          backgroundColor: batch.outcome && batch.outcome !== 'None' ? '#e6fffa' : '#edf2f7',
                          color: batch.outcome && batch.outcome !== 'None' ? '#234e52' : '#718096',
                          border: batch.outcome && batch.outcome !== 'None' ? '1px solid #b2f5ea' : '1px solid #e2e8f0'
                        }}>
                          {batch.outcome || 'None'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination Controls */}
              {filteredBatches.length > itemsPerPage && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '10px',
                  marginTop: '20px',
                  padding: '15px'
                }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    style={{ opacity: currentPage === 1 ? 0.5 : 1 }}
                  >
                    ← Previous
                  </button>

                  <div style={{ display: 'flex', gap: '5px' }}>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        className={`btn btn-sm ${page === currentPage ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setCurrentPage(page)}
                        style={{
                          minWidth: '40px',
                          fontWeight: page === currentPage ? 'bold' : 'normal'
                        }}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    style={{ opacity: currentPage === totalPages ? 0.5 : 1 }}
                  >
                    Next →
                  </button>

                  <span style={{ marginLeft: '15px', color: '#666', fontSize: '14px' }}>
                    Showing {startIndex + 1}-{Math.min(endIndex, filteredBatches.length)} of {filteredBatches.length}
                  </span>
                </div>
              )}
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
              <div style={{ position: 'relative' }}>
                {!isEditingAssignments ? (
                  <>
                    <button 
                      className="btn btn-primary btn-sm" 
                      onClick={handleEditClick}
                      style={{ position: 'absolute', top: 0, right: 0 }}
                    >
                      ✎ Edit
                    </button>
                    <p><strong>COE/RC:</strong> {selectedBatch.problemId?.coeId?.name || selectedBatch.coeId?.name || selectedBatch.coe?.name || 'Not Assigned'}</p>
                    <p><strong>Domain:</strong> {selectedBatch.domain || 'Not Assigned'}</p>
                    <p><strong>Thrust Area:</strong> {selectedBatch.thrustArea || selectedBatch.domain || 'Not Assigned'}</p>
                    <p><strong>Outcome:</strong> {selectedBatch.outcome || 'None'}</p>
                    <p><strong>Guide:</strong> {selectedBatch.guideId?.name || 'Not Assigned'}</p>
                    <p><strong>Problem:</strong> {selectedBatch.problemId?.title || 'Not Assigned'}</p>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '12px', fontWeight: 'bold' }}>COE/RC</label>
                      <select 
                        value={editForm.coeId} 
                        onChange={(e) => setEditForm({...editForm, coeId: e.target.value})}
                        style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e0' }}
                      >
                        <option value="">-- Select COE/RC --</option>
                        {coes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Guide</label>
                      <select 
                        value={editForm.guideId} 
                        onChange={(e) => setEditForm({...editForm, guideId: e.target.value})}
                        style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e0' }}
                      >
                        <option value="">-- Select Guide --</option>
                        {guides.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Research Area</label>
                      <input 
                        type="text" 
                        value={editForm.researchArea} 
                        onChange={(e) => setEditForm({...editForm, researchArea: e.target.value})}
                        placeholder="Research Area"
                        style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e0' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Thrust Area</label>
                      <input 
                        type="text" 
                        value={editForm.thrustArea} 
                        onChange={(e) => setEditForm({...editForm, thrustArea: e.target.value})}
                        placeholder="Thrust Area (e.g. AI/ML, Cloud)"
                        style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e0' }}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Outcome</label>
                      <select 
                        value={editForm.outcome} 
                        onChange={(e) => setEditForm({...editForm, outcome: e.target.value})}
                        style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e0' }}
                      >
                        <option value="None">None</option>
                        <option value="Patented">Patented</option>
                        <option value="Published">Published</option>
                        <option value="Copyrighted">Copyrighted</option>
                        <option value="Paper Published">Paper Published</option>
                        <option value="Journal Published">Journal Published</option>
                        <option value="Conference Published">Conference Published</option>
                        <option value="Prototype">Prototype</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Problem Statement Title</label>
                      <textarea 
                        value={editForm.problemTitle} 
                        onChange={(e) => setEditForm({...editForm, problemTitle: e.target.value})}
                        placeholder="Problem Statement Title"
                        style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e0', minHeight: '60px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                      <button className="btn btn-primary btn-sm" onClick={handleSaveAssignments}>Save</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setIsEditingAssignments(false)}>Cancel</button>
                    </div>
                  </div>
                )}
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

      {activeTab === 'manage' && <COEManagement onUpdate={fetchData} />}

      {activeTab === 'manage-coe-rc' && (
        <div className="tab-content">
          <COEandRCManagement />
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;

