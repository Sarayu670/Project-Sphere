import { useState, useEffect } from 'react';
import * as api from '../../services/api';

const YEAR_LABELS = {
  '2nd': '2nd - Real Time Project',
  '3rd': '3rd - Mini Project',
  '4th': '4th - Major Project'
};

function BatchDetails({ batchId, onBack }) {
  const [batch, setBatch] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState({});
  const [submitting, setSubmitting] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const fetchData = async () => {
    try {
      const [batchRes, updatesRes] = await Promise.all([
        api.getBatch(batchId),
        api.getProgressUpdates(batchId)
      ]);
      setBatch(batchRes.data.data);
      setUpdates(updatesRes.data.data);
    } catch (error) {
      console.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [batchId]);

  const handleAddComment = async (updateId) => {
    if (!newComment[updateId]?.trim()) return;
    setSubmitting(updateId);
    try {
      await api.addComment(updateId, newComment[updateId]);
      setNewComment({ ...newComment, [updateId]: '' });
      fetchData();
    } catch (error) {
      alert('Failed to add comment');
    } finally {
      setSubmitting(null);
    }
  };

  const handleStatusChange = async (newStatus) => {
    setStatusUpdating(true);
    try {
      await api.updateBatchStatus(batchId, newStatus);
      fetchData();
    } catch (error) {
      alert('Failed to update status');
    } finally {
      setStatusUpdating(false);
    }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (!batch) return <div>Batch not found</div>;

  return (
    <div>
      <button onClick={onBack} className="btn btn-secondary" style={{ marginBottom: '20px' }}>
        ← Back to Dashboard
      </button>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="flex-between">
          <div>
            <h2 style={{ color: '#2d3748', marginBottom: '8px' }}>👥 {batch.teamName}</h2>
            <p style={{ color: '#718096' }}>Leader: {batch.leaderStudentId?.name}</p>
            <p style={{ color: '#667eea', fontWeight: '500', fontSize: '14px' }}>{batch.year ? YEAR_LABELS[batch.year] : 'Year Not Set'}</p>
          </div>
          <div>
            <label style={{ fontSize: '14px', color: '#718096', display: 'block', marginBottom: '8px' }}>Update Status:</label>
            <select 
              value={batch.status} 
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={statusUpdating}
              style={{ padding: '8px 16px', borderRadius: '8px', border: '2px solid #e2e8f0' }}
            >
              <option value="Not Started">Not Started</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: '20px' }}>
        <div className="card">
          <h3 style={{ marginBottom: '16px', color: '#2d3748' }}>📋 Problem Details</h3>
          <h4 style={{ color: '#667eea', marginBottom: '8px' }}>{batch.problemId?.title}</h4>
          <p style={{ color: '#718096', fontSize: '14px' }}>{batch.problemId?.description}</p>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: '16px', color: '#2d3748' }}>👥 Team Members</h3>
          {batch.leaderStudentId || batch.teamMembers?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {batch.leaderStudentId && (
                <div style={{ background: '#e6f2ff', padding: '8px 12px', borderRadius: '8px', fontSize: '14px', borderLeft: '3px solid #667eea' }}>
                  <strong>{batch.leaderStudentId.name}</strong> - {batch.leaderStudentId.rollNumber || batch.leaderStudentId.rollNo || 'N/A'} ({batch.branch || 'N/A'}-{batch.section || 'N/A'})
                </div>
              )}
              {batch.teamMembers?.map((member) => (
                <div key={member._id} style={{ background: '#f7fafc', padding: '8px 12px', borderRadius: '8px', fontSize: '14px' }}>
                  <strong>{member.name}</strong> - {member.rollNo} ({batch.branch || 'N/A'}-{batch.section || 'N/A'})
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#718096' }}>No team members added</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default BatchDetails;

