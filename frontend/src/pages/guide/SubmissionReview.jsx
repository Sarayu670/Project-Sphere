import { useState, useEffect } from 'react';
import * as api from '../../services/api';
import ConfirmationDialog from '../../components/ConfirmationDialog';

/**
 * Guide-side review screen for a single team submission on a timeline event.
 * Handles feedback (add/delete), per-student marks, accept and request-revision.
 *
 * Shared by GuideTimeline (event-centric) and BatchTimeline (team-centric).
 *
 * Props:
 *  - submission:  full submission object (as returned by getGuideSubmissions)
 *  - event:       the timeline event (title, maxMarks, isMarksEnabled, requirements, referenceFile)
 *  - onBack:      handler for the back button
 *  - backLabel:   text for the back button
 *  - breadcrumb:  optional [{ label, onClick? }] - last item rendered as current
 *  - onChanged:   called after feedback/marks change so the parent can refetch
 */
export const getSubmissionStatusBadge = (status) => {
  const colors = { not_started: 'secondary', submitted: 'info', under_review: 'warning', needs_revision: 'warning', accepted: 'success', rejected: 'danger' };
  const labels = { not_started: 'Not Started', submitted: 'Submitted', under_review: 'Under Review', needs_revision: 'Needs Revision', accepted: 'Accepted', rejected: 'Rejected' };
  return <span className={`badge badge-${colors[status] || 'info'}`}>{labels[status] || status}</span>;
};

