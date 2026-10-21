import { useState, useEffect, useCallback, useMemo } from 'react';
import * as api from '../../services/api';
import usePolling from '../../utils/usePolling';
import SubmissionReview, { getSubmissionStatusBadge } from './SubmissionReview';

const AWAITING_REVIEW = ['submitted', 'under_review'];

const getId = (value) => (value && typeof value === 'object' ? value._id : value);

const getDeadlineStatus = (deadline) => {
  const diff = (new Date(deadline) - new Date()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return { text: 'Past Due', color: '#ef4444' };
  if (diff < 3) return { text: `${Math.ceil(diff)} days left`, color: '#f59e0b' };
  return { text: `${Math.ceil(diff)} days left`, color: '#22c55e' };
};

const formatDate = (date) => new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Team-centric timeline for the guide: lists every milestone that applies to
 * this team's year/branch along with the team's submission status, and opens
 * the shared SubmissionReview screen inline.
 */
function BatchTimeline({ batch }) {
  const [events, setEvents] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState(null);

  const fetchData = useCallback(async () => {
    if (!batch?._id) return;
    try {
      const [eventsRes, submissionsRes] = await Promise.all([
        api.getAllTimelineEvents(),
        api.getGuideSubmissions()
      ]);
      const allEvents = eventsRes.data?.data || eventsRes.data || [];
      const allSubs = submissionsRes.data?.data || submissionsRes.data || [];

      // Only milestones that apply to this team's year and branch
      const teamEvents = allEvents.filter(event => {
        const yearOk = !event.targetYear || event.targetYear === 'all' || event.targetYear === batch.year;
        const deptOk = !event.department || event.department === 'ALL' || event.department === batch.branch;
        return yearOk && deptOk;
      });

      setEvents(teamEvents);
      setSubmissions(allSubs.filter(sub => String(getId(sub.batchId)) === String(batch._id)));
    } catch (error) {
      console.error('Failed to fetch team timeline:', error.message);
    } finally {
      setLoading(false);
    }
  }, [batch?._id, batch?.year, batch?.branch]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 20s for new submissions / status changes
  usePolling(fetchData, 20000);

  const submissionByEvent = useMemo(() => {
    const map = {};
    submissions.forEach(sub => { map[String(getId(sub.timelineEventId))] = sub; });
    return map;
  }, [submissions]);

  const summary = useMemo(() => {
    const counts = { accepted: 0, awaiting: 0, revision: 0, notSubmitted: 0 };
    events.forEach(event => {
      const sub = submissionByEvent[event._id];
      if (!sub) counts.notSubmitted += 1;
      else if (sub.status === 'accepted') counts.accepted += 1;
      else if (AWAITING_REVIEW.includes(sub.status)) counts.awaiting += 1;
      else if (sub.status === 'needs_revision') counts.revision += 1;
    });
    return counts;
  }, [events, submissionByEvent]);

  // Time-based locking: a milestone opens once the previous milestone's deadline has passed
  const isUnlocked = (idx) => {
    if (idx === 0) return true;
    const prev = events[idx - 1];
    if (!prev?.deadline) return true;
    return new Date() > new Date(prev.deadline);
  };

  const selectedEvent = events.find(e => e._id === selectedEventId);
  const selectedSubmission = selectedEvent ? submissionByEvent[selectedEvent._id] : null;

  if (selectedEvent && selectedSubmission) {
    return (
      <SubmissionReview
        submission={selectedSubmission}
        event={selectedEvent}
        onBack={() => setSelectedEventId(null)}
        backLabel="Back to Team Timeline"
        breadcrumb={[
          { label: `👥 ${batch.teamName}`, onClick: () => setSelectedEventId(null) },
          { label: '🗓️ Timeline', onClick: () => setSelectedEventId(null) },
          { label: selectedEvent.title }
        ]}
        onChanged={fetchData}
      />
    );
  }

  if (loading) {
    return (
      <div>
        {[1, 2, 3].map(i => (
          <div key={i} className="card" style={{ marginBottom: '15px', opacity: 0.5 }}>
            <div style={{ height: '18px', background: '#e2e8f0', borderRadius: '4px', width: '55%', marginBottom: '10px' }} />
            <div style={{ height: '12px', background: '#e2e8f0', borderRadius: '4px', width: '80%' }} />
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="card empty-state">
        <h3>No Timeline Events</h3>
        <p>No milestones have been created for {batch.year || 'this'} year yet.</p>
      </div>
    );
  }

  const summaryChip = (bg, color, text) => (
    <span style={{ background: bg, color, fontWeight: 600, fontSize: '13px', padding: '6px 12px', borderRadius: '999px' }}>{text}</span>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '18px' }}>
        {summaryChip('#dcfce7', '#15803d', `✅ ${summary.accepted} Accepted`)}
        {summaryChip('#dbeafe', '#1d4ed8', `🕒 ${summary.awaiting} Awaiting Review`)}
        {summary.revision > 0 && summaryChip('#fef3c7', '#b45309', `🔄 ${summary.revision} Needs Revision`)}
        {summaryChip('#fee2e2', '#b91c1c', `❌ ${summary.notSubmitted} Not Submitted`)}
      </div>

      <div className="timeline-list">
        {events.map((event, idx) => {
          const sub = submissionByEvent[event._id];
          const unlocked = isUnlocked(idx) || Boolean(sub);
          const clickable = Boolean(sub);
          const needsReview = sub && AWAITING_REVIEW.includes(sub.status);
          const deadlineStatus = getDeadlineStatus(event.deadline);
          const marksEnabled = event.isMarksEnabled !== false && event.isMarksEnabled !== 'false';
          const studentMarkCount = new Set(
            (sub?.studentMarks || []).map(sm => String(getId(sm.studentId))).filter(Boolean)
          ).size;

          let marksText = null;
          if (marksEnabled && sub) {
            if (studentMarkCount > 0) marksText = `Individual marks assigned (${studentMarkCount})`;
            else if (sub.marks !== null && sub.marks !== undefined) marksText = `${sub.marks} / ${event.maxMarks}`;
          }

          return (
            <div
              key={event._id}
              className={`timeline-card ${needsReview ? 'timeline-card--new' : ''} ${!unlocked ? 'timeline-card--locked' : ''}`}
              onClick={() => clickable && setSelectedEventId(event._id)}
              style={{ cursor: clickable ? 'pointer' : 'default', opacity: unlocked ? 1 : 0.7 }}
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
                  <small>{formatDate(event.deadline)}</small>
                </div>
              </div>

              <div className="timeline-card__meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '13px', color: '#475569' }}>
                  {sub ? getSubmissionStatusBadge(sub.status) : (
                    <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 600, background: '#fee2e2', padding: '2px 10px', borderRadius: '12px' }}>
                      ❌ Not Submitted
                    </span>
                  )}
                  {sub?.currentVersion > 0 && <span>Version: <strong>v{sub.currentVersion}</strong></span>}
                  {marksText && <span>🎯 {marksText}</span>}
                </div>
                {clickable && (
                  <span style={{ fontSize: '14px', color: '#667eea', fontWeight: 700 }}>Review Submission →</span>
                )}
              </div>

              {!unlocked ? (
                <div className="timeline-card__alert timeline-card__alert--locked">
                  <span className="timeline-card__alert-dot" />
                  Opens after {events[idx - 1]?.title} deadline ({formatDate(events[idx - 1]?.deadline)})
                </div>
              ) : needsReview ? (
                <div className="timeline-card__alert">
                  <span className="timeline-card__alert-dot" />
                  Needs your review
                </div>
              ) : !sub ? (
                <div style={{ marginTop: '8px', fontSize: '13px', color: '#94a3b8', fontStyle: 'italic' }}>
                  Awaiting submission from team
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default BatchTimeline;
