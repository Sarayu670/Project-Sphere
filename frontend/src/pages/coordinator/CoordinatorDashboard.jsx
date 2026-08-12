import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../services/api';
import TimelineManagement from '../admin/TimelineManagement';
import AdminMeetings from '../admin/AdminMeetings';
import usePolling from '../../utils/usePolling';
import './CoordinatorDashboard.css';

const OUTCOMES = ['None', 'Patented', 'Published', 'Copyrighted', 'Prototype', 'Funded', 'Other'];

function idOf(value) {
  return typeof value === 'object' && value ? value._id : value;
}

function CoordinatorDashboard() {
  const { user } = useAuth();
  const scope = user?.coordinatorSection;
  const [activeTab, setActiveTab] = useState(() => sessionStorage.getItem('coordinatorActiveTab') || 'overview');
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
        api.getSectionBatches(), api.getAllCOEs(), api.getAllRCs(), api.getAllGuides()
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

  useEffect(() => { fetchData(); }, [fetchData]);
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

  const alerts = useMemo(() => batches.flatMap(batch => {
    const missing = [];
    if (!batch.guideId) missing.push('guide');
    if (!batch.problemId) missing.push('problem');
    if (!batch.thrustArea) missing.push('thrust area');
    if (!batch.coeId && !batch.coe?.name) missing.push('COE/RC');
    return missing.length ? [{ batch, missing }] : [];
  }), [batches]);

  const sectionGuides = useMemo(() => {
    const byId = new Map();
    batches.forEach(batch => {
      const guide = batch.guideId;
      const guideId = idOf(guide);
      if (!guideId) return;
      if (!byId.has(String(guideId))) {
        byId.set(String(guideId), { ...guide, teams: [] });
      }
      byId.get(String(guideId)).teams.push(batch);
    });
    return Array.from(byId.values());
  }, [batches]);

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
      researchArea: batch.problemId?.researchArea || batch.researchArea || '',
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
      'Research Area': batch.problemId?.researchArea || batch.researchArea || 'Not Assigned',
      'Thrust Area': batch.thrustArea || 'Not Assigned',
      Problem: batch.problemId?.title || 'Not Assigned',
      Outcome: batch.outcome || 'None',
      Status: batch.status || 'Not Started'
    }));
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 6 }, { wch: 18 }, { wch: 45 }, { wch: 8 }, { wch: 10 }, { wch: 10 },
      { wch: 24 }, { wch: 24 }, { wch: 28 }, { wch: 35 }, { wch: 16 }, { wch: 16 }
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Section Report');
    XLSX.writeFile(workbook, `Project_Sphere_${scope?.year}_${scope?.branch}_${scope?.section}_Report.xlsx`);
  };

  if (loading) return <div className="coordinator-dashboard"><div className="card loading"><h3>Loading section dashboard...</h3></div></div>;

  return (
    <div className="coordinator-dashboard">
      <div className="dashboard-header">
        <h1>🏫 Class Coordinator Dashboard</h1>
        <p>{scope?.year} Year · {scope?.branch} – Section {scope?.section}</p>
      </div>

      {error && <div className="coordinator-error">{error}</div>}

      <div className="stats-row coordinator-stats">
        <div className="stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label">Total Teams</div></div>
        <div className="stat-card"><div className="stat-value">{stats.completed}</div><div className="stat-label">Completed</div></div>
        <div className="stat-card"><div className="stat-value">{stats.inProgress}</div><div className="stat-label">In Progress</div></div>
        <div className="stat-card"><div className="stat-value">{stats.notStarted}</div><div className="stat-label">Not Started</div></div>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => changeTab('overview')}>📊 Section Overview</button>
        <button className={`tab ${activeTab === 'teams' ? 'active' : ''}`} onClick={() => changeTab('teams')}>🔍 My Teams</button>
        <button className={`tab ${activeTab === 'guides' ? 'active' : ''}`} onClick={() => changeTab('guides')}>👨‍🏫 Guides</button>
        <button className={`tab ${activeTab === 'timeline' ? 'active' : ''}`} onClick={() => changeTab('timeline')}>📅 Timeline</button>
        <button className={`tab ${activeTab === 'meetings' ? 'active' : ''}`} onClick={() => changeTab('meetings')}>🤝 Meetings</button>
      </div>

      {activeTab === 'overview' && (
        <div className="tab-content">
          <div className="coordinator-grid">
            <section className="card"><h2>Outcomes</h2><div className="outcome-list">
              {Object.entries(outcomes).length === 0 ? <p>No outcome data yet.</p> : Object.entries(outcomes).map(([outcome, count]) => <div key={outcome}><span>{outcome}</span><strong>{count}</strong></div>)}
            </div></section>
            <section className="card"><h2>Needs Attention</h2>
              {alerts.length === 0 ? <p className="coordinator-ok">All teams have their key assignments.</p> : <div className="alert-list">{alerts.map(({ batch, missing }) => <div key={batch._id}><strong>{batch.teamName}</strong><span>Missing: {missing.join(', ')}</span></div>)}</div>}
            </section>
          </div>
        </div>
      )}

      {activeTab === 'teams' && (
        <div className="tab-content">
          <div className="section-header coordinator-teams-header"><div><h2>My Teams</h2><p>Only {scope?.year} {scope?.branch}-{scope?.section} teams are shown.</p></div><button className="btn btn-primary" onClick={downloadReport}>📥 Download Report</button></div>
          {selectedBatch ? (
            <section className="card coordinator-edit-panel">
              <div className="flex-between"><div><h2>{selectedBatch.teamName}</h2><p>{formatMembersForDisplay(selectedBatch.teamMembers) || 'No team members'}</p></div><button className="btn btn-secondary" onClick={() => setSelectedBatch(null)}>Back to Teams</button></div>
              <div className="coordinator-form-grid">
                <label>COE<select value={editForm.coeId} onChange={event => setEditForm(current => ({ ...current, coeId: event.target.value }))}><option value="">Not Assigned</option>{coes.map(coe => <option key={coe._id} value={coe._id}>{coe.name}</option>)}</select></label>
                <label>RC<select value={editForm.rcId} onChange={event => setEditForm(current => ({ ...current, rcId: event.target.value }))}><option value="">Not Assigned</option>{rcs.map(rc => <option key={rc._id} value={rc._id}>{rc.name}</option>)}</select></label>
                <label>Guide<select value={editForm.guideId} onChange={event => setEditForm(current => ({ ...current, guideId: event.target.value }))}><option value="">Not Assigned</option>{guides.map(guide => <option key={guide._id} value={guide._id}>{guide.name}</option>)}</select></label>
                <label>Outcome<select value={editForm.outcome} onChange={event => setEditForm(current => ({ ...current, outcome: event.target.value }))}>{OUTCOMES.map(outcome => <option key={outcome}>{outcome}</option>)}</select></label>
                <label>Research Area<input value={editForm.researchArea} onChange={event => setEditForm(current => ({ ...current, researchArea: event.target.value }))} /></label>
                <label>Thrust Area<input value={editForm.thrustArea} onChange={event => setEditForm(current => ({ ...current, thrustArea: event.target.value }))} /></label>
                <label className="coordinator-full-field">Problem Title<input value={editForm.problemTitle} onChange={event => setEditForm(current => ({ ...current, problemTitle: event.target.value }))} /></label>
              </div>
              <button className="btn btn-primary" disabled={saving} onClick={saveBatch}>{saving ? 'Saving...' : 'Save Team Details'}</button>
            </section>
          ) : (
            <div className="table-container"><table className="data-table coordinator-table"><thead><tr><th>Team Name</th><th>Members</th><th>Guide</th><th>Research Area</th><th>Thrust Area</th><th>Problem</th><th>Outcome</th><th>Status</th></tr></thead><tbody>
              {batches.length === 0 ? <tr><td colSpan="8">No teams have been added to this section.</td></tr> : batches.map(batch => <tr key={batch._id}><td><button className="coordinator-link" onClick={() => selectBatch(batch)}>{batch.teamName}</button></td><td>{formatMembersForDisplay(batch.teamMembers) || '—'}</td><td>{batch.guideId?.name || 'Not Assigned'}</td><td>{batch.problemId?.researchArea || batch.researchArea || '—'}</td><td>{batch.thrustArea || '—'}</td><td>{batch.problemId?.title || 'Not Assigned'}</td><td>{batch.outcome || 'None'}</td><td>{batch.status}</td></tr>)}
            </tbody></table></div>
          )}
        </div>
      )}

      {activeTab === 'guides' && <div className="tab-content"><div className="section-header"><div><h2>Guides in My Section</h2><p>Only guides assigned to the teams in this section.</p></div></div><div className="guide-card-grid">{sectionGuides.length === 0 ? <div className="card">No guides are assigned yet.</div> : sectionGuides.map(guide => { const complete = guide.teams.filter(team => team.status === 'Completed').length; const inProgress = guide.teams.filter(team => team.status === 'In Progress').length; return <article key={guide._id} className="card coordinator-guide-card"><h3>{guide.name}</h3><p>{guide.email || 'No email available'}</p><p>{guide.department || 'Department not specified'}</p><div><strong>{guide.teams.length}</strong> teams in this section</div><small>{inProgress} in progress · {complete} completed</small></article>; })}</div></div>}
      {activeTab === 'timeline' && <TimelineManagement scope={scope} allowRemarkEditing />}
      {activeTab === 'meetings' && <AdminMeetings scope={scope} />}
    </div>
  );
}

export default CoordinatorDashboard;
