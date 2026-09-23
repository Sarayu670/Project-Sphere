import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
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
  { key: 'thesis', label: 'Document Submission', aliases: ['thesis', 'document submission', 'document-submission'] }
];
const MARK_COMPONENT_MAX = 25;
const MARK_GROUP_MAX = MARK_COMPONENT_MAX * 2;
const MARKS_REPORT_MAX = TRACKED_MARK_EVENTS.length * MARK_GROUP_MAX;

const normalizeEventTitle = (value = '') => String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const isGuideApproved = (submission) => submission?.status === 'accepted' || submission?.status === 'completed';

const compareNatural = (left, right) => String(left || '').localeCompare(String(right || ''), undefined, {
  numeric: true,
  sensitivity: 'base'
});

function idOf(value) {
  return typeof value === 'object' && value ? value._id : value;
}

function buildMarksReport(batches = [], timelineEvents = [], submissions = []) {
  const markGroups = TRACKED_MARK_EVENTS.map(config => {
    const events = (timelineEvents || []).filter(event => {
      const normalized = normalizeEventTitle(event?.title || '');
      return config.aliases.some(alias => normalized.includes(alias));
    });
    const guideEvent = events.find(event => normalizeEventTitle(event.title).includes('guide')) || events[0];
    const prcEvent = events.find(event => normalizeEventTitle(event.title).includes('prc') && event._id !== guideEvent?._id)
      || events.find(event => event._id !== guideEvent?._id);
    return {
      key: config.key,
      label: config.label,
      guideEvent,
      prcEvent,
      max: MARK_GROUP_MAX,
      guideMax: MARK_COMPONENT_MAX,
      prcMax: MARK_COMPONENT_MAX
    };
  });

  if (!markGroups.some(group => group.guideEvent || group.prcEvent)) {
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
  for (const batch of [...batches].sort((left, right) => compareNatural(left.teamName, right.teamName))) {
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

    if (batch.leaderStudentId && typeof batch.leaderStudentId === 'object') {
      addMember(batch.leaderStudentId);
    }
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
      (submission.prcStudentMarks || []).forEach(markEntry => {
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

    const memberList = Array.from(members.values()).sort((left, right) => compareNatural(left.rollNo, right.rollNo));
    if (!memberList.length) continue;

    for (const member of memberList) {
      const row = {
        studentId: member._id,
        teamKey: batchId,
        teamName: batch.teamName || 'Unknown Team',
        projectTitle: batch.problemId?.title || batch.problemTitle || batch.title || 'Not Assigned',
        guideName: batch.guideId?.name || (typeof batch.guideId === 'string' ? batch.guideId : 'Not Assigned'),
        memberName: member.name,
        rollNumber: member.rollNo || '—'
      };
      let total = 0;
      const guideFeedbacks = [];
      const prcFeedbacks = [];

      for (const group of markGroups) {
        const guideSubmission = group.guideEvent && submissionsByKey.get(`${batchId}::${String(group.guideEvent._id)}`);
        const prcSubmission = group.prcEvent && submissionsByKey.get(`${batchId}::${String(group.prcEvent._id)}`);
        const submission = guideSubmission || prcSubmission;
        const findStudentMark = (source, predicate) => (source?.studentMarks || []).find(markEntry => {
          const studentId = markEntry?.studentId && typeof markEntry.studentId === 'object' ? markEntry.studentId._id : markEntry.studentId;
          return String(studentId) === String(member._id) && predicate(markEntry);
        });

        const guideEntry = findStudentMark(guideSubmission || submission, markEntry => (
          markEntry.marks !== null && markEntry.marks !== undefined
        ));
        const guideMarks = guideEntry ? Number(guideEntry.marks) : 0;
        const prcEntry = [...(prcSubmission?.prcStudentMarks || []), ...(guideSubmission?.prcStudentMarks || [])].find(markEntry => {
          const sid = markEntry?.studentId && typeof markEntry.studentId === 'object' ? markEntry.studentId._id : markEntry.studentId;
          return String(sid) === String(member._id);
        });
        const nestedPrcEntry = findStudentMark(prcSubmission || submission, markEntry => (
          markEntry.prcMarks !== null && markEntry.prcMarks !== undefined
        ));
        const guideNestedPrcEntry = guideSubmission && findStudentMark(guideSubmission, markEntry => (
          markEntry.prcMarks !== null && markEntry.prcMarks !== undefined
        ));
        const prcMarks = prcEntry?.marks ?? nestedPrcEntry?.prcMarks ?? guideNestedPrcEntry?.prcMarks
          ?? prcSubmission?.prcMarks ?? guideSubmission?.prcMarks ?? 0;

        if (guideSubmission?.comments?.length) guideFeedbacks.push(...guideSubmission.comments.map(comment => comment.comment).filter(Boolean));
        if (prcSubmission?.adminRemarks?.length) prcFeedbacks.push(...prcSubmission.adminRemarks.map(remark => remark.remark).filter(Boolean));

        row[`${group.key}Guide`] = guideMarks;
        row[`${group.key}Prc`] = prcMarks;
        row[`${group.key}Total`] = guideMarks + prcMarks;
        row[`${group.key}SubmissionId`] = prcSubmission?._id || submission?._id || '';
        row[`${group.key}TimelineEventId`] = group.prcEvent?._id || group.guideEvent?._id || '';
        row[`${group.key}BatchId`] = batchId;
        row[`${group.key}GuideApproved`] = isGuideApproved(guideSubmission);

        total += (guideMarks + prcMarks);
      }

      row.guideFeedback = guideFeedbacks.length > 0 ? guideFeedbacks.join(' | ') : 'N/A';
      row.prcFeedback = prcFeedbacks.length > 0 ? prcFeedbacks.join(' | ') : 'N/A';
      row.total = total;
      row.outOf = MARKS_REPORT_MAX;
      row.percentage = Math.round((total / MARKS_REPORT_MAX) * 100);
      rows.push(row);
    }
  }

  return {
    columns: markGroups.map(group => ({
      key: group.key,
      label: group.label,
      guideKey: `${group.key}Guide`,
      prcKey: `${group.key}Prc`,
      totalKey: `${group.key}Total`,
      guideMax: group.guideMax,
      prcMax: group.prcMax,
      max: group.max
    })),
    rows
  };
}

function getTeamRowSpan(rows, index) {
  const nextTeamIndex = rows.slice(index).findIndex(row => row.teamKey !== rows[index].teamKey);
  return nextTeamIndex === -1 ? rows.length - index : nextTeamIndex;
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
  const [markDrafts, setMarkDrafts] = useState({});
  const [editingMarkKey, setEditingMarkKey] = useState('');
  const [savingMarkKey, setSavingMarkKey] = useState('');
  const [marksPage, setMarksPage] = useState(1);
  const MARKS_PAGE_SIZE = 10;
  const [teamsPage, setTeamsPage] = useState(1);
  const TEAMS_PAGE_SIZE = 10;

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
      console.error('Error loading coordinator dashboard:', err);
      setError(err.response?.data?.message || err.message || 'Unable to load the coordinator dashboard.');
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
    const guideObj = typeof batch.guideId === 'object' && batch.guideId
      ? batch.guideId
      : guides.find(g => g._id === idOf(batch.guideId));
    setSelectedBatch(batch);
    setEditForm({
      teamName: batch.teamName || '',
      coeId: idOf(batch.coeId) || idOf(batch.problemId?.coeId) || '',
      rcId: idOf(batch.rc?.rcId) || '',
      guideId: idOf(batch.guideId) || '',
      guideEmail: guideObj?.email || batch.guideId?.email || '',
      thrustArea: batch.thrustArea || '',
      problemTitle: batch.problemId?.title || '',
      outcome: batch.outcome || 'None'
    });
  };

  const saveBatch = async () => {
    if (!selectedBatch) return;
    if (!editForm.teamName?.trim()) {
      setError('Team name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const response = await api.updateBatchByCoordinator(selectedBatch._id, editForm);
      const updated = response.data.data;
      setBatches(current => current.map(batch => batch._id === updated._id ? updated : batch));
      const targetGId = editForm.guideId || idOf(updated.guideId);
      if (targetGId && editForm.guideEmail) {
        setGuides(current => current.map(g => g._id === targetGId ? { ...g, email: editForm.guideEmail.trim().toLowerCase() } : g));
      }
      setSelectedBatch(null);
      fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to update this team.');
    } finally {
      setSaving(false);
    }
  };

  const deleteBatch = async (batch) => {
    const confirmed = window.confirm(`Delete team "${batch.teamName}"? This will remove the team from this section.`);
    if (!confirmed) return;

    setSaving(true);
    try {
      await api.deleteBatchByCoordinator(batch._id);
      setBatches(current => current.filter(currentBatch => currentBatch._id !== batch._id));
      if (selectedBatch?._id === batch._id) setSelectedBatch(null);
      setError('');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to delete this team.');
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
    if (!marksReport.columns.length || !marksReport.rows.length) {
      return;
    }

    const headers = [
      'Team',
      'Project Title',
      'Guide',
      'Student',
      'Roll Number'
    ];
    marksReport.columns.forEach(column => {
      headers.push(`${column.label} (Guide)`);
      headers.push(`${column.label} (PRC)`);
      headers.push(`${column.label} Total`);
    });
    headers.push('Average');

    const aoaData = [headers];
    const merges = [];
    let currentRowIdx = 1;

    // Group rows by teamKey / teamName
    const teamGroups = {};
    marksReport.rows.forEach(row => {
      const key = row.teamKey || row.teamName;
      if (!teamGroups[key]) teamGroups[key] = [];
      teamGroups[key].push(row);
    });

    Object.values(teamGroups).forEach(groupRows => {
      const startRow = currentRowIdx;
      const numMembers = groupRows.length;

      groupRows.forEach(row => {
        const record = [
          row.teamName,
          row.projectTitle || 'Not Assigned',
          row.guideName || 'Not Assigned',
          row.memberName,
          row.rollNumber
        ];

        marksReport.columns.forEach(column => {
          record.push(row[column.guideKey] ?? '—');
          record.push(row[column.prcKey] ?? '—');
          record.push(row[column.totalKey] ?? '—');
        });

        const avg = marksReport.columns.length > 0
          ? Number((row.total / marksReport.columns.length).toFixed(2))
          : 0;
        record.push(avg);

        aoaData.push(record);
        currentRowIdx++;
      });

      if (numMembers > 1) {
        const endRow = startRow + numMembers - 1;
        // Merge Team (col 0), Project Title (col 1), Guide (col 2) across student rows
        merges.push({ s: { r: startRow, c: 0 }, e: { r: endRow, c: 0 } });
        merges.push({ s: { r: startRow, c: 1 }, e: { r: endRow, c: 1 } });
        merges.push({ s: { r: startRow, c: 2 }, e: { r: endRow, c: 2 } });
      }
    });

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet(aoaData);
    worksheet['!merges'] = merges;
    worksheet['!cols'] = [
      { wch: 18 }, { wch: 35 }, { wch: 22 }, { wch: 22 }, { wch: 16 },
      ...marksReport.columns.flatMap(() => [{ wch: 14 }, { wch: 14 }, { wch: 14 }]),
      { wch: 12 }
    ];
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Marks Report');
    XLSX.writeFile(workbook, `Project_Sphere_${scope?.year}_${scope?.branch}_${scope?.section}_Marks_Report.xlsx`);
  };

  const saveCoordinatorPrcMark = async (row, column) => {
    const markKey = `${row.teamKey}-${row.studentId}-${column.key}`;
    if (!row[`${column.key}GuideApproved`]) {
      setError('PRC marks can only be entered after guide approval.');
      return;
    }
    const value = markDrafts[markKey];
    const marks = Number(value);
    if (!Number.isFinite(marks) || marks < 0 || marks > MARK_COMPONENT_MAX) {
      setError(`PRC marks must be between 0 and ${MARK_COMPONENT_MAX}.`);
      return;
    }

    setSavingMarkKey(markKey);
    try {
      const submissionId = row[`${column.key}SubmissionId`];
      const timelineEventId = row[`${column.key}TimelineEventId`];
      const batchId = row.teamKey;

      await api.assignPrcMarks({
        submissionId: submissionId || undefined,
        batchId,
        timelineEventId,
        studentId: row.studentId,
        marks
      });

      // Optimistically update the table rows so changes are immediately visible
      setMarksReport(current => ({
        ...current,
        rows: current.rows.map(r => {
          if (r.studentId === row.studentId && r.teamKey === row.teamKey) {
            const updated = { ...r };
            updated[column.prcKey] = marks;
            updated[column.totalKey] = (updated[column.guideKey] || 0) + marks;
            let sum = 0;
            current.columns.forEach(col => {
              sum += (updated[col.totalKey] || 0);
            });
            updated.total = sum;
            updated.percentage = Math.round((sum / MARKS_REPORT_MAX) * 100);
            return updated;
          }
          return r;
        })
      }));

      setMarkDrafts(current => ({ ...current, [markKey]: '' }));
      setEditingMarkKey('');
      setError('');
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to save PRC marks.');
    } finally {
      setSavingMarkKey('');
    }
  };

  const marksTotalPages = Math.max(1, Math.ceil((marksReport.rows?.length || 0) / MARKS_PAGE_SIZE));
  const paginatedMarksRows = marksReport.rows.slice((marksPage - 1) * MARKS_PAGE_SIZE, marksPage * MARKS_PAGE_SIZE);

  const teamsTotalPages = Math.max(1, Math.ceil(batches.length / TEAMS_PAGE_SIZE));
  const paginatedBatches = useMemo(() => {
    const start = (teamsPage - 1) * TEAMS_PAGE_SIZE;
    return [...batches].sort((left, right) => compareNatural(left.teamName, right.teamName)).slice(start, start + TEAMS_PAGE_SIZE);
  }, [batches, teamsPage]);

  useEffect(() => {
    if (teamsPage > teamsTotalPages) {
      setTeamsPage(teamsTotalPages);
    }
  }, [teamsTotalPages, teamsPage]);

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
                <label className="coordinator-full-field">Team Name<input value={editForm.teamName} onChange={event => setEditForm(current => ({ ...current, teamName: event.target.value }))} /></label>
                <label>COE<select value={editForm.coeId} onChange={event => setEditForm(current => ({ ...current, coeId: event.target.value }))}><option value="">Not Assigned</option>{coes.map(coe => <option key={coe._id} value={coe._id}>{coe.name}</option>)}</select></label>
                <label>RC<select value={editForm.rcId} onChange={event => setEditForm(current => ({ ...current, rcId: event.target.value }))}><option value="">Not Assigned</option>{rcs.map(rc => <option key={rc._id} value={rc._id}>{rc.name}</option>)}</select></label>
                <label>Guide<select value={editForm.guideId} onChange={event => {
                  const guide = guides.find(item => item._id === event.target.value);
                  setEditForm(current => ({ ...current, guideId: event.target.value, guideEmail: guide?.email || '' }));
                }}><option value="">Not Assigned</option>{guides.map(guide => <option key={guide._id} value={guide._id}>{guide.name}</option>)}</select></label>
                <label>Guide Email<input type="email" value={editForm.guideEmail || ''} onChange={event => setEditForm(current => ({ ...current, guideEmail: event.target.value }))} placeholder="guide@example.com" /></label>
                <label>Outcome<select value={editForm.outcome} onChange={event => setEditForm(current => ({ ...current, outcome: event.target.value }))}>{OUTCOMES.map(outcome => <option key={outcome}>{outcome}</option>)}</select></label>
                <label>Thrust Area<input value={editForm.thrustArea} onChange={event => setEditForm(current => ({ ...current, thrustArea: event.target.value }))} /></label>
                <label className="coordinator-full-field">Problem Title<input value={editForm.problemTitle} onChange={event => setEditForm(current => ({ ...current, problemTitle: event.target.value }))} /></label>
              </div>

              {error && (
                <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#b91c1c', borderRadius: '6px', marginBottom: '12px', fontSize: '13px', fontWeight: '500' }}>
                  ⚠️ {error}
                </div>
              )}

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
                    <th aria-label="Actions"></th>
                  </tr>
                </thead>
                <tbody>
                  {batches.length === 0 ? (
                    <tr><td colSpan="9">No teams have been added to this section.</td></tr>
                  ) : (
                    paginatedBatches.map(batch => (
                      <tr key={batch._id}>
                        <td><button className="coordinator-link" onClick={() => selectBatch(batch)}>{batch.teamName}</button></td>
                        <td>{formatMembersForDisplay(batch.teamMembers) || '-'}</td>
                        <td>{batch.guideId?.name || 'Not Assigned'}</td>
                        <td>{batch.domain || 'Not Assigned'}</td>
                        <td>{batch.thrustArea || '-'}</td>
                        <td>{batch.problemId?.title || 'Not Assigned'}</td>
                        <td>{batch.outcome || 'None'}</td>
                        <td>{batch.status}</td>
                        <td className="coordinator-actions-cell">
                          <div className="coordinator-row-actions">
                            <button className="coordinator-action coordinator-edit-action" title={`Edit ${batch.teamName}`} onClick={() => selectBatch(batch)}>Edit</button>
                            <button className="coordinator-action coordinator-delete-action" title={`Delete ${batch.teamName}`} onClick={() => deleteBatch(batch)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {batches.length > TEAMS_PAGE_SIZE && (
                <div className="coordinator-pagination">
                  <span className="coordinator-pagination-info">
                    Showing {(teamsPage - 1) * TEAMS_PAGE_SIZE + 1}–{Math.min(teamsPage * TEAMS_PAGE_SIZE, batches.length)} of {batches.length} teams
                  </span>
                  <div className="coordinator-pagination-controls">
                    <button
                      className="btn btn-secondary"
                      disabled={teamsPage === 1}
                      onClick={() => setTeamsPage(prev => Math.max(1, prev - 1))}
                    >
                      Previous
                    </button>
                    <div className="coordinator-page-numbers">
                      {Array.from({ length: teamsTotalPages }, (_, i) => i + 1)
                        .filter(page => {
                          if (teamsTotalPages <= 7) return true;
                          return page === 1 || page === teamsTotalPages || Math.abs(page - teamsPage) <= 1;
                        })
                        .map((page, idx, arr) => (
                          <span key={page} style={{ display: 'inline-flex', alignItems: 'center' }}>
                            {idx > 0 && arr[idx - 1] !== page - 1 && <span style={{ padding: '0 4px', color: '#94a3b8' }}>...</span>}
                            <button
                              className={`btn btn-sm ${page === teamsPage ? 'btn-primary' : 'btn-secondary'}`}
                              onClick={() => setTeamsPage(page)}
                              style={{ minWidth: '36px', height: '36px', padding: '0 8px', fontWeight: page === teamsPage ? '700' : '500' }}
                            >
                              {page}
                            </button>
                          </span>
                        ))}
                    </div>
                    <button
                      className="btn btn-secondary"
                      disabled={teamsPage >= teamsTotalPages}
                      onClick={() => setTeamsPage(prev => Math.min(teamsTotalPages, prev + 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
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
                  <colgroup>
                    <col className="marks-team-column" />
                    <col className="marks-student-column" />
                    <col className="marks-roll-column" />
                    {marksReport.columns.map(column => (
                      <Fragment key={`${column.key}-widths`}>
                        <col className="marks-score-column" />
                        <col className="marks-score-column" />
                        <col className="marks-score-column" />
                      </Fragment>
                    ))}
                    <col className="marks-total-column" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th rowSpan="2">Team</th>
                      <th rowSpan="2">Student</th>
                      <th rowSpan="2">Roll No</th>
                      {marksReport.columns.map(column => (
                        <th className={`marks-group-header marks-group-${column.key}`} key={column.key} colSpan="3">{column.label}<br /><span className="marks-subtext">/{column.max}</span></th>
                      ))}
                      <th className="marks-grand-total-header" rowSpan="2">Average<br /><span className="marks-subtext">/50</span></th>
                    </tr>
                    <tr>
                      {marksReport.columns.map(column => (
                        <Fragment key={`${column.key}-subheaders`}>
                          <th className="marks-group-start">Guide<br /><span className="marks-subtext">/{column.guideMax}</span></th>
                          <th>PRC<br /><span className="marks-subtext">/{column.prcMax}</span></th>
                          <th>Total<br /><span className="marks-subtext">/{column.max}</span></th>
                        </Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedMarksRows.length === 0 ? (
                      <tr><td colSpan={4 + (marksReport.columns.length * 3)}>No team data found.</td></tr>
                    ) : (
                      paginatedMarksRows.map((row, index) => (
                        <tr className={index === 0 || paginatedMarksRows[index - 1].teamKey !== row.teamKey ? 'marks-team-start' : ''} key={`${row.teamKey}-${row.memberName}-${index}`}>
                          {(index === 0 || paginatedMarksRows[index - 1].teamKey !== row.teamKey) && (
                            <td className="marks-team-cell" rowSpan={getTeamRowSpan(paginatedMarksRows, index)}><span>{row.teamName}</span></td>
                          )}
                          <td>{row.memberName}</td>
                          <td>{row.rollNumber}</td>
                          {marksReport.columns.map(column => (
                            <Fragment key={`${row.teamKey}-${row.memberName}-${column.key}`}>
                              <td className="marks-cell marks-group-start"><span className={`marks-value marks-value-${column.key} ${row[column.guideKey] > 0 ? 'marks-positive' : 'marks-neutral'}`}>{row[column.guideKey] ?? 0}</span></td>
                              <td className="marks-cell marks-prc-edit-cell">
                                {!row[`${column.key}GuideApproved`] ? (
                                  <span className={`marks-value marks-value-${column.key} marks-neutral`} aria-label="PRC marks unavailable until guide approval">0</span>
                                ) : editingMarkKey === `${row.teamKey}-${row.studentId}-${column.key}` ? (
                                  <form
                                    className="marks-inline-editor"
                                    onSubmit={event => {
                                      event.preventDefault();
                                      saveCoordinatorPrcMark(row, column);
                                    }}
                                  >
                                    <input
                                      autoFocus
                                      aria-label={`${column.label} PRC marks for ${row.memberName}`}
                                      type="number"
                                      min="0"
                                      max={MARK_COMPONENT_MAX}
                                      value={markDrafts[`${row.teamKey}-${row.studentId}-${column.key}`] ?? row[column.prcKey] ?? 0}
                                      onChange={event => setMarkDrafts(current => ({
                                        ...current,
                                        [`${row.teamKey}-${row.studentId}-${column.key}`]: event.target.value
                                      }))}
                                      onKeyDown={event => {
                                        if (event.key === 'Escape') setEditingMarkKey('');
                                      }}
                                    />
                                    <button
                                      className="marks-save-button"
                                      type="submit"
                                      aria-label="Save PRC marks"
                                      disabled={savingMarkKey === `${row.teamKey}-${row.studentId}-${column.key}`}
                                    >
                                      {savingMarkKey === `${row.teamKey}-${row.studentId}-${column.key}` ? '...' : '✓'}
                                    </button>
                                  </form>
                                ) : (
                                  <button
                                    className={`marks-value marks-value-${column.key} ${row[column.prcKey] > 0 ? 'marks-positive' : 'marks-neutral'} marks-edit-trigger`}
                                    type="button"
                                    aria-label={`Edit ${column.label} PRC marks for ${row.memberName}`}
                                    onClick={() => {
                                      const markKey = `${row.teamKey}-${row.studentId}-${column.key}`;
                                      setMarkDrafts(current => ({ ...current, [markKey]: row[column.prcKey] ?? 0 }));
                                      setEditingMarkKey(markKey);
                                    }}
                                  >
                                    {row[column.prcKey] ?? 0}
                                  </button>
                                )}
                              </td>
                              <td className="marks-cell"><span className={`marks-value marks-value-${column.key} ${row[column.totalKey] > 0 ? 'marks-positive' : 'marks-neutral'}`}>{row[column.totalKey] ?? 0}</span></td>
                            </Fragment>
                          ))}
                          <td className="marks-total-cell">
                            <strong>{Number((row.total / marksReport.columns.length).toFixed(2))}</strong>
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