function SubmissionReview({ submission: submissionProp, event: selectedEvent, onBack, backLabel = 'Back to Submissions', breadcrumb = [], onChanged }) {
  const [submission, setSubmission] = useState(submissionProp);
  const [comment, setComment] = useState('');
  const [studentMarkInputs, setStudentMarkInputs] = useState({}); // { studentId: marksValue }
  const [isEditingMarks, setIsEditingMarks] = useState(false);
  const [batchStudents, setBatchStudents] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [dialog, setDialog] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: null });
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [isDeletingComment, setIsDeletingComment] = useState(null); // stores commentId being deleted
  const [isSubmittingMarks, setIsSubmittingMarks] = useState(false);

  // Keep in sync with fresher data from the parent (e.g. polling)
  useEffect(() => {
    if (submissionProp) setSubmission(submissionProp);
  }, [submissionProp]);

  // Fetch batch students when the submission changes
  useEffect(() => {
    if (!submission) {
      setBatchStudents([]);
      setStudentMarkInputs({});
      setIsEditingMarks(false);
      return;
    }

    const batchId = typeof submission.batchId === 'string'
      ? submission.batchId
      : submission.batchId?._id;

    if (!batchId) return;

    setLoadingStudents(true);
    api.getBatchStudents(batchId)
      .then(res => {
        const students = res.data.data || [];
        setBatchStudents(students);

        // Pre-fill inputs from existing studentMarks if already assigned
        const existing = {};
        if (Array.isArray(submission.studentMarks)) {
          submission.studentMarks.forEach(sm => {
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
  }, [submission?._id]);

  const showDialog = (title, message, type = 'info') => {
    setDialog({
      isOpen: true,
      title,
      message,
      type,
      onConfirm: () => {
        setDialog(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleAddComment = async () => {
    if (!comment.trim()) {
      showDialog('Error', 'Please enter a comment', 'danger');
      return;
    }
    if (isSubmittingFeedback) return;
    setIsSubmittingFeedback(true);
    try {
      await api.addSubmissionComment(submission._id, comment);
      const res = await api.getSubmission(submission._id);
      setSubmission(res.data.data || res.data);
      setComment('');
      onChanged?.();
      showDialog('Success', 'Feedback submitted successfully', 'success');
    } catch (error) {
      console.error('Error adding comment:', error);
      showDialog('Error', error.response?.data?.message || 'Failed to submit feedback', 'danger');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (isDeletingComment) return;
    setIsDeletingComment(commentId);
    try {
      const res = await api.deleteSubmissionComment(submission._id, commentId);
      setSubmission(res.data.data || res.data);
      onChanged?.();
    } catch (error) {
      console.error('Error deleting comment:', error);
      showDialog('Error', error.response?.data?.message || 'Failed to delete feedback', 'danger');
    } finally {
      setIsDeletingComment(null);
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
      setIsSubmittingMarks(true);
      const studentMarks = batchStudents.map(s => ({
        studentId: s._id,
        marks: studentMarkInputs[s._id] !== '' && studentMarkInputs[s._id] !== undefined
          ? parseFloat(studentMarkInputs[s._id])
          : null
      }));

      await api.assignSubmissionMarks(submission._id, {
        status,
        comment,
        studentMarks: isMarksEnabled ? studentMarks : []
      });

      const res = await api.getSubmission(submission._id);
      setSubmission(res.data.data);
      onChanged?.();
      setIsEditingMarks(false);
      setComment('');
      showDialog('Success', status === 'accepted' ? 'Marks assigned successfully!' : 'Revision requested successfully.', 'success');
    } catch (error) {
      showDialog('Error', error.response?.data?.message || 'Failed to assign marks', 'danger');
    } finally {
      setIsSubmittingMarks(false);
    }
  };

  if (!submission || !selectedEvent) return <div>No submission found</div>;

  const isMarksDisabled = selectedEvent?.isMarksEnabled === false || selectedEvent?.isMarksEnabled === 'false';
  const isMarksEnabled = !isMarksDisabled;
  const hasStudentMarks = Array.isArray(submission.studentMarks) && submission.studentMarks.length > 0;
  const canEditMarks = isMarksEnabled && (submission.status === 'submitted' || submission.status === 'under_review' || submission.status === 'needs_revision' || submission.status === 'accepted');
  const markFormVisible = isMarksEnabled && (isEditingMarks || !hasStudentMarks);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
        <button className="back-nav-btn" onClick={onBack} style={{ marginBottom: 0 }}>
          <span className="nav-arrow">‹</span> {backLabel}
        </button>

        {breadcrumb.length > 0 && (
          <div className="breadcrumb-bar" style={{ margin: 0 }}>
            {breadcrumb.map((item, idx) => {
              const isLast = idx === breadcrumb.length - 1;
              return (
                <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  {isLast || !item.onClick ? (
                    <span className="breadcrumb-current">{item.label}</span>
                  ) : (
                    <button className="breadcrumb-link" onClick={item.onClick}>{item.label}</button>
                  )}
                  {!isLast && <span style={{ color: '#94a3b8', fontSize: '14px' }}>›</span>}
                </span>
              );
            })}
          </div>
        )}
      </div>

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
            <strong>Status:</strong> {getSubmissionStatusBadge(submission.status)}
          </div>
        </div>
        {(() => {
          const refFile = selectedEvent.referenceFile;
          if (!selectedEvent.submissionRequirements && !refFile?.url) return null;
          return (
            <div style={{ marginTop: '15px', padding: '10px', background: '#f8fafc', borderRadius: '8px' }}>
              <strong>📋 What to Submit:</strong><br />
              {selectedEvent.submissionRequirements && (
                <span style={{ color: '#666' }}>{selectedEvent.submissionRequirements}</span>
              )}
              {refFile?.url && (
                <a
                  href={api.getUploadUrl(refFile.url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'block', marginTop: '6px', fontWeight: 600 }}
                >
                  📎 {refFile.name || 'Requirements file'}
                </a>
              )}
            </div>
          );
        })()}
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
              {(submission.studentMarks || [])
                .filter((sm, idx, self) => {
                  const sid = (sm.studentId?._id || sm.studentId)?.toString();
                  return idx === self.findIndex(t => (t.studentId?._id || t.studentId)?.toString() === sid);
                })
                .map((sm, idx) => (
                  <tr key={sm.studentId?._id || idx}>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>Submission {v.version} {idx === submission.versions.length - 1 ? '(Latest)' : ''}</strong>
                    <small style={{ color: '#64748b' }}>{new Date(v.submittedAt).toLocaleString()}</small>
                  </div>
                  {v.submittedByName && (
                    <div style={{ fontSize: '13px', color: '#2563eb', fontWeight: '500', marginTop: '4px' }}>
                      👤 {v.version === 1 ? 'Submitted by' : 'Updated by'}: <strong>{v.submittedByName}</strong>
                    </div>
                  )}
                  {v.description && <p style={{ color: '#666', fontSize: '14px', margin: '5px 0' }}>{v.description}</p>}
                  <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                    {v.driveLink && <a href={v.driveLink} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">📁 View Drive Link</a>}
                    {v.fileUrl && <a href={v.fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">📁 View File</a>}
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
              {submission.comments?.length > 0 && (
                <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: '600' }}>✅ Feedback Provided</span>
              )}
            </div>
            {!submission.comments?.length ? (
              <p style={{ color: '#888', marginBottom: '10px' }}>No feedback given yet. You must submit feedback before entering marks.</p>
            ) : (
              <div style={{ maxHeight: '240px', overflowY: 'auto', marginBottom: '10px' }}>
                {submission.comments.map((c, idx) => (
                  <div key={c._id || idx} style={{ padding: '10px', background: '#fef3c7', borderRadius: '8px', marginBottom: '10px', maxWidth: '100%', minWidth: '0', wordWrap: 'break-word', overflowWrap: 'break-word', overflow: 'hidden', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '5px', minWidth: '0', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                        <strong style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>👨‍🏫 {c.guideId?.name || 'Guide'}</strong>
                        <small style={{ whiteSpace: 'nowrap', color: '#92400e' }}>{new Date(c.createdAt).toLocaleString()}</small>
                      </div>
                      {c._id && (
                        <button
                          onClick={() => handleDeleteComment(c._id)}
                          disabled={isDeletingComment === c._id}
                          title="Delete this feedback"
                          style={{
                            background: isDeletingComment === c._id ? '#fde8e8' : 'transparent',
                            border: '1px solid #fca5a5',
                            borderRadius: '5px',
                            cursor: isDeletingComment === c._id ? 'not-allowed' : 'pointer',
                            color: '#dc2626',
                            fontSize: '12px',
                            padding: '2px 7px',
                            flexShrink: 0,
                            fontWeight: '600',
                            transition: 'all 0.15s'
                          }}
                        >
                          {isDeletingComment === c._id ? '...' : '🗑️'}
                        </button>
                      )}
                    </div>
                    <p style={{ margin: '0', color: '#92400e', maxWidth: '100%', wordWrap: 'break-word', overflowWrap: 'break-word', whiteSpace: 'pre-wrap', wordBreak: 'break-word', minWidth: '0' }}>{c.comment}</p>
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
                disabled={isSubmittingFeedback}
              />
              <button
                className="btn btn-primary btn-sm"
                style={{ alignSelf: 'flex-end', whiteSpace: 'nowrap', padding: '8px 14px', opacity: isSubmittingFeedback ? 0.7 : 1 }}
                onClick={handleAddComment}
                disabled={!comment.trim() || isSubmittingFeedback}
              >
                {isSubmittingFeedback ? '⏳ Submitting...' : 'Submit Feedback'}
              </button>
            </div>
          </div>

          {submission.adminRemarks?.length > 0 && (
            <div className="card" style={{ background: '#f0f9ff', borderColor: '#bae6fd' }}>
              <h3 style={{ color: '#0369a1' }}>💬 Coordinator Feedback</h3>
              <div style={{ maxHeight: '150px', overflowY: 'auto' }}>
                {submission.adminRemarks
                  .filter((r, idx, self) =>
                    idx === self.findIndex((t) => (
                      t.remark === r.remark && (new Date(t.createdAt) - new Date(r.createdAt)) < 60000 && (new Date(t.createdAt) - new Date(r.createdAt)) > -60000
                    ))
                  )
                  .map((r, idx) => (
                    <div key={idx} style={{ padding: '10px', borderBottom: idx !== submission.adminRemarks.length - 1 ? '1px solid #e0f2fe' : 'none' }}>
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

      {['submitted', 'under_review', 'accepted', 'needs_revision'].includes(submission.status) && markFormVisible && (
        <div className="card" style={{ marginTop: '20px' }}>
          <h3>🎯 {isMarksDisabled ? 'Review Decision' : hasStudentMarks && isEditingMarks ? 'Edit Individual Marks' : 'Assign Individual Marks'}</h3>

          {isMarksEnabled && (
            <div style={{ marginBottom: '15px' }}>
              {!submission.comments?.length ? (
                <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', marginBottom: '15px', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '20px' }}>🔒</span>
                  <div>
                    <strong>Marks Locked</strong>
                    <div style={{ fontSize: '13px' }}>Please submit your Guide Feedback above first. Once feedback is provided, marks entry and acceptance will be unlocked.</div>
                  </div>
                </div>
              ) : (
                <p style={{ color: '#666', marginBottom: '12px' }}>
                  Max Marks: <strong>{selectedEvent.maxMarks}</strong> — Enter marks for each student individually. All students must have marks before accepting.
                </p>
              )}

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
                              placeholder={!submission.comments?.length ? "Locked" : "Enter marks"}
                              disabled={!submission.comments?.length}
                              style={{
                                width: '110px',
                                background: !submission.comments?.length ? '#f1f5f9' : 'white',
                                cursor: !submission.comments?.length ? 'not-allowed' : 'text'
                              }}
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
            <button
              className="btn btn-primary"
              disabled={
                isSubmittingMarks ||
                !submission.comments?.length ||
                (isMarksEnabled && batchStudents.length > 0 && batchStudents.some(s => studentMarkInputs[s._id] === '' || studentMarkInputs[s._id] === undefined || studentMarkInputs[s._id] === null))
              }
              onClick={() => handleAssignMarks('accepted')}
            >
              {isSubmittingMarks ? '⏳ Saving Marks...' : isMarksEnabled ? (hasStudentMarks || isEditingMarks ? '✅ Update Marks' : '✅ Accept & Assign Marks') : '✅ Accept Submission'}
            </button>
            {hasStudentMarks && isEditingMarks && (
              <button className="btn btn-secondary" disabled={isSubmittingMarks} onClick={() => {
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
            <button className="btn btn-warning" disabled={isSubmittingMarks} onClick={() => handleAssignMarks('needs_revision')}>
              {isSubmittingMarks ? '⏳ Please wait...' : '🔄 Request Revision'}
            </button>
          </div>
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

export default SubmissionReview;
