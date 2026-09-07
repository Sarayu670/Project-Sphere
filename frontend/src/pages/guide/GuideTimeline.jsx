import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '../../services/api';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import usePolling from '../../utils/usePolling';

function GuideTimeline() {
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [batches, setBatches] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [comment, setComment] = useState('');
  const [studentMarkInputs, setStudentMarkInputs] = useState({}); // { studentId: marksValue }
  const [isEditingMarks, setIsEditingMarks] = useState(false);
  const [batchStudents, setBatchStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [dialog, setDialog] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: null });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [submissionAlerts, setSubmissionAlerts] = useState([]);
  const lastSeenSubmissionIds = useRef(new Set());

  const fetchData = useCallback(async () => {
    try {
      const eventsRes = await api.getAllTimelineEvents();
      const batchesRes = await api.getMyBatches();
      const submissionsRes = await api.getGuideSubmissions();

      const eventsData = eventsRes.data?.data || eventsRes.data || [];
      const batchesData = batchesRes.data?.data || batchesRes.data || [];
      const submissionsData = submissionsRes.data?.data || submissionsRes.data || [];

      const relevantStatuses = ['submitted', 'under_review', 'needs_revision'];
      const currentIds = new Set(submissionsData.map(item => item._id));
      const previousIds = lastSeenSubmissionIds.current;
      const newlySeen = submissionsData.filter(submission => {
        const validStatus = relevantStatuses.includes(submission.status);
        const isNew = !previousIds.has(submission._id);
        return validStatus && isNew;
      });

      if (previousIds.size > 0 && newlySeen.length > 0) {
        const alerts = newlySeen.slice(0, 3).map(submission => {
          const batch = typeof submission.batchId === 'object' ? submission.batchId : batchesData.find(item => item._id === submission.batchId);
          const event = typeof submission.timelineEventId === 'object' ? submission.timelineEventId : eventsData.find(item => item._id === submission.timelineEventId);
          return {
            id: submission._id,
            team: batch?.teamName || 'Team',
            eventTitle: event?.title || 'Timeline event',
            status: submission.status
          };
        });
        setSubmissionAlerts(alerts);
      }

      lastSeenSubmissionIds.current = currentIds;
      setTimelineEvents(eventsData);
      setBatches(batchesData);
      setSubmissions(submissionsData);

      setSelectedSubmission(prev => {
        if (!prev) return prev;
        const updated = submissionsData.find(s => s._id === prev._id);
        return updated || prev;
      });

      setLastUpdated(new Date());
      setLoading(false);
    } catch (error) {
      console.error('❌ Failed to fetch data:', error.message);
      setTimelineEvents([]);
      setBatches([]);
      setSubmissions([]);
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-poll every 20s: picks up new admin timeline events + student submissions
  usePolling(fetchData, 20000);

  // Fetch batch students when selectedSubmission changes
  useEffect(() => {
    if (!selectedSubmission) {
      setBatchStudents([]);
      setStudentMarkInputs({});
      setIsEditingMarks(false);
      return;
    }

    const batchId = typeof selectedSubmission.batchId === 'string'
      ? selectedSubmission.batchId
      : selectedSubmission.batchId?._id;

    if (!batchId) return;

    setLoadingStudents(true);
    api.getBatchStudents(batchId)
      .then(res => {
        const students = res.data.data || [];
        setBatchStudents(students);

        // Pre-fill inputs from existing studentMarks if already assigned
        const existing = {};
        if (Array.isArray(selectedSubmission.studentMarks)) {
          selectedSubmission.studentMarks.forEach(sm => {
            const sid = typeof sm.studentId === 'object' ? sm.studentId?._id : sm.studentId;
            if (sid) {
              existing[sid] = sm.marks !== null && sm.marks !== undefined ? String(sm.marks) : '';
            }
          });
        }
        // Fill blanks for any student not yet marked
        students.forEach(s => {
          if (!(s._id in existing)) existing[s._id] = '';
        });
        setStudentMarkInputs(existing);
        setIsEditingMarks(false);
      })
      .catch(err => {
        console.error('Failed to fetch batch students', err);
        setBatchStudents([]);
      })
      .finally(() => setLoadingStudents(false));
  }, [selectedSubmission?._id]);

  const getLastUpdatedText = () => {
    if (!lastUpdated) return '';
    const diff = Math.round((Date.now() - lastUpdated.getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    return `${Math.round(diff / 60)}m ago`;
  };

  const getSubmissionsForEvent = (eventId) => {
    return submissions.filter(s => {
      const subEventId = typeof s.timelineEventId === 'string'
        ? s.timelineEventId
        : s.timelineEventId?._id;
      return subEventId === eventId;
    });
  };

  const handleAddComment = async () => {
    if (!comment.trim()) {
      showDialog('Error', 'Please enter a comment', 'danger');
      return;
    }
    try {
      await api.addSubmissionComment(selectedSubmission._id, comment);
      const res = await api.getSubmission(selectedSubmission._id);
      setSelectedSubmission(res.data.data);
      setComment('');
      showDialog('Success', 'Comment added successfully', 'success');
    } catch (error) {
      console.error('Error adding comment:', error);
      showDialog('Error', error.response?.data?.message || 'Failed to add comment', 'danger');
    }
  };

  const handleAssignMarks = async (status) => {
    const isMarksDisabled = selectedEvent?.isMarksEnabled === false || selectedEvent?.isMarksEnabled === 'false';
    const isMarksEnabled = !isMarksDisabled;

    if (isMarksEnabled && status === 'accepted') {
      if (batchStudents.length === 0) {
        showDialog('Error', 'No students found in this batch to assign marks.', 'danger');
        return;
      }

      // Check if any student marks are missing or exceed max marks
      const missing = batchStudents.filter(s =>
        studentMarkInputs[s._id] === '' ||
        studentMarkInputs[s._id] === undefined ||
        studentMarkInputs[s._id] === null
      );

      if (missing.length > 0) {
        showDialog('Error', `Please enter marks for all students. Missing: ${missing.map(s => s.name || s.rollNumber).join(', ')}`, 'danger');
        return;
      }

      const invalid = batchStudents.filter(s => {
        const val = parseFloat(studentMarkInputs[s._id]);
        return isNaN(val) || val < 0 || val > selectedEvent.maxMarks;
      });

      if (invalid.length > 0) {
        showDialog('Error', `Marks must be between 0 and ${selectedEvent.maxMarks}. Please check entered marks.`, 'danger');
        return;
      }
    }

    try {
      const studentMarks = batchStudents.map(s => ({
        studentId: s._id,
        marks: studentMarkInputs[s._id] !== '' && studentMarkInputs[s._id] !== undefined
          ? parseFloat(studentMarkInputs[s._id])
          : null
      }));

      await api.assignSubmissionMarks(selectedSubmission._id, {
        status,
        comment,
        studentMarks: isMarksEnabled ? studentMarks : []
      });

      const res = await api.getSubmission(selectedSubmission._id);
      setSelectedSubmission(res.data.data);
      fetchData();
      setIsEditingMarks(false);
      setComment('');
      showDialog('Success', status === 'accepted' ? 'Marks assigned successfully!' : 'Revision requested successfully.', 'success');
    } catch (error) {
      showDialog('Error', error.response?.data?.message || 'Failed to assign marks', 'danger');
    }
  };

  const showDialog = (title, message, type = 'info') => {
    setDialog({
      isOpen: true,
      title,
      message,
      type,
      onConfirm: () => {
        setDialog({ ...dialog, isOpen: false });
      }
    });
  };

  const getStatusBadge = (status) => {
    const colors = { not_started: 'secondary', submitted: 'info', under_review: 'warning', needs_revision: 'warning', accepted: 'success', rejected: 'danger' };
    const labels = { not_started: 'Not Started', submitted: 'Submitted', under_review: 'Under Review', needs_revision: 'Needs Revision', accepted: 'Accepted', rejected: 'Rejected' };
    return <span className={`badge badge-${colors[status] || 'info'}`}>{labels[status] || status}</span>;
  };

  const getDeadlineStatus = (deadline) => {
    const now = new Date();
    const dl = new Date(deadline);
    const diff = (dl - now) / (1000 * 60 * 60 * 24);
    if (diff < 0) return { text: 'Past Due', color: '#ef4444' };
    if (diff < 3) return { text: `${Math.ceil(diff)} days left`, color: '#f59e0b' };
    return { text: `${Math.ceil(diff)} days left`, color: '#22c55e' };
  };

  const isEventUnlocked = (eventIndex) => {
    if (eventIndex === 0) return true;
    const previousEvent = timelineEvents[eventIndex - 1];
    if (!previousEvent) return true;
    const previousSubmission = submissions.find(submission => {
      const eventId = typeof submission.timelineEventId === 'string'
        ? submission.timelineEventId
        : submission.timelineEventId?._id;
      return eventId === previousEvent._id;
    });
    return previousSubmission?.status === 'accepted';
  };

  if (loading && timelineEvents.length === 0) return (
    <div style={{ padding: '20px' }}>
      {[1, 2, 3].map(i => (
        <div key={i} className="card" style={{ marginBottom: '15px', opacity: 0.5 }}>
          <div style={{ height: '18px', background: '#e2e8f0', borderRadius: '4px', width: '55%', marginBottom: '10px' }} />
          <div style={{ height: '12px', background: '#e2e8f0', borderRadius: '4px', width: '80%' }} />
        </div>
      ))}
    </div>
  );

  if (selectedSubmission) {
    const submission = selectedSubmission;
    if (!submission) return <div>No submission found</div>;

    const isMarksDisabled = selectedEvent?.isMarksEnabled === false || selectedEvent?.isMarksEnabled === 'false';
    const isMarksEnabled = !isMarksDisabled;
    const hasStudentMarks = Array.isArray(submission.studentMarks) && submission.studentMarks.length > 0;
    const canEditMarks = isMarksEnabled && (submission.status === 'submitted' || submission.status === 'under_review' || submission.status === 'needs_revision' || submission.status === 'accepted');
    const markFormVisible = isMarksEnabled && (isEditingMarks || !hasStudentMarks);

    return (
      <div>
        <button className="btn btn-secondary" onClick={() => setSelectedSubmission(null)} style={{ marginBottom: '20px' }}>← Back to Submissions</button>

        <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid #667eea' }}>
          <h2>{selectedEvent.title} - {submission.batchId?.teamName}</h2>
          <p style={{ color: '#666' }}>{selectedEvent.description}</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', marginTop: '15px', alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <strong>📅 Deadline:</strong> {new Date(selectedEvent.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            {isMarksEnabled && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <strong>🎯 Max Marks:</strong> {selectedEvent.maxMarks}
              </span>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <strong>Status:</strong> {getStatusBadge(submission.status)}
            </div>
          </div>
          {selectedEvent.submissionRequirements && (
            <div style={{ marginTop: '15px', padding: '10px', background: '#f8fafc', borderRadius: '8px' }}>
              <strong>📋 What to Submit:</strong><br />
              <span style={{ color: '#666' }}>{selectedEvent.submissionRequirements}</span>
            </div>
          )}
        </div>

        {/* Display Assigned Individual Marks if available */}
        {isMarksEnabled && hasStudentMarks && !isEditingMarks && (
          <div className="card" style={{ marginBottom: '20px', background: '#f0fdf4', border: '1px solid #86efac' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <h3 style={{ color: '#166534', margin: 0 }}>✅ Assigned Marks (Individual)</h3>
              {canEditMarks && (
                <button className="btn btn-primary" onClick={() => {
                  const existing = {};
                  if (Array.isArray(submission.studentMarks)) {
                    submission.studentMarks.forEach(sm => {
                      const sid = typeof sm.studentId === 'object' ? sm.studentId?._id : sm.studentId;
                      if (sid) {
                        existing[sid] = sm.marks !== null && sm.marks !== undefined ? String(sm.marks) : '';
                      }
                    });
                  }
                  setStudentMarkInputs(existing);
                  setIsEditingMarks(true);
                }}>
                  ✏️ Edit Marks
                </button>
              )}
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Roll Number</th>
                  <th>Student Name</th>
                  <th>Marks (out of {selectedEvent.maxMarks})</th>
                </tr>
              </thead>
              <tbody>
                {submission.studentMarks.map((sm, idx) => (
                  <tr key={idx}>
                    <td><strong>{sm.studentId?.rollNumber || '—'}</strong></td>
                    <td>{sm.studentId?.name || '—'}</td>
                    <td><strong style={{ color: '#166534' }}>{sm.marks !== null && sm.marks !== undefined ? sm.marks : '—'}</strong> / {selectedEvent.maxMarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Fallback for legacy group marks */}
        {isMarksEnabled && !hasStudentMarks && submission.marks !== null && submission.marks !== undefined && (
          <div className="card" style={{ marginBottom: '20px', background: '#f0fdf4', border: '1px solid #22c55e' }}>
            <h3 style={{ color: '#22c55e' }}>✅ Marks Assigned (Group)</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e' }}>{submission.marks} / {selectedEvent.maxMarks}</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="card">
            <h3>📄 Submission History</h3>
            {!submission.versions?.length ? (
              <p style={{ color: '#888' }}>No submissions yet</p>
            ) : (
              <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
                {submission.versions.map((v, idx) => (
                  <div key={idx} style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>Submission {v.version}</strong>
                      <small>{new Date(v.submittedAt).toLocaleString()}</small>
                    </div>
                    {v.description && <p style={{ color: '#666', fontSize: '14px', margin: '5px 0' }}>{v.description}</p>}
                    <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                      {v.driveLink && <a href={v.driveLink} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">📁 View</a>}
                      {v.fileUrl && <a href={v.fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">📁 View</a>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="card" style={{ maxWidth: '100%', minWidth: '0', overflow: 'hidden' }}>
              <h3>💬 Guide Feedback</h3>
              {!submission.comments?.length ? (
                <p style={{ color: '#888' }}>No feedback yet</p>
              ) : (
                <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                  {submission.comments.map((c, idx) => (
                    <div key={idx} style={{ padding: '10px', background: '#fef3c7', borderRadius: '8px', marginBottom: '10px', maxWidth: '100%', minWidth: '0', wordWrap: 'break-word', overflowWrap: 'break-word', overflow: 'hidden', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', minWidth: '0' }}>
                        <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>👨‍🏫 {c.guideId?.name || 'Guide'}</strong>
                        <small style={{ whiteSpace: 'nowrap', marginLeft: '10px' }}>{new Date(c.createdAt).toLocaleString()}</small>
                      </div>
                      <p style={{ margin: '0', color: '#92400e', maxWidth: '100%', wordWrap: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap', wordBreak: 'break-word', minWidth: '0' }}>{c.comment}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {submission.adminRemarks?.length > 0 && (
              <div className="card" style={{ background: '#f0f9ff', borderColor: '#bae6fd' }}>
                <h3 style={{ color: '#0369a1' }}>🛡️ Admin Feedback</h3>
                <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                  {submission.adminRemarks
                    .filter((r, idx, self) =>
                      idx === self.findIndex((t) => (
                        t.remark === r.remark && (new Date(t.createdAt) - new Date(r.createdAt)) < 60000 && (new Date(t.createdAt) - new Date(r.createdAt)) > -60000
                      ))
                    )
                    .map((r, idx) => (
                      <div key={idx} style={{ padding: '10px', borderBottom: idx !== submission.adminRemarks.length - 1 ? '1px solid #e0f2fe' : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                          <strong style={{ color: '#0c4a6e' }}>🛡️ {r.adminId?.name || 'Admin'}</strong>
                          <small style={{ color: '#64748b' }}>{new Date(r.createdAt).toLocaleString()}</small>
                        </div>
                        <p style={{ margin: '0', color: '#0c4a6e', fontSize: '14px', whiteSpace: 'pre-wrap' }}>{r.remark}</p>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {['submitted', 'under_review', 'accepted', 'needs_revision'].includes(submission.status) && markFormVisible && (
          <div className="card" style={{ marginTop: '20px' }}>
            <h3>🎯 {isMarksDisabled ? 'Review Decision' : hasStudentMarks && isEditingMarks ? 'Edit Individual Marks' : 'Assign Individual Marks'}</h3>
            
            {isMarksEnabled && (
              <div style={{ marginBottom: '15px' }}>
                <p style={{ color: '#666', marginBottom: '12px' }}>
                  Max Marks: <strong>{selectedEvent.maxMarks}</strong> — Enter marks for each student individually.
                </p>

                {loadingStudents ? (
                  <p style={{ color: '#888' }}>Loading students...</p>
                ) : batchStudents.length === 0 ? (
                  <p style={{ color: '#e53e3e' }}>⚠️ No students found in this batch.</p>
                ) : (
                  <div style={{ overflowX: 'auto', marginBottom: '15px' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Roll Number</th>
                          <th>Student Name</th>
                          <th>Marks (out of {selectedEvent.maxMarks})</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchStudents.map(student => (
                          <tr key={student._id}>
                            <td><strong>{student.rollNumber}</strong></td>
                            <td>{student.name}</td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                max={selectedEvent.maxMarks}
                                value={studentMarkInputs[student._id] ?? ''}
                                onChange={e => setStudentMarkInputs(prev => ({ ...prev, [student._id]: e.target.value }))}
                                placeholder="Enter marks"
                                style={{ width: '110px' }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px' }}>
              <button className="btn btn-primary" onClick={() => handleAssignMarks('accepted')}>
                {isMarksEnabled ? (hasStudentMarks || isEditingMarks ? '✅ Update Marks' : '✅ Accept & Assign Marks') : '✅ Accept Submission'}
              </button>
              {hasStudentMarks && isEditingMarks && (
                <button className="btn btn-secondary" onClick={() => {
                  const existing = {};
                  if (Array.isArray(submission.studentMarks)) {
                    submission.studentMarks.forEach(sm => {
                      const sid = typeof sm.studentId === 'object' ? sm.studentId?._id : sm.studentId;
                      if (sid) {
                        existing[sid] = sm.marks !== null && sm.marks !== undefined ? String(sm.marks) : '';
                      }
                    });
                  }
                  setStudentMarkInputs(existing);
                  setIsEditingMarks(false);
                }}>
                  Cancel
                </button>
              )}
              <button className="btn btn-warning" onClick={() => handleAssignMarks('needs_revision')}>
                🔄 Request Revision
              </button>
            </div>

            <div className="form-group">
              <label style={{ marginBottom: '8px', display: 'block' }}>Add Feedback (Optional):</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Add feedback or revision comments..."
                style={{ width: '100%' }}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  if (selectedEvent) {
    const eventSubmissions = getSubmissionsForEvent(selectedEvent._id);
    const batchMap = batches.reduce((acc, b) => { acc[b._id] = b; return acc; }, {});

    return (
      <div>
        <button className="btn btn-secondary" onClick={() => setSelectedEvent(null)} style={{ marginBottom: '20px' }}>← Back to Timeline</button>

        <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid #667eea' }}>
          <h2>{selectedEvent.title}</h2>
          <p style={{ color: '#666' }}>{selectedEvent.description}</p>
          <div style={{ display: 'flex', gap: '20px', marginTop: '15px' }}>
            <span><strong>📅 Deadline:</strong> {new Date(selectedEvent.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            {selectedEvent.isMarksEnabled !== false && <span><strong>🎯 Max Marks:</strong> {selectedEvent.maxMarks}</span>}
          </div>
        </div>

        <h3>Team Submissions</h3>
        {eventSubmissions.length === 0 ? (
          <div className="card empty-state"><h3>No Submissions</h3><p>No teams have submitted for this event yet</p></div>
        ) : (
          <div className="grid grid-2">
            {eventSubmissions.map(sub => {
              const batch = batchMap[sub.batchId._id];
              if (!batch) return null;
              return (
                <div key={sub._id} className="card" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px' }} onClick={() => setSelectedSubmission(sub)}>
                  <div className="batch-icon">📄</div>
                  <h3 style={{ margin: '0 0 2px 0', fontSize: '16px' }}>{batch.teamName}</h3>
                  <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#666', lineHeight: '1.4' }}>{batch.year} Year • {batch.branch} • Section {batch.section}</p>
                  <p style={{ margin: '4px 0', fontSize: '14px', lineHeight: '1.6', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <strong>Status:</strong>
                    {getStatusBadge(sub.status)}
                  </p>
                  {(selectedEvent.isMarksEnabled !== false && selectedEvent.isMarksEnabled !== 'false') && (
                    <p style={{ margin: '4px 0', fontSize: '14px', lineHeight: '1.6', display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <strong>Marks:</strong>{' '}
                      <span>
                        {Array.isArray(sub.studentMarks) && sub.studentMarks.length > 0
                          ? `Individual (${sub.studentMarks.length} students)`
                          : sub.marks !== null ? `${sub.marks}/${selectedEvent.maxMarks}` : '-'}
                      </span>
                    </p>
                  )}
                  <p style={{ margin: '4px 0', fontSize: '14px', lineHeight: '1.6', display: 'flex', alignItems: 'center', gap: '12px' }}><strong>Submission:</strong> <span>{sub.currentVersion}</span></p>
                  <div className="batch-action" style={{ marginTop: '6px', fontSize: '14px', color: '#667eea', fontWeight: '700' }}>Review Submission →</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="guide-timeline-shell">
      <div className="guide-timeline-header">
        <div>
          <h2 className="section-title">📅 Project Timeline</h2>
          <p className="section-subtitle">Review submissions from your teams across all timeline events</p>
        </div>
        {submissionAlerts.length > 0 && (
          <button className="clear-alert-btn" onClick={() => setSubmissionAlerts([])}>Clear</button>
        )}
      </div>

      {submissionAlerts.length > 0 && (
        <div className="submission-alert-banner" role="alert">
          <div className="submission-alert-icon">🔔</div>
          <div className="submission-alert-copy">
            <strong>New submission received</strong>
            <span>
              {submissionAlerts.map(item => `${item.team} • ${item.eventTitle}`).join(' | ')}
            </span>
          </div>
        </div>
      )}

      {timelineEvents.length === 0 ? (
        <div className="card empty-state"><h3>No Timeline Events</h3><p>Timeline events will appear here once admin creates them</p></div>
      ) : (
        <div className="timeline-list">
          {timelineEvents.map((event, idx) => {
            const eventSubs = getSubmissionsForEvent(event._id);
            const acceptedCount = eventSubs.filter(s => s.status === 'accepted').length;
            const totalSubs = eventSubs.length;
            const deadlineStatus = getDeadlineStatus(event.deadline);
            const hasNewSubmission = eventSubs.some(sub => ['submitted', 'under_review', 'needs_revision'].includes(sub.status));
            const unlocked = isEventUnlocked(idx);

            return (
              <div
                key={event._id}
                className={`timeline-card ${hasNewSubmission ? 'timeline-card--new' : ''} ${!unlocked ? 'timeline-card--locked' : ''}`}
                onClick={() => unlocked && setSelectedEvent(event)}
                style={!unlocked ? { pointerEvents: 'auto', cursor: 'not-allowed', opacity: 0.7 } : {}}
              >
                <div className="timeline-card__header">
                  <div className="timeline-card__title-wrap">
                    <span className="timeline-card__index">{idx + 1}</span>
                    <div>
                      <h3>{event.title}</h3>
                    </div>
                  </div>
                  <div className="timeline-card__deadline" style={{ color: !unlocked ? '#64748b' : deadlineStatus.color }}>
                    {!unlocked ? 'Locked' : deadlineStatus.text}
                    <small>{new Date(event.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</small>
                  </div>
                </div>

                <div className="timeline-card__meta">
                  <span className="timeline-card__meta-label">{!unlocked ? 'Unlock after previous acceptance' : 'Submissions'}</span>
                  <span className="timeline-card__meta-value">{!unlocked ? '—' : `${acceptedCount}/${totalSubs} accepted`}</span>
                </div>

                {!unlocked ? (
                  <div className="timeline-card__alert timeline-card__alert--locked">
                    <span className="timeline-card__alert-dot" />
                    Complete previous milestone first
                  </div>
                ) : hasNewSubmission ? (
                  <div className="timeline-card__alert">
                    <span className="timeline-card__alert-dot" />
                    New submission received
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmationDialog
        isOpen={dialog.isOpen}
        title={dialog.title}
        message={dialog.message}
        type={dialog.type}
        onConfirm={dialog.onConfirm}
        onCancel={dialog.onConfirm}
      />
    </div>
  );
}

export default GuideTimeline;