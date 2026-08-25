import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../services/api';
import TimelineManagement from '../admin/TimelineManagement';
import AdminMeetings from '../admin/AdminMeetings';
import BatchImport from '../admin/BatchImport';
import ImportProjectData from '../admin/ImportProjectData';
import usePolling from '../../utils/usePolling';
import './CoordinatorDashboard.css';

const OUTCOMES = ['None', 'Patented', 'Published', 'Copyrighted', 'Prototype', 'Funded', 'Other'];

function idOf(value) {
  return typeof value === 'object' && value ? value._id : value;
}

function CoordinatorDashboard() {
  const { user } = useAuth();
  const scope = user?.coordinatorSection;
  const [activeTab, setActiveTab] = useState(() => {
    const saved = sessionStorage.getItem('coordinatorActiveTab') || 'overview';
    return saved === 'guides' ? 'overview' : saved;
  });
  const [batches, setBatches] = useState([]);
  const [coes, setCoes] = useState([]);
  const [rcs, setRcs] = useState([]);
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({});

  const fetchData = useCallback(async () => {
    try {
      const [batchesRes, coesRes, rcsRes, guidesRes] = await Promise.all([
        api.getSectionBatches(),
        api.getAllCOEs(),
        api.getAllRCs(),
        api.getAllGuides()
      ]);
      setBatches(batchesRes.data.data || []);
      setCoes(coesRes.data.data || []);
      setRcs(rcsRes.data.data || []);
      setGuides(guidesRes.data.data || []);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load the coordinator dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  usePolling(fetchData, 30000);

  const formatMembersForDisplay = useCallback((members = []) => (
    (members || []).map(member => member.rollNo || member.name).filter(Boolean).join(' ')
  ), []);

  const stats = useMemo(() => ({
    total: batches.length,
    completed: batches.filter(batch => batch.status === 'Completed').length,
    inProgress: batches.filter(batch => batch.status === 'In Progress').length,
    notStarted: batches.filter(batch => batch.status === 'Not Started').length
  }), [batches]);

  const outcomes = useMemo(() => batches.reduce((result, batch) => {
    const value = batch.outcome || 'None';
    result[value] = (result[value] || 0) + 1;
    return result;
  }, {}), [batches]);

  const completionPercent = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0;
  const inProgressPercent = stats.total ? Math.round((stats.inProgress / stats.total) * 100) : 0;
  const statusChart = `conic-gradient(#16a34a 0 ${completionPercent}%, #2563eb ${completionPercent}% ${completionPercent + inProgressPercent}%, #cbd5e1 ${completionPercent + inProgressPercent}% 100%)`;
  const outcomeRows = Object.entries(outcomes).sort((a, b) => b[1] - a[1]);

  const changeTab = (tab) => {
    setActiveTab(tab);
    sessionStorage.setItem('coordinatorActiveTab', tab);
    setSelectedBatch(null);
  };

  const selectBatch = (batch) => {
    setSelectedBatch(batch);
    setEditForm({
      coeId: idOf(batch.coeId) || idOf(batch.problemId?.coeId) || '',
      rcId: idOf(batch.rc?.rcId) || '',
      guideId: idOf(batch.guideId) || '',
      thrustArea: batch.thrustArea || '',
      problemTitle: batch.problemId?.title || '',
      outcome: batch.outcome || 'None'
    });
  };

  const saveBatch = async () => {
    if (!selectedBatch) return;
    setSaving(true);
    try {
      const response = await api.updateBatchByCoordinator(selectedBatch._id, editForm);
      const updated = response.data.data;
      setBatches(current => current.map(batch => batch._id === updated._id ? updated : batch));
      setSelectedBatch(updated);
      selectBatch(updated);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update this team.');
    } finally {
      setSaving(false);
    }
  };

  const downloadReport = () => {
    const rows = batches.map((batch, index) => ({
      'S.No': index + 1,
      'Team Name': batch.teamName,
      Members: (batch.teamMembers || []).map(member => `${member.name} (${member.rollNo})`).join(', '),
      Year: batch.year,
      Branch: batch.branch,
      Section: batch.section,
      Guide: batch.guideId?.name || 'Not Assigned',
      Domain: batch.domain || 'Not Assigned',
      'Thrust Area': batch.thrustArea || 'Not Assigned',
      Problem: batch.problemId?.title || 'Not Assigned',
      Outcome: batch.outcome || 'None',
      Status: batch.status || 'Not Started'
    }));
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 6 }, { wch: 18 }, { wch: 45 }, { wch: 8 }, { wch: 10 }, { wch: 10 },
      { wch: 24 }, { wch: 20 }, { wch: 28 }, { wch: 35 }, { wch: 16 }, { wch: 16 }
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Section Report');
    XLSX.writeFile(workbook, `Project_Sphere_${scope?.year}_${scope?.branch}_${scope?.section}_Report.xlsx`);
  };

  if (loading) {
    return (
      <div className="coordinator-dashboard">
        <div className="card loading"><h3>Loading section dashboard...</h3></div>
      </div>
    );
  }

  return (
    <div className="coordinator-dashboard">
      <div className="dashboard-header">
        <h1>Class Coordinator Dashboard</h1>
        <p>{scope?.year} Year - {scope?.branch} - Section {scope?.section}</p>
      </div>

      {error && <div className="coordinator-error">{error}</div>}

      <div className="stats-row coordinator-stats">
        <div className="stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label">Total Teams</div></div>
        <div className="stat-card"><div className="stat-value">{stats.completed}</div><div className="stat-label">Completed</div></div>
        <div className="stat-card"><div className="stat-value">{stats.inProgress}</div><div className="stat-label">In Progress</div></div>
        <div className="stat-card"><div className="stat-value">{stats.notStarted}</div><div className="stat-label">Not Started</div></div>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => changeTab('overview')}>Section Overview</button>
        <button className={`tab ${activeTab === 'teams' ? 'active' : ''}`} onClick={() => changeTab('teams')}>My Teams</button>
        <button className={`tab ${activeTab === 'timeline' ? 'active' : ''}`} onClick={() => changeTab('timeline')}>Timeline</button>
        <button className={`tab ${activeTab === 'meetings' ? 'active' : ''}`} onClick={() => changeTab('meetings')}>Meetings</button>
        <button className={`tab ${activeTab === 'batch-import' ? 'active' : ''}`} onClick={() => changeTab('batch-import')}>📤 Import Batches</button>
        <button className={`tab ${activeTab === 'project-import' ? 'active' : ''}`} onClick={() => changeTab('project-import')}>📊 Import Projects</button>
      </div>

      {activeTab === 'overview' && (
        <div className="tab-content">
          <div className="coordinator-overview-grid">
            <section className="coordinator-panel progress-panel">
              <div className="coordinator-panel-header">
                <div>
                  <span className="panel-kicker">Section snapshot</span>
                  <h2>Progress Mix</h2>
                </div>
                <span className="panel-count">{completionPercent}%</span>
              </div>
              <div className="status-visual-row">
                <div className="status-donut" style={{ background: statusChart }}>
                  <span>{stats.total}</span>
                </div>
                <div className="status-legend">
                  <div><span className="legend-dot completed"></span>Completed <strong>{stats.completed}</strong></div>
                  <div><span className="legend-dot progress"></span>In Progress <strong>{stats.inProgress}</strong></div>
                  <div><span className="legend-dot pending"></span>Not Started <strong>{stats.notStarted}</strong></div>
                </div>
              </div>
            </section>

            <section className="coordinator-panel brainstorm-panel">
              <div className="coordinator-panel-header">
                <div>
                  <span className="panel-kicker">Brainstorm</span>
                  <h2>Class Focus Ideas</h2>
                </div>
                <span className="panel-count">{inProgressPercent}%</span>
              </div>
              <div className="brainstorm-list">
                <div><strong>Review rhythm</strong><span>Keep PRC and submission checks weekly for active teams.</span></div>
                <div><strong>Outcome push</strong><span>Shortlist teams ready for prototype, paper, patent, or funding outcomes.</span></div>
                <div><strong>Guide sync</strong><span>Use meetings to close blockers before the next timeline deadline.</span></div>
              </div>
            </section>

            <section className="coordinator-panel outcome-panel">
              <div className="coordinator-panel-header">
                <div>
                  <span className="panel-kicker">Outcome graph</span>
                  <h2>Outcome Summary</h2>
                </div>
                <span className="panel-count">{batches.length}</span>
              </div>
              <div className="outcome-bars">
                {outcomeRows.length === 0 ? (
                  <p>No outcome data yet.</p>
                ) : (
                  outcomeRows.map(([outcome, count]) => (
                    <div className="outcome-bar-row" key={outcome}>
                      <div><span>{outcome}</span><strong>{count}</strong></div>
                      <div className="outcome-track">
                        <span style={{ width: `${stats.total ? Math.round((count / stats.total) * 100) : 0}%` }}></span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      {activeTab === 'teams' && (
        <div className="tab-content">
          <div className="section-header coordinator-teams-header">
            <div>
              <h2>My Teams</h2>
              <p>Only {scope?.year} {scope?.branch}-{scope?.section} teams are shown.</p>
            </div>
            <button className="btn btn-primary" onClick={downloadReport}>Download Report</button>
          </div>

          {selectedBatch ? (
            <section className="card coordinator-edit-panel">
              <div className="flex-between">
                <div>
                  <h2>{selectedBatch.teamName}</h2>
                  <p>{formatMembersForDisplay(selectedBatch.teamMembers) || 'No team members'}</p>
                </div>
                <button className="btn btn-secondary" onClick={() => setSelectedBatch(null)}>Back to Teams</button>
              </div>

              <div className="coordinator-form-grid">
                <label>COE<select value={editForm.coeId} onChange={event => setEditForm(current => ({ ...current, coeId: event.target.value }))}><option value="">Not Assigned</option>{coes.map(coe => <option key={coe._id} value={coe._id}>{coe.name}</option>)}</select></label>
                <label>RC<select value={editForm.rcId} onChange={event => setEditForm(current => ({ ...current, rcId: event.target.value }))}><option value="">Not Assigned</option>{rcs.map(rc => <option key={rc._id} value={rc._id}>{rc.name}</option>)}</select></label>
                <label>Guide<select value={editForm.guideId} onChange={event => setEditForm(current => ({ ...current, guideId: event.target.value }))}><option value="">Not Assigned</option>{guides.map(guide => <option key={guide._id} value={guide._id}>{guide.name}</option>)}</select></label>
                <label>Outcome<select value={editForm.outcome} onChange={event => setEditForm(current => ({ ...current, outcome: event.target.value }))}>{OUTCOMES.map(outcome => <option key={outcome}>{outcome}</option>)}</select></label>
                <label>Thrust Area<input value={editForm.thrustArea} onChange={event => setEditForm(current => ({ ...current, thrustArea: event.target.value }))} /></label>
                <label className="coordinator-full-field">Problem Title<input value={editForm.problemTitle} onChange={event => setEditForm(current => ({ ...current, problemTitle: event.target.value }))} /></label>
              </div>

              <button className="btn btn-primary" disabled={saving} onClick={saveBatch}>{saving ? 'Saving...' : 'Save Team Details'}</button>
            </section>
          ) : (
            <div className="table-container">
              <table className="data-table coordinator-table">
                <thead>
                  <tr>
                    <th>Team Name</th>
                    <th>Members</th>
                    <th>Guide</th>
                    <th>Domain</th>
                    <th>Thrust Area</th>
                    <th>Problem</th>
                    <th>Outcome</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.length === 0 ? (
                    <tr><td colSpan="7">No teams have been added to this section.</td></tr>
                  ) : (
                    batches.map(batch => (
                      <tr key={batch._id}>
                        <td><button className="coordinator-link" onClick={() => selectBatch(batch)}>{batch.teamName}</button></td>
                        <td>{formatMembersForDisplay(batch.teamMembers) || '-'}</td>
                        <td>{batch.guideId?.name || 'Not Assigned'}</td>
                        <td>{batch.domain || 'Not Assigned'}</td>
                        <td>{batch.thrustArea || '-'}</td>
                        <td>{batch.problemId?.title || 'Not Assigned'}</td>
                        <td>{batch.outcome || 'None'}</td>
                        <td>{batch.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'timeline' && <TimelineManagement scope={scope} allowRemarkEditing />}
      {activeTab === 'meetings' && <AdminMeetings scope={scope} />}

      {activeTab === 'batch-import' && (
        <div className="tab-content">
          <BatchImport
            onImportComplete={() => {
              changeTab('teams');
              fetchData();
            }}
            onCancel={() => changeTab('teams')}
          />
        </div>
      )}

      {activeTab === 'project-import' && (
        <div className="tab-content">
          <ImportProjectData
            onImportComplete={() => {
              changeTab('teams');
              fetchData();
            }}
            onCancel={() => changeTab('teams')}
          />
        </div>
      )}
    </div>
  );
}

export default CoordinatorDashboard;
