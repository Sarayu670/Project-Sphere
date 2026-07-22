import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';
import './AdminAIManagement.css';

function AdminAIManagement() {
  const [stats, setStats] = useState(null);
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [crawling, setCrawling] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('overview'); // 'overview' | 'statements' | 'logs'
  const [searchTerm, setSearchTerm] = useState('');
  const [domainFilter, setDomainFilter] = useState('All');
  const [editingProblem, setEditingProblem] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', domain: '', difficulty: '', technologies: '', sourceName: '', sourceUrl: '' });
  const [notification, setNotification] = useState(null);

  const fetchStatsAndData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, problemsRes] = await Promise.all([
        api.getAICrawlerStats(),
        api.getAIProblems({ status: 'approved' })
      ]);
      setStats(statsRes.data.data);
      setProblems(problemsRes.data.data || []);
    } catch (err) {
      console.error('Failed to fetch AI agent stats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatsAndData();
  }, [fetchStatsAndData]);

  const handleTriggerCrawl = async () => {
    setCrawling(true);
    setNotification(null);
    try {
      const res = await api.triggerAICrawl();
      const info = res.data.data;
      setNotification({
        type: 'success',
        text: `🚀 AI Agent Crawl Completed! Harvested ${info.totalCollected} total statements, added ${info.insertedCount} new items, and automatically filtered out ${info.duplicatesRemoved} duplicates.`
      });
      fetchStatsAndData();
    } catch (err) {
      setNotification({
        type: 'danger',
        text: err.response?.data?.message || 'Failed to trigger AI Crawler.'
      });
    } finally {
      setCrawling(false);
    }
  };

  const handleEditClick = (problem) => {
    setEditingProblem(problem);
    setEditForm({
      title: problem.title,
      description: problem.description,
      domain: problem.domain,
      difficulty: problem.difficulty,
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
      fetchStatsAndData();
      setNotification({ type: 'success', text: 'Problem statement updated successfully!' });
    } catch (err) {
      alert('Failed to update problem statement: ' + (err.response?.data?.message || err.message));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this AI Problem Statement?')) return;
    try {
      await api.deleteAIProblem(id);
      fetchStatsAndData();
      setNotification({ type: 'success', text: 'Problem statement deleted successfully!' });
    } catch (err) {
      alert('Failed to delete: ' + (err.response?.data?.message || err.message));
    }
  };

  const filteredProblems = problems.filter(p => {
    if (domainFilter !== 'All' && p.domain !== domainFilter) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="admin-ai-container">
      {/* Banner */}
      <div className="admin-ai-banner">
        <div className="banner-left">
          <h2>🤖 AI Problem Agent Management Control</h2>
          <p>Monitor periodic crawl tasks, manage semantic duplicate filters, and review domain-wise collection distributions.</p>
        </div>
        <button
          className="btn-trigger-crawl"
          disabled={crawling}
          onClick={handleTriggerCrawl}
        >
          {crawling ? '⌛ Crawling Trusted Sources...' : '⚡ Trigger AI Collection Manually'}
        </button>
      </div>

      {notification && (
        <div className={`notification-bar alert-${notification.type}`}>
          {notification.text}
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="admin-stats-row">
          <div className="ai-stat-card">
            <div className="stat-icon">📥</div>
            <div className="stat-info">
              <span className="stat-number">{stats.totalAIProblems || 0}</span>
              <span className="stat-label">Total Collected Statements</span>
            </div>
          </div>

          <div className="ai-stat-card">
            <div className="stat-icon">🛡️</div>
            <div className="stat-info">
              <span className="stat-number">{stats.totalDuplicatesRemoved || 0}</span>
              <span className="stat-label">Duplicates Filtered</span>
            </div>
          </div>

          <div className="ai-stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-info">
              <span className="stat-number">{stats.approvedCount || 0}</span>
              <span className="stat-label">Active Approved</span>
            </div>
          </div>

          <div className="ai-stat-card">
            <div className="stat-icon">🏷️</div>
            <div className="stat-info">
              <span className="stat-number">{Object.keys(stats.domainDistribution || {}).length}</span>
              <span className="stat-label">Active Domains</span>
            </div>
          </div>
        </div>
      )}

      {/* Sub Tabs */}
      <div className="admin-ai-tabs">
        <button
          className={`ai-tab-btn ${activeSubTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('overview')}
        >
          📊 Collection Distribution
        </button>
        <button
          className={`ai-tab-btn ${activeSubTab === 'statements' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('statements')}
        >
          📋 Manage Statements ({filteredProblems.length})
        </button>
        <button
          className={`ai-tab-btn ${activeSubTab === 'logs' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('logs')}
        >
          📜 Crawler Logs
        </button>
      </div>

      {/* Tab Content: Distribution Overview */}
      {activeSubTab === 'overview' && stats && (
        <div className="admin-tab-section">
          <h3>Domain-Wise Distribution Analysis</h3>
          <div className="domain-grid">
            {Object.entries(stats.domainDistribution || {}).map(([domain, count]) => (
              <div className="domain-card" key={domain}>
                <div className="domain-card-header">
                  <span className="domain-name">🧠 {domain}</span>
                  <span className="domain-count">{count}</span>
                </div>
                <div className="progress-bar-bg">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${Math.min(100, (count / (stats.totalAIProblems || 1)) * 100 * 3)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          <h3 style={{ marginTop: '28px' }}>Trusted Sources Breakdown</h3>
          <div className="source-row">
            {Object.entries(stats.sourceDistribution || {}).map(([source, count]) => (
              <div className="source-chip" key={source}>
                🌐 <strong>{source}</strong>: {count} ideas harvested
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content: Manage Statements */}
      {activeSubTab === 'statements' && (
        <div className="admin-tab-section">
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
              {stats && Object.keys(stats.domainDistribution || {}).map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

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
                    <td colSpan="6" style={{ textAlign: 'center', padding: '30px' }}>
                      No statements found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredProblems.map(p => (
                    <tr key={p._id}>
                      <td className="cell-title">
                        <strong>{p.title}</strong>
                        <div className="cell-desc">{p.description.substring(0, 90)}...</div>
                      </td>
                      <td><span className="badge-domain">{p.domain}</span></td>
                      <td><span className={`badge-diff diff-${p.difficulty.toLowerCase()}`}>{p.difficulty}</span></td>
                      <td>{p.sourceName}</td>
                      <td><strong>{p.requestsCount || 0}</strong></td>
                      <td>
                        <div className="action-btn-group">
                          <button className="btn-edit" onClick={() => handleEditClick(p)}>✏️ Edit</button>
                          <button className="btn-delete" onClick={() => handleDelete(p._id)}>🗑️ Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: Logs */}
      {activeSubTab === 'logs' && stats && (
        <div className="admin-tab-section">
          <h3>Execution & Deduplication Logs</h3>
          <table className="ai-admin-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Triggered By</th>
                <th>Sources</th>
                <th>Total Collected</th>
                <th>Duplicates Filtered</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {(stats.recentLogs || []).map(log => (
                <tr key={log._id}>
                  <td>{new Date(log.timestamp).toLocaleString()}</td>
                  <td><span className="tag-trigger">{log.triggeredBy}</span></td>
                  <td>{log.source}</td>
                  <td><strong>{log.totalCollected}</strong></td>
                  <td><strong style={{ color: '#dc2626' }}>{log.duplicatesRemoved}</strong></td>
                  <td><span className={`status-pill ${log.status}`}>{log.status}</span></td>
                  <td className="cell-details">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      {editingProblem && (
        <div className="ai-modal-overlay" onClick={() => setEditingProblem(null)}>
          <div className="ai-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>✏️ Edit AI Problem Statement</h3>
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
