import { useState, useEffect } from 'react';
import * as api from '../../services/api';
import ConfirmationDialog from '../../components/ConfirmationDialog';

function ProblemManagement() {
  const [problems, setProblems] = useState([]);
  const [coes, setCOEs] = useState([]);
  const [guides, setGuides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ coeId: '', title: '', description: '', year: new Date().getFullYear(), guideId: '', datasetUrl: '' });
  const [saving, setSaving] = useState(false);
  const [dialog, setDialog] = useState({ isOpen: false, title: '', message: '', type: 'info', onConfirm: null });

  const fetchData = async () => {
    try {
      const [problemsRes, coesRes, guidesRes] = await Promise.all([
        api.getAllProblems(),
        api.getAllCOEs(),
        api.getAllGuides()
      ]);
      setProblems(problemsRes.data.data);
      setCOEs(coesRes.data.data);
      setGuides(guidesRes.data.data);
    } catch (error) {
      console.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createProblem(formData);
      setFormData({ coeId: '', title: '', description: '', year: new Date().getFullYear(), guideId: '', datasetUrl: '' });
      setShowModal(false);
      fetchData();
    } catch (error) {
      showDialog('Error', error.response?.data?.message || 'Failed to create problem', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    showDialog('Delete Problem', 'Are you sure you want to delete this problem?', 'danger', async () => {
      try {
        await api.deleteProblem(id);
        fetchData();
      } catch (error) {
        showDialog('Error', 'Failed to delete problem', 'danger');
      }
    });
  };

  const showDialog = (title, message, type = 'info', onConfirm = null) => {
    setDialog({
      isOpen: true,
      title,
      message,
      type,
      onConfirm: () => {
        if (onConfirm) onConfirm();
        setDialog({ ...dialog, isOpen: false });
      },
      confirmText: onConfirm ? (type === 'danger' ? 'Delete' : 'Yes') : 'OK',
      cancelText: onConfirm ? 'Cancel' : 'OK'
    });
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">📋 Problem Statements</h2>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          + Add Problem
        </button>
      </div>

      {problems.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#718096' }}>
          <p>No problems created yet. Click "Add Problem" to create one.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>COE</th>
                <th>Guide</th>
                <th>Year</th>
                <th>Selected</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {problems.map((problem) => (
                <tr key={problem._id}>
                  <td><strong>{problem.title}</strong></td>
                  <td>{problem.coeId?.name || '-'}</td>
                  <td>{problem.guideId?.name || '-'}</td>
                  <td>{problem.year}</td>
                  <td>
                    <span className={`badge ${problem.selectedBatchCount >= problem.maxBatches ? 'badge-danger' : 'badge-success'}`}>
                      {problem.selectedBatchCount}/{problem.maxBatches}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleDelete(problem._id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Problem Statement</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Title</label>
                <input type="text" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} required />
              </div>
              <div className="form-group">
                <label>COE (Domain)</label>
                <select value={formData.coeId} onChange={(e) => setFormData({...formData, coeId: e.target.value})} required>
                  <option value="">Select COE</option>
                  {coes.map((coe) => (<option key={coe._id} value={coe._id}>{coe.name}</option>))}
                </select>
              </div>
              <div className="form-group">
                <label>Assigned Guide</label>
                <select value={formData.guideId} onChange={(e) => setFormData({...formData, guideId: e.target.value})} required>
                  <option value="">Select Guide</option>
                  {guides.map((guide) => (<option key={guide._id} value={guide._id}>{guide.name} ({guide.assignedBatches}/{guide.maxBatches})</option>))}
                </select>
              </div>
              <div className="form-group">
                <label>Year</label>
                <input type="number" value={formData.year} onChange={(e) => setFormData({...formData, year: parseInt(e.target.value)})} required />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows={3} />
              </div>
              <div className="form-group">
                <label>Dataset URL (Optional)</label>
                <input type="url" value={formData.datasetUrl} onChange={(e) => setFormData({...formData, datasetUrl: e.target.value})} placeholder="https://..." />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Problem'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationDialog
        isOpen={dialog.isOpen}
        title={dialog.title}
        message={dialog.message}
        type={dialog.type}
        onConfirm={dialog.onConfirm}
        onCancel={() => setDialog({ ...dialog, isOpen: false })}
        confirmText={dialog.confirmText}
        cancelText={dialog.cancelText}
      />
    </div>
  );
}

export default ProblemManagement;

