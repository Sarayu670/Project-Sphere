import { useState, useEffect } from 'react';
import * as api from '../../services/api';
import ConfirmationDialog from '../../components/ConfirmationDialog';

function GuideTimeline() {
  const [timelineEvents, setTimelineEvents] = useState([]);
  const [batches, setBatches] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [comment, setComment] = useState('');
  const [marks, setMarks] = useState('');
  const [dialog, setDialog] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: null });

  const fetchData = async () => {
    try {
      console.log('📡 GuideTimeline: Fetching data...');
      
      const eventsRes = await api.getAllTimelineEvents();
      const batchesRes = await api.getMyBatches();
      const submissionsRes = await api.getGuideSubmissions();
      
      // Extract data properly
      const eventsData = eventsRes.data?.data || eventsRes.data || [];
      const batchesData = batchesRes.data?.data || batchesRes.data || [];
      const submissionsData = submissionsRes.data?.data || submissionsRes.data || [];
      
      console.log('✅ Events:', eventsData.length);
      console.log('✅ Batches:', batchesData.length);
      console.log('✅ Submissions:', submissionsData.length);
      
      setTimelineEvents(eventsData);
      setBatches(batchesData);
      setSubmissions(submissionsData);
      setLoading(false);
    } catch (error) {
      console.error('❌ Failed to fetch data:', error.message);
      setTimelineEvents([]);
      setBatches([]);
      setSubmissions([]);
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const getSubmissionsForEvent = (eventId) => {
    return submissions.filter(s => {
      // Handle both object and string formats for timelineEventId
      const subEventId = typeof s.timelineEventId === 'string' 
        ? s.timelineEventId 
        : s.timelineEventId?._id;
      return subEventId === eventId;
    });
  };

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    try {
      await api.addSubmissionComment(selectedSubmission._id, comment);
      setComment('');
      const res = await api.getSubmission(selectedSubmission._id);
      setSelectedSubmission(res.data.data);
      fetchData();
    } catch (error) {
      showDialog('Error', 'Failed to add comment', 'danger');
    }
  };

  const handleAssignMarks = async (status) => {
    if (!marks && status === 'accepted') {
      showDialog('Error', 'Please enter marks', 'danger');
      return;
    }
    try {
      await api.assignSubmissionMarks(selectedSubmission._id, parseFloat(marks) || 0, status);
      const res = await api.getSubmission(selectedSubmission._id);
      setSelectedSubmission(res.data.data);
      fetchData();
      setMarks('');
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

  if (loading) return <div>Loading timeline...</div>;

  if (selectedSubmission) {
    const submission = selectedSubmission;
    if (!submission) return <div>No submission found</div>;

    return (
      <div>
        <button className="btn btn-secondary" onClick={() => setSelectedSubmission(null)} style={{ marginBottom: '20px' }}>← Back to Submissions</button>
        
        <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid #667eea' }}>
          <h2>{selectedEvent.title} - {submission.batchId?.teamName}</h2>
          <p style={{ color: '#666' }}>{selectedEvent.description}</p>
          <div style={{ display: 'flex', gap: '20px', marginTop: '15px' }}>
            <span><strong>📅 Deadline:</strong> {new Date(selectedEvent.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span><strong>🎯 Max Marks:</strong> {selectedEvent.maxMarks}</span>
            {getStatusBadge(submission.status)}
          </div>
          {selectedEvent.submissionRequirements && (
            <div style={{ marginTop: '15px', padding: '10px', background: '#f8fafc', borderRadius: '8px' }}>
              <strong>📋 What to Submit:</strong><br/>
              <span style={{ color: '#666' }}>{selectedEvent.submissionRequirements}</span>
            </div>
          )}
        </div>

        {submission.marks !== null && submission.marks !== undefined && (
          <div className="card" style={{ marginBottom: '20px', background: '#f0fdf4', border: '1px solid #22c55e' }}>
            <h3 style={{ color: '#22c55e' }}>✅ Marks Assigned</h3>
            <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#22c55e' }}>{submission.marks} / {selectedEvent.maxMarks}</p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="card">
            <h3>📄 Submission History</h3>
            {!submission.versions?.length ? (
              <p style={{ color: '#888' }}>No submissions yet</p>
            ) : (
              <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                {submission.versions.map((v, idx) => (
                  <div key={idx} style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>Submission {v.version}</strong>
                      <small>{new Date(v.submittedAt).toLocaleString()}</small>
                    </div>
                    {v.description && <p style={{ color: '#666', fontSize: '14px', margin: '5px 0' }}>{v.description}</p>}
                    {v.fileUrl && <a href={v.fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">📁 View File</a>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3>💬 Guide Feedback</h3>
            {!submission.comments?.length ? (
              <p style={{ color: '#888' }}>No feedback yet</p>
            ) : (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {submission.comments.map((c, idx) => (
                  <div key={idx} style={{ padding: '10px', background: '#fef3c7', borderRadius: '8px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>👨‍🏫 {c.guideId?.name || 'Guide'}</strong>
                      <small>{new Date(c.createdAt).toLocaleString()}</small>
                    </div>
                    <p style={{ margin: '5px 0 0', color: '#92400e' }}>{c.comment}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="form-group">
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Add feedback or revision comments..." />
            </div>
            <button className="btn btn-primary" onClick={handleAddComment}>Add Comment</button>
          </div>
        </div>

        <div className="card" style={{ marginTop: '20px' }}>
          <h3>🎯 Assign Marks</h3>
          <p style={{ color: '#666', marginBottom: '15px' }}>Max Marks: {selectedEvent.maxMarks}</p>
          {submission.marks !== null && (
            <p style={{ color: '#22c55e', marginBottom: '15px' }}>✅ Current Marks: <strong>{submission.marks}/{selectedEvent.maxMarks}</strong></p>
          )}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input type="number" value={marks} onChange={(e) => setMarks(e.target.value)} placeholder="Enter marks" style={{ width: '120px' }} min="0" max={selectedEvent.maxMarks} />
            <button className="btn btn-primary" onClick={() => handleAssignMarks('accepted')}>✅ Accept & Assign</button>
            <button className="btn btn-warning" onClick={() => handleAssignMarks('needs_revision')}>🔄 Request Revision</button>
          </div>
        </div>
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
            <span><strong>🎯 Max Marks:</strong> {selectedEvent.maxMarks}</span>
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
                <div key={sub._id} className="card" style={{ cursor: 'pointer' }} onClick={() => setSelectedSubmission(sub)}>
                  <div className="batch-icon">📄</div>
                  <h3>{batch.teamName}</h3>
                  <p>{batch.year} Year • {batch.branch} • Section {batch.section}</p>
                  <p><strong>Status:</strong> {getStatusBadge(sub.status)}</p>
                  {sub.marks !== null && <p><strong>Marks:</strong> {sub.marks}/{selectedEvent.maxMarks}</p>}
                  <p><strong>Submission:</strong> {sub.currentVersion}</p>
                  <div className="batch-action">Review Submission →</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <h2 className="section-title">📅 Project Timeline</h2>
      <p style={{ color: '#666', marginBottom: '20px' }}>Review submissions from your teams across all timeline events</p>
      
      {timelineEvents.length === 0 ? (
        <div className="card empty-state"><h3>No Timeline Events</h3><p>Timeline events will appear here once admin creates them</p></div>
      ) : (
        <div className="timeline-list">
          {timelineEvents.map((event, idx) => {
            const eventSubs = getSubmissionsForEvent(event._id);
            const acceptedCount = eventSubs.filter(s => s.status === 'accepted').length;
            const totalSubs = eventSubs.length;
            const deadlineStatus = getDeadlineStatus(event.deadline);
            
            return (
              <div key={event._id} className="card" style={{ marginBottom: '15px', borderLeft: `4px solid #667eea`, cursor: 'pointer' }} onClick={() => setSelectedEvent(event)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                      <span style={{ background: '#667eea', color: 'white', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>{idx + 1}</span>
                      <h3 style={{ margin: 0 }}>{event.title}</h3>
                    </div>
                    <p style={{ color: '#666', fontSize: '14px', margin: '5px 0' }}>{event.description}</p>
                    <p style={{ color: '#888', fontSize: '14px' }}>Submissions: {acceptedCount}/{totalSubs} accepted</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: deadlineStatus.color, fontWeight: '500' }}>{deadlineStatus.text}</div>
                    <small style={{ color: '#888' }}>{new Date(event.deadline).toLocaleDateString()}</small>
                  </div>
                </div>
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