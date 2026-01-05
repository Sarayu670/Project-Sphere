import { useState, useEffect } from 'react';
import * as api from '../../services/api';
import BatchDetails from './BatchDetails';
import GuideTimeline from './GuideTimeline';
import ExcelImportProblem from './ExcelImportProblem';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import './GuideDashboard.css';

function GuideDashboard() {
  const [activeTab, setActiveTab] = useState('problems');
  const [problems, setProblems] = useState([]);
  const [coes, setCoes] = useState([]);
  const [batches, setBatches] = useState([]);
  const [optedTeams, setOptedTeams] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [showAddProblem, setShowAddProblem] = useState(false);
  const [showImportExcel, setShowImportExcel] = useState(false);
  const [newProblem, setNewProblem] = useState({ title: '', description: '', coeId: '', targetYear: '', datasetUrl: '' });
  const [dialog, setDialog] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: null, confirmText: 'OK', cancelText: 'Cancel' });

  const TARGET_YEARS = ['2nd', '3rd', '4th'];
  
  const YEAR_LABELS = {
    '2nd': '2nd - Real Time Project',
    '3rd': '3rd - Mini Project',
    '4th': '4th - Major Project'
  };

  const fetchData = async () => {
    try {
      const [problemsRes, coesRes, batchesRes, optedRes, submissionsRes] = await Promise.all([
        api.getMyProblems(),
        api.getAllCOEs(),
        api.getMyBatches(),
        api.getOptedTeams(),
        api.getGuideSubmissions()
      ]);
      setProblems(problemsRes.data.data);
      setCoes(coesRes.data.data);
      setBatches(batchesRes.data.data);
      setOptedTeams(optedRes.data.data);
      setSubmissions(submissionsRes.data.data);
    } catch (error) {
      console.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAddProblem = async (e) => {
    e.preventDefault();
    try {
      await api.createProblem(newProblem);
      setNewProblem({ title: '', description: '', coeId: '', targetYear: '', datasetUrl: '' });
      setShowAddProblem(false);
      fetchData();
    } catch (error) {
      showDialog('Error', error.response?.data?.message || 'Failed to add problem', 'danger');
    }
  };

  const handleDeleteProblem = async (id) => {
    showDialog('Delete Problem', 'Are you sure you want to delete this problem statement?', 'danger', async () => {
      try {
        await api.deleteProblem(id);
        fetchData();
      } catch (error) {
        showDialog('Error', 'Failed to delete', 'danger');
      }
    });
  };

  const handleAllot = async (batchId, problemId) => {
    try {
      await api.allotProblem(batchId, problemId);
      showDialog('Success', 'Team allotted successfully!', 'success', () => {
        fetchData();
      });
    } catch (error) {
      showDialog('Error', error.response?.data?.message || 'Failed to allot', 'danger');
    }
  };

  const handleReject = async (batchId, problemId) => {
    showDialog('Reject Request', 'Are you sure you want to reject this request?', 'warning', async () => {
      try {
        await api.rejectProblem(batchId, problemId);
        showDialog('Success', 'Request rejected successfully!', 'success', () => {
          fetchData();
        });
      } catch (error) {
        showDialog('Error', error.response?.data?.message || 'Failed to reject', 'danger');
      }
    });
  };

  const getAcceptedSubmissionsCount = (batchId) => {
    return submissions.filter(s => s.batchId._id === batchId && s.status === 'accepted').length;
  };

  const showDialog = (title, message, type = 'info', onConfirm = null) => {
    setDialog({
      isOpen: true,
      title,
      message,
      type,
      onConfirm: () => {
        if (onConfirm) onConfirm();
        setDialog({ ...dialog, isOpen: false });
      },
      confirmText: onConfirm ? (type === 'danger' ? 'Delete' : 'Yes') : 'OK',
      cancelText: onConfirm ? 'Cancel' : 'OK'
    });
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (selectedBatch) return <BatchDetails batchId={selectedBatch} onBack={() => { setSelectedBatch(null); fetchData(); }} />;

  return (
    <div className="guide-dashboard">
      <div className="dashboard-header">
        <h1>👨‍🏫 Guide Dashboard</h1>
        <p>Manage your problem statements and teams</p>
      </div>

      <div className="stats-row">
        <div className="stat-card"><div className="stat-icon">📋</div><div className="stat-value">{problems.length}</div><div className="stat-label">My Problems</div></div>
        <div className="stat-card"><div className="stat-icon">⏳</div><div className="stat-value">{optedTeams.length}</div><div className="stat-label">Pending Requests</div></div>
        <div className="stat-card"><div className="stat-icon">👥</div><div className="stat-value">{batches.length}</div><div className="stat-label">Allotted Teams</div></div>
        <div className="stat-card"><div className="stat-icon">✅</div><div className="stat-value">{batches.filter(b => b.status === 'Completed').length}</div><div className="stat-label">Completed</div></div>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'problems' ? 'active' : ''}`} onClick={() => setActiveTab('problems')}>📋 My Problem Statements</button>
        <button className={`tab ${activeTab === 'requests' ? 'active' : ''}`} onClick={() => setActiveTab('requests')}>⏳ Pending Requests ({optedTeams.length})</button>
        <button className={`tab ${activeTab === 'teams' ? 'active' : ''}`} onClick={() => setActiveTab('teams')}>👥 My Teams</button>
        <button className={`tab ${activeTab === 'submissions' ? 'active' : ''}`} onClick={() => setActiveTab('submissions')}>� Timeline</button>

      </div>

      {activeTab === 'problems' && (
        <div className="tab-content">
          <div className="section-header">
            <h2>📋 My Problem Statements</h2>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-primary" onClick={() => { setShowAddProblem(true); setShowImportExcel(false); }}>+ Add Problem</button>
              <button className="btn btn-secondary" onClick={() => { setShowImportExcel(true); setShowAddProblem(false); }} style={{ backgroundColor: '#17a2b8' }}>📊 Import from Excel</button>
            </div>
          </div>
          {showImportExcel && (
            <ExcelImportProblem
              coes={coes}
              targetYears={TARGET_YEARS}
              onImportComplete={() => {
                setShowImportExcel(false);
                fetchData();
              }}
              onCancel={() => setShowImportExcel(false)}
            />
          )}
          {showAddProblem && (
            <div className="card" style={{ marginBottom: '20px' }}>
              <form onSubmit={handleAddProblem}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="form-group"><label>COE</label>
                    <select value={newProblem.coeId} onChange={(e) => setNewProblem({...newProblem, coeId: e.target.value})} required>
                      <option value="">Select COE</option>
                      {coes.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Target Year</label>
                    <select value={newProblem.targetYear} onChange={(e) => setNewProblem({...newProblem, targetYear: e.target.value})} required>
                      <option value="">Select Year</option>
                      {TARGET_YEARS.map(y => <option key={y} value={y}>{YEAR_LABELS[y]}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group"><label>Title</label><input type="text" value={newProblem.title} onChange={(e) => setNewProblem({...newProblem, title: e.target.value})} required /></div>
                <div className="form-group"><label>Description</label><textarea value={newProblem.description} onChange={(e) => setNewProblem({...newProblem, description: e.target.value})} rows={3} /></div>
                <div className="form-group"><label>Dataset URL (optional)</label><input type="url" value={newProblem.datasetUrl} onChange={(e) => setNewProblem({...newProblem, datasetUrl: e.target.value})} /></div>
                <div style={{ display: 'flex', gap: '10px' }}><button type="submit" className="btn btn-primary">Save</button><button type="button" className="btn btn-secondary" onClick={() => setShowAddProblem(false)}>Cancel</button></div>
                <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f0f4ff', borderRadius: '4px', fontSize: '12px', color: '#666' }}>
                  💡 Tip: You can also import multiple problems at once using the "Import from Excel" button
                </div>
              </form>
            </div>
          )}
          {problems.length === 0 ? <div className="card empty-state"><h3>No Problem Statements Yet</h3><p>Add your first problem statement to get started</p></div> : (
            <div className="grid grid-2">
              {problems.map(p => (
                <div key={p._id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div><h3>{p.title}</h3><span className="badge badge-info">{p.coeId?.name}</span> <span className="badge badge-warning">{p.targetYear} Year</span></div>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDeleteProblem(p._id)}>🗑️</button>
                  </div>
                  <p style={{ color: '#666', margin: '10px 0' }}>{p.description}</p>
                  <div style={{ fontSize: '14px', color: '#888' }}>Teams: {p.selectedBatchCount}/{p.maxBatches}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="tab-content">
          <h2>⏳ Pending Team Requests</h2>
          {optedTeams.length === 0 ? <div className="card empty-state"><h3>No Pending Requests</h3><p>Teams that opt for your problems will appear here</p></div> : (
            <div className="grid grid-2">
              {optedTeams.map((t, idx) => (
                <div key={`${t._id}-${t.optedProblemId?._id || idx}`} className="card">
                  <div className="batch-icon">👥</div>
                  <h3>{t.teamName}</h3>
                  <p style={{ color: '#667eea', fontWeight: '500', marginBottom: '10px' }}>
                    <strong>Year:</strong> {YEAR_LABELS[t.year] || t.year} • {t.branch}
                  </p>
                  <p><strong>Leader:</strong> {t.leaderStudentId?.name}</p>
                  <p><strong>Opted Problem:</strong> {t.optedProblemId?.title}</p>
                  <p><strong>COE:</strong> {t.coeId?.name}</p>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                    <button className="btn btn-primary" onClick={() => handleAllot(t._id, t.optedProblemId?._id)}>✅ Allot</button>
                    <button className="btn btn-danger" onClick={() => handleReject(t._id, t.optedProblemId?._id)}>❌ Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'teams' && (
        <div className="tab-content">
          <h2>👥 My Allotted Teams</h2>
          {batches.length === 0 ? <div className="card empty-state"><h3>No Teams Allotted Yet</h3><p>Allot teams from pending requests</p></div> : (
            <div className="grid grid-3">
              {batches.map(b => (
                <div key={b._id} className="batch-card" onClick={() => setSelectedBatch(b._id)}>
                  <div className="batch-status"><span className={`badge badge-${b.status === 'Completed' ? 'success' : b.status === 'In Progress' ? 'warning' : 'info'}`}>{b.status}</span></div>
                  <div className="batch-icon">👥</div>
                  <h3>{b.teamName}</h3>
                  <p style={{ fontSize: '12px', color: '#718096', marginBottom: '8px' }}><strong>Year:</strong> {b.year}</p>
                  <p className="batch-leader">Leader: {b.leaderStudentId?.name}</p>
                  <p className="batch-problem">📋 {b.problemId?.title}</p>
                  <p className="batch-submissions">✅ Accepted Submissions: {getAcceptedSubmissionsCount(b._id)}</p>
                  <div className="batch-action">View Details →</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'submissions' && <GuideTimeline />}
      
      <ConfirmationDialog
        isOpen={dialog.isOpen}
        title={dialog.title}
        message={dialog.message}
        type={dialog.type}
        onConfirm={dialog.onConfirm}
        onCancel={() => setDialog({ ...dialog, isOpen: false })}
        confirmText={dialog.confirmText}
        cancelText={dialog.cancelText}
      />
    </div>
  );
}

export default GuideDashboard;

