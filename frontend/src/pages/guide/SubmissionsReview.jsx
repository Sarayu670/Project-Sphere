import { useState, useEffect } from 'react';
import * as api from '../../services/api';
import ConfirmationDialog from '../../components/ConfirmationDialog';

function SubmissionsReview() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [comment, setComment] = useState('');
  const [marks, setMarks] = useState('');
  const [dialog, setDialog] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: null });

  const fetchSubmissions = async () => {
    try {
      const res = await api.getGuideSubmissions();
      setSubmissions(res.data.data);
    } catch (error) {
      console.error('Failed to fetch submissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSubmissions(); }, []);

  const handleAddComment = async () => {
    if (!comment.trim()) return;
    try {
      await api.addSubmissionComment(selectedSubmission._id, comment);
      setComment('');
      const res = await api.getSubmission(selectedSubmission._id);
      setSelectedSubmission(res.data.data);
      fetchSubmissions();
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
      console.log('Assigning marks:', { submissionId: selectedSubmission._id, marks: parseFloat(marks) || 0, status });
      const res = await api.assignSubmissionMarks(selectedSubmission._id, parseFloat(marks) || 0, status);
      console.log('Marks assigned response:', res.data);
      
      // Refresh data after assignment
      await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms for backend to sync
      const updatedRes = await api.getSubmission(selectedSubmission._id);
      setSelectedSubmission(updatedRes.data.data);
      
      // Also refresh the list
      await fetchSubmissions();
      setMarks('');
    } catch (error) {
      console.error('Error assigning marks:', error);
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
    const colors = {
      not_started: 'secondary', submitted: 'info', under_review: 'warning',
      needs_revision: 'warning', accepted: 'success', rejected: 'danger'
    };
    const labels = {
      not_started: 'Not Started', submitted: 'Submitted', under_review: 'Under Review',
      needs_revision: 'Needs Revision', accepted: 'Accepted', rejected: 'Rejected'
    };
    return <span className={`badge badge-${colors[status] || 'info'}`}>{labels[status] || status}</span>;
  };

  if (loading) return <div>Loading submissions...</div>;

  if (selectedSubmission) {
    return (
      <div className="tab-content">
        <button className="btn btn-secondary" onClick={() => setSelectedSubmission(null)} style={{ marginBottom: '20px' }}>← Back</button>
        
        <div className="card" style={{ marginBottom: '20px' }}>
          <h2>📝 {selectedSubmission.timelineEventId?.title}</h2>
          <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
            <span><strong>Team:</strong> {selectedSubmission.batchId?.teamName}</span>
            <span><strong>Class:</strong> {selectedSubmission.batchId?.year} {selectedSubmission.batchId?.branch}-{selectedSubmission.batchId?.section}</span>
            {getStatusBadge(selectedSubmission.status)}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="card">
            <h3>📄 Submission History</h3>
            {selectedSubmission.versions?.length === 0 ? (
              <p style={{ color: '#888' }}>No submissions yet</p>
            ) : (
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {selectedSubmission.versions?.map((v, idx) => (
                  <div key={idx} style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong>Submission {v.version}</strong>
                      <small>{new Date(v.submittedAt).toLocaleString()}</small>
                    </div>
                    {v.description && <p style={{ color: '#666', fontSize: '14px', margin: '5px 0' }}>{v.description}</p>}
                    {v.fileUrl && <a href={v.fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">📁 {v.fileName || 'Download'}</a>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <h3>💬 Comments & Feedback</h3>
            <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '15px' }}>
              {selectedSubmission.comments?.length === 0 ? (
                <p style={{ color: '#888' }}>No comments yet</p>
              ) : (
                selectedSubmission.comments?.map((c, idx) => (
                  <div key={idx} style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <strong>{c.guideId?.name}</strong>
                      <small>{new Date(c.createdAt).toLocaleString()}</small>
                    </div>
                    <p style={{ margin: '5px 0 0', color: '#333' }}>{c.comment}</p>
                  </div>
                ))
              )}
            </div>
            <div className="form-group">
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Add feedback or revision comments..." />
            </div>
            <button className="btn btn-primary" onClick={handleAddComment}>Add Comment</button>
          </div>
        </div>

        <div className="card" style={{ marginTop: '20px' }}>
          <h3>🎯 Assign Marks</h3>
          <p style={{ color: '#666', marginBottom: '15px' }}>Max Marks: {selectedSubmission.timelineEventId?.maxMarks}</p>
          {selectedSubmission.marks !== null && (
            <p style={{ color: '#22c55e', marginBottom: '15px' }}>✅ Current Marks: <strong>{selectedSubmission.marks}/{selectedSubmission.timelineEventId?.maxMarks}</strong></p>
          )}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input type="number" value={marks} onChange={(e) => setMarks(e.target.value)} placeholder="Enter marks" style={{ width: '120px' }} min="0" max={selectedSubmission.timelineEventId?.maxMarks} />
            <button className="btn btn-primary" onClick={() => handleAssignMarks('accepted')}>✅ Accept & Assign</button>
            <button className="btn btn-warning" onClick={() => handleAssignMarks('needs_revision')}>🔄 Request Revision</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-content">
      <h2>📝 Review Submissions</h2>
      {submissions.length === 0 ? (
        <div className="card empty-state"><h3>No Submissions</h3><p>Submissions from your teams will appear here</p></div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr><th>Team</th><th>Class</th><th>Event</th><th>Submission</th><th>Status</th><th>Marks</th><th>Action</th></tr>
            </thead>
            <tbody>
              {submissions.map(sub => (
                <tr key={sub._id}>
                  <td><strong>{sub.batchId?.teamName}</strong></td>
                  <td>{sub.batchId?.year} {sub.batchId?.branch}-{sub.batchId?.section}</td>
                  <td>{sub.timelineEventId?.title}</td>
                  <td>Submission {sub.currentVersion}</td>
                  <td>{getStatusBadge(sub.status)}</td>
                  <td>{sub.marks !== null ? `${sub.marks}/${sub.timelineEventId?.maxMarks}` : '-'}</td>
                  <td><button className="btn btn-primary btn-sm" onClick={() => setSelectedSubmission(sub)}>Review</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>

    <ConfirmationDialog
      isOpen={dialog.isOpen}
      title={dialog.title}
      message={dialog.message}
      type={dialog.type}
      onConfirm={dialog.onConfirm}
      onCancel={dialog.onConfirm}
    />
    </>
  );
}

export default SubmissionsReview;

