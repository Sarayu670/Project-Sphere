import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from '../services/api';
import './AdminAIManagement.css';

function AdminAIManagement() {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [crawling, setCrawling] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [domainFilter, setDomainFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingProblem, setEditingProblem] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    domain: '',
    difficulty: '',
    technologies: '',
    sourceName: '',
    sourceUrl: ''
  });
  const [notification, setNotification] = useState(null);
  const itemsPerPage = 8;

  const fetchProblems = useCallback(async () => {
    setLoading(true);
    try {
      const problemsRes = await api.getAIProblems({ status: 'approved' });
      setProblems(problemsRes.data.data || []);
    } catch (err) {
      console.error('Failed to fetch AI problem statements:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProblems();
  }, [fetchProblems]);

  const handleTriggerCrawl = async () => {
    setCrawling(true);
    setNotification(null);
    try {
      const res = await api.triggerAICrawl();
      const info = res.data.data || {};
      setNotification({
        type: 'success',
        text: `Collection complete. Added ${info.insertedCount || 0} new problem statement${info.insertedCount === 1 ? '' : 's'}.`
      });
      fetchProblems();
    } catch (err) {
      setNotification({
        type: 'danger',
        text: err.response?.data?.message || 'Failed to collect new problem statements.'
      });
    } finally {
      setCrawling(false);
    }
  };

  const handleEditClick = (problem) => {
    setEditingProblem(problem);
    setEditForm({
      title: problem.title || '',
      description: problem.description || '',
      domain: problem.domain || '',
      difficulty: problem.difficulty || 'Medium',
      technologies: problem.technologies ? problem.technologies.join(', ') : '',
      sourceName: problem.sourceName || '',
      sourceUrl: problem.sourceUrl || ''
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...editForm,
        technologies: editForm.technologies.split(',').map(t => t.trim()).filter(Boolean)
      };
      await api.updateAIProblem(editingProblem._id, payload);
      setEditingProblem(null);
      fetchProblems();
      setNotification({ type: 'success', text: 'Problem statement updated successfully.' });
    } catch (err) {
      alert('Failed to update problem statement: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this AI problem statement?')) return;
    try {
      await api.deleteAIProblem(id);
      fetchProblems();
      setNotification({ type: 'success', text: 'Problem statement deleted successfully.' });
    } catch (err) {
      alert('Failed to delete: ' + (err.response?.data?.message || err.message));
    }
  };

  const filteredProblems = useMemo(() => problems.filter(p => {
    if (domainFilter !== 'All' && p.domain !== domainFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        (p.title || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
    }
    return true;
  }), [domainFilter, problems, searchTerm]);

  const domainOptions = useMemo(
    () => Array.from(new Set(problems.map(p => p.domain).filter(Boolean))).sort(),
    [problems]
  );

  const totalPages = Math.max(1, Math.ceil(filteredProblems.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const paginatedProblems = filteredProblems.slice(startIndex, startIndex + itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, domainFilter]);

  return (
    <div className="admin-ai-container">
      <div className="admin-ai-banner">
        <div className="banner-left">
          <h2>AI Problem Statements</h2>
        </div>
        <button
          className="btn-trigger-crawl"
          disabled={crawling}
          onClick={handleTriggerCrawl}
        >
          {crawling ? 'Collecting...' : 'Collect New Statements'}
        </button>
      </div>

      {notification && (
        <div className={`notification-bar alert-${notification.type}`}>
          {notification.text}
        </div>
      )}

      <div className="admin-tab-section">
        <div className="admin-ai-section-title">
          <div>
            <h3>Manage Statements</h3>
            <span>{filteredProblems.length} approved statement{filteredProblems.length === 1 ? '' : 's'}</span>
          </div>
        </div>

        <div className="statements-filter-bar">
          <input
            type="text"
            placeholder="Search problem title or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <select
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            className="domain-select"
          >
            <option value="All">All Domains</option>
            {domainOptions.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="ai-table-empty">Loading problem statements...</div>
        ) : (
          <div className="statements-table-wrapper">
            <table className="ai-admin-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Domain</th>
                  <th>Difficulty</th>
                  <th>Source</th>
                  <th>Requests</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProblems.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="ai-table-empty">
                      No statements found matching your filters.
                    </td>
                  </tr>
                ) : (
                  paginatedProblems.map(p => (
                    <tr key={p._id}>
                      <td className="cell-title">
                        <strong>{p.title}</strong>
                        <div className="cell-desc">
                          {(p.description || '').length > 90
                            ? `${p.description.substring(0, 90)}...`
                            : p.description}
                        </div>
                      </td>
                      <td><span className="badge-domain">{p.domain}</span></td>
                      <td><span className={`badge-diff diff-${(p.difficulty || 'Medium').toLowerCase()}`}>{p.difficulty || 'Medium'}</span></td>
                      <td>{p.sourceName || 'Manual'}</td>
                      <td><strong>{p.requestsCount || 0}</strong></td>
                      <td>
                        <div className="action-btn-group">
                          <button className="btn-edit" onClick={() => handleEditClick(p)}>Edit</button>
                          <button className="btn-delete" onClick={() => handleDelete(p._id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {filteredProblems.length > itemsPerPage && (
          <div className="ai-pagination">
            <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={safePage === 1}>
              Previous
            </button>
            <span>Page {safePage} of {totalPages}</span>
            <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={safePage === totalPages}>
              Next
            </button>
          </div>
        )}
      </div>

      {editingProblem && (
        <div className="ai-modal-overlay" onClick={() => setEditingProblem(null)}>
          <div className="ai-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Edit AI Problem Statement</h3>
            <form onSubmit={handleSaveEdit}>
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  rows="4"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  required
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Domain</label>
                  <input
                    type="text"
                    value={editForm.domain}
                    onChange={(e) => setEditForm({ ...editForm, domain: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Difficulty</label>
                  <select
                    value={editForm.difficulty}
                    onChange={(e) => setEditForm({ ...editForm, difficulty: e.target.value })}
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Technologies (comma separated)</label>
                <input
                  type="text"
                  value={editForm.technologies}
                  onChange={(e) => setEditForm({ ...editForm, technologies: e.target.value })}
                />
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn-save">Save Changes</button>
                <button type="button" className="btn-cancel" onClick={() => setEditingProblem(null)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminAIManagement;
