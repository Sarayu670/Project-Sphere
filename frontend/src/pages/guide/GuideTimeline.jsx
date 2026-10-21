import { useState, useEffect, useCallback, useRef } from 'react';
import * as api from '../../services/api';
import SubmissionReview from './SubmissionReview';
import usePolling from '../../utils/usePolling';

function GuideTimeline() {
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [batches, setBatches] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [submissionAlerts, setSubmissionAlerts] = useState([]);
  const [submissionFilter, setSubmissionFilter] = useState('all'); // 'all' | 'submitted' | 'not_submitted'
  const lastSeenSubmissionIds = useRef(new Set());

  // Reset submission filter when switching events
  useEffect(() => {
    setSubmissionFilter('all');
  }, [selectedEvent?._id]);

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
    const refFile = selectedEvent?.referenceFile
      || timelineEvents.find(item => item._id === selectedEvent?._id)?.referenceFile;
    return (
      <SubmissionReview
        submission={selectedSubmission}
        event={selectedEvent ? { ...selectedEvent, referenceFile: refFile } : null}
        onBack={() => setSelectedSubmission(null)}
        backLabel="Back to Submissions"
        breadcrumb={[
          { label: '🗓️ Timeline', onClick: () => { setSelectedSubmission(null); setSelectedEvent(null); } },
          { label: selectedEvent?.title, onClick: () => setSelectedSubmission(null) },
          { label: selectedSubmission.batchId?.teamName },
        ]}
        onChanged={fetchData}
      />
    );
  }

  if (selectedEvent) {
    const eventSubmissions = getSubmissionsForEvent(selectedEvent._id);
    const batchMap = batches.reduce((acc, b) => { acc[b._id] = b; return acc; }, {});

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <button className="back-nav-btn" onClick={() => setSelectedEvent(null)} style={{ marginBottom: 0 }}>
            <span className="nav-arrow">‹</span> Back to Timeline
          </button>
          
          <div className="breadcrumb-bar" style={{ margin: 0 }}>
            <button className="breadcrumb-link" onClick={() => setSelectedEvent(null)}>
              🗓️ Timeline
            </button>
            <span style={{ color: '#94a3b8', fontSize: '14px' }}>›</span>
            <span className="breadcrumb-current">
              {selectedEvent.title}
            </span>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid #667eea' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <h2 style={{ margin: '0 0 4px 0' }}>{selectedEvent.title}</h2>
              <p style={{ color: '#666', margin: '0 0 12px 0' }}>{selectedEvent.description}</p>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                <span><strong>📅 Deadline:</strong> {new Date(selectedEvent.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                {selectedEvent.isMarksEnabled !== false && <span><strong>🎯 Max Marks:</strong> {selectedEvent.maxMarks}</span>}
              </div>
            </div>
            {(() => {
              const submittedCount = eventSubmissions.length;
              const totalBatchesCount = batches.length;
              const notSubmittedCount = Math.max(0, totalBatchesCount - submittedCount);
              return (
                <div style={{ display: "flex", gap: "10px", flexShrink: 0, alignItems: "center" }}>
                  <div style={{ textAlign: "center", padding: "10px 16px", background: "#dcfce7", borderRadius: "10px", border: "1px solid #86efac" }}>
                    <div style={{ fontSize: "22px", fontWeight: "700", color: "#16a34a" }}>{submittedCount}</div>
                    <div style={{ fontSize: "11px", color: "#15803d", fontWeight: "600" }}>✅ Submitted</div>
                  </div>
                  <div style={{ textAlign: "center", padding: "10px 16px", background: "#fee2e2", borderRadius: "10px", border: "1px solid #fca5a5" }}>
                    <div style={{ fontSize: "22px", fontWeight: "700", color: "#dc2626" }}>{notSubmittedCount}</div>
                    <div style={{ fontSize: "11px", color: "#b91c1c", fontWeight: "600" }}>❌ Not Submitted</div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ margin: 0 }}>Team Submissions</h3>
          {/* Submitted / Not Submitted toggle */}
          <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '8px', padding: '3px', gap: '2px' }}>
            {[
              { value: 'all', label: 'All Teams' },
              { value: 'submitted', label: '✅ Submitted' },
              { value: 'not_submitted', label: '❌ Not Submitted' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setSubmissionFilter(opt.value)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  transition: 'all 0.15s',
                  background: submissionFilter === opt.value ? '#667eea' : 'transparent',
                  color: submissionFilter === opt.value ? 'white' : '#64748b',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {(() => {
          const submittedBatchIds = new Set(eventSubmissions.map(s => typeof s.batchId === 'object' ? s.batchId?._id : s.batchId));
          
          let displayItems = [];
          if (submissionFilter !== 'not_submitted') {
            eventSubmissions.forEach(sub => {
              const batch = batchMap[sub.batchId?._id || sub.batchId];
              if (batch) {
                displayItems.push({ type: 'submitted', sub, batch });
              }
            });
          }
          if (submissionFilter !== 'submitted') {
            batches.forEach(batch => {
              if (!submittedBatchIds.has(batch._id)) {
                displayItems.push({ type: 'not_submitted', batch });
              }
            });
          }

          if (displayItems.length === 0) {
            return (
              <div className="card empty-state">
                <h3>No Teams Found</h3>
                <p>No teams match the selected filter ({submissionFilter}).</p>
              </div>
            );
          }

          return (
            <div className="grid grid-2">
              {displayItems.map(item => {
                if (item.type === 'submitted') {
                  const { sub, batch } = item;
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
                            {(() => {
                              const uniqueStudents = new Set(
                                (sub.studentMarks || [])
                                  .map(sm => (sm.studentId?._id || sm.studentId)?.toString())
                                  .filter(Boolean)
                              );
                              const count = uniqueStudents.size;
                              if (count > 0) {
                                return `Individual (${count} students)`;
                              }
                              return sub.marks !== null && sub.marks !== undefined ? `${sub.marks}/${selectedEvent.maxMarks}` : '-';
                            })()}
                          </span>
                        </p>
                      )}
                      <p style={{ margin: '4px 0', fontSize: '14px', lineHeight: '1.6', display: 'flex', alignItems: 'center', gap: '12px' }}><strong>Submission:</strong> <span>v{sub.currentVersion}</span></p>
                      <div className="batch-action" style={{ marginTop: '6px', fontSize: '14px', color: '#667eea', fontWeight: '700' }}>Review Submission →</div>
                    </div>
                  );
                } else {
                  const { batch } = item;
                  return (
                    <div key={`ns-${batch._id}`} className="card" style={{ background: '#fff8f8', border: '1px solid #fee2e2', opacity: 0.9, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div className="batch-icon">⏳</div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 style={{ margin: '0 0 2px 0', fontSize: '16px' }}>{batch.teamName}</h3>
                        <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: '600', background: '#fee2e2', padding: '2px 8px', borderRadius: '12px' }}>
                          ❌ Not Submitted
                        </span>
                      </div>
                      <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#666', lineHeight: '1.4' }}>{batch.year} Year • {batch.branch} • Section {batch.section}</p>
                      <p style={{ margin: '4px 0', fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>Awaiting submission from team members</p>
                    </div>
                  );
                }
              })}
            </div>
          );
        })()}
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

                <div className="timeline-card__meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="timeline-card__meta-label">{!unlocked ? 'Unlock after previous acceptance' : 'Teams Submissions'}</span>
                  <span className="timeline-card__meta-value">
                    {!unlocked ? '—' : (
                      <div style={{ display: 'flex', gap: '6px', fontSize: '12px' }}>
                        <span style={{ color: '#16a34a', fontWeight: '600', background: '#dcfce7', padding: '2px 8px', borderRadius: '12px' }}>
                          ✅ {totalSubs} Submitted
                        </span>
                        <span style={{ color: '#dc2626', fontWeight: '600', background: '#fee2e2', padding: '2px 8px', borderRadius: '12px' }}>
                          ❌ {Math.max(0, batches.length - totalSubs)} Pending
                        </span>
                      </div>
                    )}
                  </span>
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

    </div>
  );
}

export default GuideTimeline;