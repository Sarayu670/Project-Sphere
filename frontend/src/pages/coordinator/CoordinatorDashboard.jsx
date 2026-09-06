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
const TRACKED_MARK_EVENTS = [
  { key: 'abstractReview', label: 'Abstract Review', aliases: ['abstract review', 'abstract-review', 'abstractreview'] },
  { key: 'prc1', label: 'PRC-1', aliases: ['prc-1', 'prc 1', 'prc1'] },
  { key: 'prc2', label: 'PRC-2', aliases: ['prc-2', 'prc 2', 'prc2'] },
  { key: 'prc3', label: 'PRC-3', aliases: ['prc-3', 'prc 3', 'prc3'] },
  { key: 'thesis', label: 'Thesis', aliases: ['thesis'] }
];

const normalizeEventTitle = (value = '') => String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function idOf(value) {
  return typeof value === 'object' && value ? value._id : value;
}

function buildMarksReport(batches = [], timelineEvents = [], submissions = []) {
  const relevantEvents = (timelineEvents || [])
    .map(event => {
      const normalized = normalizeEventTitle(event?.title || '');
      const match = TRACKED_MARK_EVENTS.find(config => config.aliases.some(alias => normalized.includes(alias)));
      return match ? { ...event, markKey: match.key, markLabel: match.label, order: TRACKED_MARK_EVENTS.findIndex(item => item.key === match.key) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order);

  if (!relevantEvents.length) {
    return { columns: [], rows: [] };
  }

  const submissionsByKey = new Map();
  for (const submission of submissions) {
    const batchId = submission?.batchId && typeof submission.batchId === 'object' ? submission.batchId._id : submission.batchId;
    const eventId = submission?.timelineEventId && typeof submission.timelineEventId === 'object' ? submission.timelineEventId._id : submission.timelineEventId;
    if (!batchId || !eventId) continue;
    submissionsByKey.set(`${String(batchId)}::${String(eventId)}`, submission);
  }

  const rows = [];
  for (const batch of batches) {
    const batchId = String(batch?._id || '');
    if (!batchId) continue;

    const members = new Map();
    const addMember = (member) => {
      if (!member) return;
      const uniqueKey = String(member._id || member.rollNo || member.rollNumber || `${member.name || 'member'}-${Math.random()}`);
      if (!members.has(uniqueKey)) {
        members.set(uniqueKey, {
          _id: member._id || member.rollNo || member.rollNumber || uniqueKey,
          name: member.name || 'Unknown Student',
          rollNo: member.rollNo || member.rollNumber || '—'
        });
      }
    };

    (batch.teamMembers || []).forEach(addMember);

    for (const submission of submissions) {
      const currentBatchId = submission?.batchId && typeof submission.batchId === 'object' ? submission.batchId._id : submission.batchId;
      if (String(currentBatchId) !== batchId) continue;
      (submission.studentMarks || []).forEach(markEntry => {
        const student = markEntry?.studentId && typeof markEntry.studentId === 'object' ? markEntry.studentId : null;
        if (!student) return;
        addMember({
          _id: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
          rollNo: student.rollNumber
        });
      });
    }

    const memberList = Array.from(members.values());
    if (!memberList.length) continue;

    for (const member of memberList) {
      const row = {
        teamName: batch.teamName || 'Unknown Team',
        memberName: member.name,
        rollNumber: member.rollNo || '—'
      };
      let total = 0;
      let outOf = 0;

      for (const event of relevantEvents) {
        const submission = submissionsByKey.get(`${batchId}::${String(event._id)}`);
        const scoreEntry = (submission?.studentMarks || []).find(markEntry => {
          const studentId = markEntry?.studentId && typeof markEntry.studentId === 'object' ? markEntry.studentId._id : markEntry.studentId;
          return String(studentId) === String(member._id);
        });
        const score = scoreEntry && scoreEntry.marks !== null && scoreEntry.marks !== undefined ? Number(scoreEntry.marks) : 0;
        row[event.markKey] = score;
        total += score;
        outOf += Number(event.maxMarks || 0);
      }

      row.total = total;
      row.outOf = outOf;
      row.percentage = outOf ? Math.round((total / outOf) * 100) : 0;
      rows.push(row);
    }
  }

  return {
    columns: relevantEvents.map(event => ({ key: event.markKey, label: event.markLabel, max: Number(event.maxMarks || 0) })),
    rows
  };
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
  const [marksReport, setMarksReport] = useState({ columns: [], rows: [] });
  const [marksPage, setMarksPage] = useState(1);
  const MARKS_PAGE_SIZE = 10;

  const fetchData = useCallback(async () => {
    try {
      const [batchesRes, coesRes, rcsRes, guidesRes, timelineRes, submissionsRes] = await Promise.all([
        api.getSectionBatches(),
        api.getAllCOEs(),
        api.getAllRCs(),
        api.getAllGuides(),
        api.getAllTimelineEvents(scope?.year),
        api.getAllSubmissions({ status: 'all', limit: 500 })
      ]);
      const nextBatches = batchesRes.data.data || [];
      setBatches(nextBatches);
      setCoes(coesRes.data.data || []);
      setRcs(rcsRes.data.data || []);
      setGuides(guidesRes.data.data || []);
      setMarksReport(buildMarksReport(nextBatches, timelineRes.data.data || [], submissionsRes.data.data || []));
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load the coordinator dashboard.');
    } finally {
      setLoading(false);
    }
  }, [scope?.year]);

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

  const downloadMarksReport = () => {
    if (!marksReport.columns.length) {
      return;
    }

    const rows = marksReport.rows.map(row => {
      const record = {
        Team: row.teamName,
        Student: row.memberName,
        'Roll Number': row.rollNumber
      };
      marksReport.columns.forEach(column => {
        record[column.label] = row[column.key];
      });
      record['Total'] = row.total;
      record['Out of'] = row.outOf;
      record['%'] = row.percentage;
      return record;
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 20 }, { wch: 22 }, { wch: 15 },
      ...marksReport.columns.map(() => ({ wch: 15 })),
      { wch: 12 }, { wch: 12 }, { wch: 10 }
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Marks Report');
    XLSX.writeFile(workbook, `Project_Sphere_${scope?.year}_${scope?.branch}_${scope?.section}_Marks_Report.xlsx`);
  };

  const marksTotalPages = Math.max(1, Math.ceil((marksReport.rows?.length || 0) / MARKS_PAGE_SIZE));
  const paginatedMarksRows = marksReport.rows.slice((marksPage - 1) * MARKS_PAGE_SIZE, marksPage * MARKS_PAGE_SIZE);

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
        <button className={`tab ${activeTab === 'marks' ? 'active' : ''}`} onClick={() => changeTab('marks')}>Marks Report</button>
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

            <section className="coordinator-panel outcome-panel">
              <div className="coordinator-panel-header">
                <div>
                  <span className="panel-kicker">Project outcomes</span>
                  <h2>Outcome Summary</h2>
                </div>
                <span className="panel-count">{batches.length}</span>
              </div>
              <div className="outcome-list">
                {outcomeRows.length === 0 ? (
                  <div className="outcome-empty">
                    <p>No project outcome data recorded yet.</p>
                  </div>
                ) : (
                  outcomeRows.map(([outcome, count]) => {
                    const percent = stats.total ? Math.round((count / stats.total) * 100) : 0;
                    const config = {
                      'Patented': { icon: '📜', color: '#8b5cf6' },
                      'Published': { icon: '📚', color: '#3b82f6' },
                      'Copyrighted': { icon: '©️', color: '#10b981' },
                      'Prototype': { icon: '⚙️', color: '#f59e0b' },
                      'Funded': { icon: '💰', color: '#06b6d4' },
                      'Other': { icon: '🏷️', color: '#6366f1' },
                      'None': { icon: '⚪', color: '#94a3b8' }
                    }[outcome] || { icon: '📌', color: '#0ea5e9' };

                    return (
                      <div className="outcome-item" key={outcome}>
                        <div className="outcome-meta">
                          <span className="outcome-label">
                            <span className="outcome-icon">{config.icon}</span>
                            <strong>{outcome === 'None' ? 'None / Pending' : outcome}</strong>
                          </span>
                          <span className="outcome-stat">
                            <strong>{count}</strong> {count === 1 ? 'team' : 'teams'} ({percent}%)
                          </span>
                        </div>
                        <div className="outcome-track">
                          <span style={{ width: `${percent}%`, background: config.color }}></span>
                        </div>
                      </div>
                    );
                  })
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

      {activeTab === 'marks' && (
        <div className="tab-content">
          <div className="section-header coordinator-teams-header">
            <div>
              <h2>Team Marks Report</h2>
              <p>Individual assessment for each batch across Abstract Review, PRC-1, PRC-2, PRC-3 and Thesis.</p>
            </div>
            <button className="btn btn-primary" onClick={downloadMarksReport} disabled={!marksReport.columns.length}>
              Download Excel
            </button>
          </div>

          <div className="coordinator-marks-card">
            {marksReport.columns.length === 0 ? (
              <div className="coordinator-empty-state">
                <h3>No guided marks available yet</h3>
                <p>Once the guide assigns marks for the timeline events, they will appear here for each student.</p>
              </div>
            ) : (
              <div className="table-container marks-table-container">
                <table className="data-table coordinator-marks-table">
                  <thead>
                    <tr>
                      <th>Team</th>
                      <th>Student</th>
                      <th>Roll No</th>
                      {marksReport.columns.map(column => (
                        <th key={column.key}>{column.label}<br /><span className="marks-subtext">/{column.max}</span></th>
                      ))}
                      <th>Total<br /><span className="marks-subtext">/25</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedMarksRows.length === 0 ? (
                      <tr><td colSpan={5 + marksReport.columns.length}>No team data found.</td></tr>
                    ) : (
                      paginatedMarksRows.map((row, index) => (
                        <tr key={`${row.teamName}-${row.memberName}-${index}`}>
                          <td>{row.teamName}</td>
                          <td>{row.memberName}</td>
                          <td>{row.rollNumber}</td>
                          {marksReport.columns.map(column => (
                            <td key={`${row.teamName}-${row.memberName}-${column.key}`} className="marks-cell">
                              <span className={row[column.key] > 0 ? 'marks-positive' : 'marks-neutral'}>{row[column.key] ?? 0}</span>
                            </td>
                          ))}
                          <td className="marks-total-cell">
                            <strong>{row.total}</strong>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>

                {marksReport.rows.length > MARKS_PAGE_SIZE && (
                  <div className="marks-pagination">
                    <button
                      className="btn btn-secondary"
                      disabled={marksPage === 1}
                      onClick={() => setMarksPage(prev => Math.max(1, prev - 1))}
                    >
                      Previous
                    </button>
                    <span>{marksPage} / {marksTotalPages}</span>
                    <button
                      className="btn btn-secondary"
                      disabled={marksPage >= marksTotalPages}
                      onClick={() => setMarksPage(prev => Math.min(marksTotalPages, prev + 1))}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
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
