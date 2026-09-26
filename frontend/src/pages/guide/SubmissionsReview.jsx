import { useState, useEffect } from 'react';
import * as api from '../../services/api';
import ConfirmationDialog from '../../components/ConfirmationDialog';

function SubmissionsReview() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [comment, setComment] = useState('');
  const [studentMarkInputs, setStudentMarkInputs] = useState({}); // { studentId: marksValue }
  const [batchStudents, setBatchStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
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

  // Fetch students in batch when a submission is selected
  useEffect(() => {
    if (!selectedSubmission) {
      setBatchStudents([]);
      setStudentMarkInputs({});
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
            const sid = typeof sm.studentId === 'object' ? sm.studentId._id : sm.studentId;
            existing[sid] = sm.marks !== null && sm.marks !== undefined ? String(sm.marks) : '';
          });
        }
        // Fill blanks for any student not yet marked
        students.forEach(s => {
          if (!(s._id in existing)) existing[s._id] = '';
        });
        setStudentMarkInputs(existing);
      })
      .catch(err => {
        console.error('Failed to fetch batch students', err);
        setBatchStudents([]);
      })
      .finally(() => setLoadingStudents(false));
  }, [selectedSubmission?._id]);

  const handleAddComment = async () => {
    if (!comment.trim()) {
      showDialog('Error', 'Please enter a comment', 'danger');
      return;
    }
    try {
      await api.addSubmissionComment(selectedSubmission._id, comment);
      const res = await api.getSubmission(selectedSubmission._id);
      setSelectedSubmission(res.data.data || res.data);
      setComment('');
      fetchSubmissions();
      showDialog('Success', 'Feedback submitted successfully', 'success');
    } catch (error) {
      console.error('Error adding comment:', error);
      showDialog('Error', error.response?.data?.message || 'Failed to submit feedback', 'danger');
    }
  };

  const handleAssignMarks = async (status) => {
    const isMarksDisabled = selectedSubmission.timelineEventId?.isMarksEnabled === false || selectedSubmission.timelineEventId?.isMarksEnabled === 'false';
    const isMarksEnabled = !isMarksDisabled;

    if (isMarksEnabled && status === 'accepted') {
      // Validate all students have marks filled in
      const missing = batchStudents.filter(s => studentMarkInputs[s._id] === '' || studentMarkInputs[s._id] === undefined || studentMarkInputs[s._id] === null);
      if (missing.length > 0) {
        showDialog('Error', `Please enter marks for all students. Missing: ${missing.map(s => s.name || s.rollNumber).join(', ')}`, 'danger');
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

      // Refresh data after assignment
      await new Promise(resolve => setTimeout(resolve, 500));
      const updatedRes = await api.getSubmission(selectedSubmission._id);
      setSelectedSubmission(updatedRes.data.data);

      // Also refresh the list
      await fetchSubmissions();
      setStudentMarkInputs({});
      setComment('');
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
    const isMarksDisabled = selectedSubmission.timelineEventId?.isMarksEnabled === false || selectedSubmission.timelineEventId?.isMarksEnabled === 'false';
    const isMarksEnabled = !isMarksDisabled;
    const hasStudentMarks = Array.isArray(selectedSubmission.studentMarks) && selectedSubmission.studentMarks.length > 0;

    return (
      <div className="tab-content">
        <button className="btn btn-secondary" onClick={() => setSelectedSubmission(null)} style={{ marginBottom: '20px' }}>← Back</button>

        <div className="card" style={{ marginBottom: '20px' }}>
          <h2>📝 {selectedSubmission.timelineEventId?.title}</h2>
          <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
            <span><strong>Team:</strong> {selectedSubmission.batchId?.teamName}</span>
            <span><strong>Class:</strong> {selectedSubmission.batchId?.year} {selectedSubmission.batchId?.branch}-{selectedSubmission.batchId?.section}</span>
            {isMarksEnabled && (
              <span><strong>🎯 Max Marks:</strong> {selectedSubmission.timelineEventId?.maxMarks}</span>
            )}
            {getStatusBadge(selectedSubmission.status)}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="card">
            <h3>📄 Submission History</h3>
            {selectedSubmission.versions?.length === 0 ? (
              <p style={{ color: '#888' }}>No submissions yet</p>
            ) : (
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {selectedSubmission.versions?.map((v, idx) => (
                  <div key={idx} style={{ padding: '10px', borderBottom: '1px solid #eee' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ margin: 0 }}>💬 Guide Feedback</h3>
                {selectedSubmission.comments?.length > 0 && (
                  <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: '600' }}>✅ Feedback Provided</span>
                )}
              </div>
              {!selectedSubmission.comments?.length ? (
                <p style={{ color: '#888', marginBottom: '10px' }}>No feedback given yet. You must submit feedback before entering marks.</p>
              ) : (
                <div style={{ maxHeight: '180px', overflowY: 'auto', marginBottom: '10px' }}>
                  {selectedSubmission.comments.map((c, idx) => (
                    <div key={idx} style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px', marginBottom: '10px', maxWidth: '100%', minWidth: '0', wordWrap: 'break-word', overflowWrap: 'break-word', overflow: 'hidden', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', minWidth: '0' }}>
                        <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.guideId?.name || 'Guide'}</strong>
                        <small style={{ whiteSpace: 'nowrap', marginLeft: '10px' }}>{new Date(c.createdAt).toLocaleString()}</small>
                      </div>
                      <p style={{ margin: '0', color: '#333', maxWidth: '100%', wordWrap: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap', wordBreak: 'break-word', minWidth: '0' }}>{c.comment}</p>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={2}
                  placeholder="Type your feedback here..."
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
                <button
                  className="btn btn-primary btn-sm"
                  style={{ alignSelf: 'flex-end', whiteSpace: 'nowrap', padding: '8px 14px' }}
                  onClick={handleAddComment}
                  disabled={!comment.trim()}
                >
                  Submit Feedback
                </button>
              </div>
            </div>

            {selectedSubmission.adminRemarks?.length > 0 && (
              <div className="card" style={{ background: '#f0f9ff', borderColor: '#bae6fd' }}>
                <h3 style={{ color: '#0369a1' }}>💬 Coordinator Feedback</h3>
                <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                  {selectedSubmission.adminRemarks
                    .filter((r, idx, self) =>
                      idx === self.findIndex((t) => (
                        t.remark === r.remark && (new Date(t.createdAt) - new Date(r.createdAt)) < 60000 && (new Date(t.createdAt) - new Date(r.createdAt)) > -60000
                      ))
                    )
                    .map((r, idx) => (
                      <div key={idx} style={{ padding: '10px', borderBottom: idx !== selectedSubmission.adminRemarks.length - 1 ? '1px solid #e0f2fe' : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '5px' }}>
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

        {/* Already-assigned student marks (read view) */}
        {hasStudentMarks && (selectedSubmission.status === 'accepted' || selectedSubmission.status === 'completed') && (
          <div className="card" style={{ marginTop: '20px', background: '#f0fdf4', borderColor: '#86efac' }}>
            <h3 style={{ color: '#166534' }}>✅ Assigned Marks (Individual)</h3>
            <table className="data-table" style={{ marginTop: '10px' }}>
              <thead>
                <tr>
                  <th>Roll Number</th>
                  <th>Name</th>
                  <th>Marks / {selectedSubmission.timelineEventId?.maxMarks}</th>
                </tr>
              </thead>
              <tbody>
                {selectedSubmission.studentMarks.map((sm, idx) => (
                  <tr key={idx}>
                    <td>{sm.studentId?.rollNumber || '—'}</td>
                    <td>{sm.studentId?.name || '—'}</td>
                    <td><strong style={{ color: '#166534' }}>{sm.marks !== null ? sm.marks : '—'}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(selectedSubmission.status === 'submitted' || selectedSubmission.status === 'under_review') && (
          <div className="card" style={{ marginTop: '20px' }}>
            <h3>🎯 {isMarksEnabled ? 'Assign Individual Marks' : 'Review Decision'}</h3>

            {isMarksEnabled && (
              <div style={{ marginBottom: '15px' }}>
                {!selectedSubmission.comments?.length ? (
                  <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', marginBottom: '15px', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '20px' }}>🔒</span>
                    <div>
                      <strong>Marks Locked</strong>
                      <div style={{ fontSize: '13px' }}>Please submit your Guide Feedback above first. Once feedback is provided, marks entry and acceptance will be unlocked.</div>
                    </div>
                  </div>
                ) : (
                  <p style={{ color: '#666', marginBottom: '12px' }}>
                    Max Marks: <strong>{selectedSubmission.timelineEventId?.maxMarks}</strong> — Enter marks for each student individually. All students must have marks before accepting.
                  </p>
                )}

                {loadingStudents ? (
                  <p style={{ color: '#888' }}>Loading students...</p>
                ) : batchStudents.length === 0 ? (
                  <p style={{ color: '#e53e3e' }}>⚠️ No students found in this batch.</p>
                ) : (
                  <table className="data-table" style={{ marginBottom: '16px' }}>
                    <thead>
                      <tr>
                        <th>Roll Number</th>
                        <th>Name</th>
                        <th>Marks (out of {selectedSubmission.timelineEventId?.maxMarks})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchStudents.map(student => (
                        <tr key={student._id}>
                          <td>{student.rollNumber}</td>
                          <td>{student.name}</td>
                          <td>
                            <input
                              type="number"
                              min="0"
                              max={selectedSubmission.timelineEventId?.maxMarks}
                              value={studentMarkInputs[student._id] ?? ''}
                              onChange={e => setStudentMarkInputs(prev => ({ ...prev, [student._id]: e.target.value }))}
                              placeholder={!selectedSubmission.comments?.length ? "Locked" : "Enter marks"}
                              disabled={!selectedSubmission.comments?.length}
                              style={{
                                width: '110px',
                                background: !selectedSubmission.comments?.length ? '#f1f5f9' : 'white',
                                cursor: !selectedSubmission.comments?.length ? 'not-allowed' : 'text'
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px' }}>
              <button
                className="btn btn-primary"
                disabled={
                  !selectedSubmission.comments?.length ||
                  (isMarksEnabled && batchStudents.length > 0 && batchStudents.some(s => studentMarkInputs[s._id] === '' || studentMarkInputs[s._id] === undefined || studentMarkInputs[s._id] === null))
                }
                onClick={() => handleAssignMarks('accepted')}
              >
                {isMarksEnabled ? '✅ Accept & Assign' : '✅ Accept Submission'}
              </button>
              <button className="btn btn-warning" onClick={() => handleAssignMarks('needs_revision')}>🔄 Request Revision</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
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
                    <td>
                      {sub.versions && sub.versions.length > 0 && sub.versions[0]?.fileUrl ? (
                        <a href={sub.versions[0].fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#667eea', cursor: 'pointer', textDecoration: 'underline' }}>
                          📁 Submission {sub.currentVersion}
                        </a>
                      ) : (
                        <span>Submission {sub.currentVersion}</span>
                      )}
                    </td>
                    <td>{getStatusBadge(sub.status)}</td>
                    <td>
                      {(sub.status === 'accepted' || sub.status === 'completed') ? (
                        Array.isArray(sub.studentMarks) && sub.studentMarks.length > 0
                          ? <span style={{ color: '#22c55e', fontSize: '12px' }}>✅ Individual ({sub.studentMarks.length} students)</span>
                          : sub.marks !== null ? `${sub.marks}/${sub.timelineEventId?.maxMarks}` : 'No marks'
                      ) : '-'}
                    </td>
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
