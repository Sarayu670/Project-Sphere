import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';
import './AIProblemExplorer.css';

const DOMAINS = [
  'All',
  'AI & Machine Learning',
  'Web Development',
  'Cybersecurity',
  'IoT & Embedded Systems',
  'Cloud Computing',
  'Blockchain',
  'Data Science',
  'Mobile App Development'
];

const DIFFICULTIES = ['All', 'Easy', 'Medium', 'Hard'];
const TARGET_YEARS = ['2nd', '3rd', '4th'];

function AIProblemExplorer({ userRole, onRequestSubmitted, batch: initialBatch }) {
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [selectedTech, setSelectedTech] = useState('');
  const [selectedProblem, setSelectedProblem] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [myBatch, setMyBatch] = useState(initialBatch || null);
  const [coes, setCoes] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Guide Adoption Form State
  const [adoptingProblem, setAdoptingProblem] = useState(null);
  const [adoptForm, setAdoptForm] = useState({ coeId: '', targetYear: '3rd' });

  // Fetch Student Batch info for real-time request tracking
  const fetchMyBatch = useCallback(async () => {
    if (userRole !== 'student') return;
    try {
      const res = await api.getMyBatch();
      setMyBatch(res.data.data);
    } catch (err) {
      setMyBatch(null);
    }
  }, [userRole]);

  // Fetch COEs for Guide adoption
  const fetchCOEs = useCallback(async () => {
    if (userRole !== 'guide') return;
    try {
      const res = await api.getAllCOEs();
      setCoes(res.data.data || []);
      if (res.data.data && res.data.data.length > 0) {
        setAdoptForm(prev => ({ ...prev, coeId: res.data.data[0]._id }));
      }
    } catch (err) {
      console.error('Failed to fetch COEs:', err);
    }
  }, [userRole]);

  const fetchProblems = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (selectedDomain !== 'All') params.domain = selectedDomain;
      if (selectedDifficulty !== 'All') params.difficulty = selectedDifficulty;
      if (selectedTech.trim()) params.technology = selectedTech.trim();
      if (userRole === 'student') params.onlyOffered = 'true';

      const res = await api.getAIProblems(params);

      setProblems(res.data.data || []);
    } catch (err) {
      console.error('Failed to fetch AI problems:', err);
    } finally {
      setLoading(false);
    }
  }, [search, selectedDomain, selectedDifficulty, selectedTech]);

  useEffect(() => {
    fetchProblems();
    fetchMyBatch();
    fetchCOEs();
  }, [fetchProblems, fetchMyBatch, fetchCOEs]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedDomain, selectedDifficulty, selectedTech]);

  // Helper: check if a problem statement is requested by the current student batch
  const checkProblemStatus = (problem) => {
    if (!myBatch) return null;

    const optedList = myBatch.optedProblems || [];
    for (const opt of optedList) {
      const pTitle = typeof opt.problemId === 'object' ? opt.problemId?.title : '';
      const pId = typeof opt.problemId === 'object' ? opt.problemId?._id : opt.problemId;

      if (
        (pTitle && pTitle.toLowerCase() === problem.title.toLowerCase()) ||
        String(pId) === String(problem._id)
      ) {
        return opt.status || 'pending';
      }
    }

    if (myBatch.problemId) {
      const allottedTitle = typeof myBatch.problemId === 'object' ? myBatch.problemId?.title : '';
      if (allottedTitle && allottedTitle.toLowerCase() === problem.title.toLowerCase()) {
        return 'accepted';
      }
    }

    return null;
  };

  const handleRequestProblem = async (problemId) => {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await api.requestAIProblem(problemId);
      const updatedBatch = res.data.data;
      setMyBatch(updatedBatch);

      setMessage({ type: 'success', text: '✅ Request submitted successfully! Status updated to Pending Approval.' });
      
      if (onRequestSubmitted) {
        onRequestSubmitted();
      }

      // Re-fetch problems to get latest server state
      fetchProblems();

      setTimeout(() => setSelectedProblem(null), 1800);
    } catch (err) {
      setMessage({
        type: 'danger',
        text: err.response?.data?.message || 'Failed to submit request for this problem statement.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdoptByGuide = async (e) => {
    e.preventDefault();
    if (!adoptingProblem || !adoptForm.coeId) {
      alert('Please select a COE / RC');
      return;
    }

    setActionLoading(true);
    try {
      await api.adoptAIProblem(adoptingProblem._id, adoptForm);
      alert('✅ AI Problem Statement selected and offered to students!');
      setAdoptingProblem(null);
      fetchProblems();
    } catch (err) {
      alert('Failed to select problem statement: ' + (err.response?.data?.message || err.message));
    } finally {
      setActionLoading(false);
    }
  };

  const getDifficultyBadge = (level) => {
    switch (level) {
      case 'Easy': return 'difficulty-easy';
      case 'Medium': return 'difficulty-medium';
      case 'Hard': return 'difficulty-hard';
      default: return 'difficulty-medium';
    }
  };

  const totalPages = Math.max(1, Math.ceil(problems.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * itemsPerPage;
  const paginatedProblems = problems.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="ai-explorer-container">
      <div className="ai-explorer-header">
        <div className="ai-title-section">
          <h2>🤖 AI Problem Statement Hub</h2>
          <p>
            {userRole === 'student'
              ? 'Browse problem statements selected and offered by Guides. Select one to request mentoring!'
              : 'Explore AI-curated academic project ideas. Select statements to offer them to students!'}
          </p>
        </div>
        <div className="ai-badge-chip">
          <span>✨ AI Agent Live Sync</span>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="ai-filter-card">
        <div className="ai-search-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search AI project ideas by title, keyword, or tech..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="clear-search-btn" onClick={() => setSearch('')}>✕</button>
          )}
        </div>

        <div className="ai-filter-row">
          <div className="filter-group">
            <label>Domain</label>
            <select value={selectedDomain} onChange={(e) => setSelectedDomain(e.target.value)}>
              {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label>Difficulty</label>
            <select value={selectedDifficulty} onChange={(e) => setSelectedDifficulty(e.target.value)}>
              {DIFFICULTIES.map(diff => <option key={diff} value={diff}>{diff}</option>)}
            </select>
          </div>

          <div className="filter-group">
            <label>Technology Stack</label>
            <input
              type="text"
              placeholder="e.g. React, Python, TensorFlow"
              value={selectedTech}
              onChange={(e) => setSelectedTech(e.target.value)}
            />
          </div>

          <button className="reset-filters-btn" onClick={() => {
            setSearch('');
            setSelectedDomain('All');
            setSelectedDifficulty('All');
            setSelectedTech('');
          }}>
            Reset
          </button>
        </div>
      </div>

      {/* Results Info */}
      <div className="ai-results-info">
        <span>Found <strong>{problems.length}</strong> validated problem statement{problems.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="ai-cards-grid">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="ai-card skeleton-card">
              <div className="skeleton-line title"></div>
              <div className="skeleton-line desc"></div>
              <div className="skeleton-line tags"></div>
            </div>
          ))}
        </div>
      ) : problems.length === 0 ? (
        <div className="ai-empty-state">
          <div className="empty-icon">🤖</div>
          <h3>No Problem Statements Found</h3>
          <p>
            {userRole === 'student'
              ? 'No problem statements have been offered by Guides yet. Check back soon or request your Guide to select ideas!'
              : 'Try adjusting your search criteria.'}
          </p>
        </div>
      ) : (
        <div className="ai-cards-grid">
          {paginatedProblems.map(problem => {
            const status = checkProblemStatus(problem);
            const isRequested = !!status;
            const isOfferedByGuide = problem.isSelectedByGuide || (problem.offeredByGuides && problem.offeredByGuides.length > 0);

            return (
              <div className={`ai-card ${isRequested ? 'card-requested' : ''}`} key={problem._id}>
                <div className="ai-card-top">
                  <span className="source-tag">🌐 {problem.sourceName || 'Public Portal'}</span>
                  <span className={`difficulty-tag ${getDifficultyBadge(problem.difficulty)}`}>
                    {problem.difficulty}
                  </span>
                </div>

                <h3 className="ai-card-title">{problem.title}</h3>

                <div className="domain-pill-row">
                  <span className="domain-pill">🧠 {problem.domain}</span>
                  {isOfferedByGuide && (
                    <span className="guide-offered-badge">👨‍🏫 Guide Approved</span>
                  )}
                </div>

                {isRequested && (
                  <div className={`status-banner banner-${status}`}>
                    {status === 'accepted' ? '✅ Allotted to Your Team' : '⌛ Request Pending Guide Approval'}
                  </div>
                )}

                <p className="ai-card-desc">
                  {problem.description.length > 130
                    ? `${problem.description.substring(0, 130)}...`
                    : problem.description}
                </p>

                {problem.technologies && problem.technologies.length > 0 && (
                  <div className="tech-stack-row">
                    {problem.technologies.slice(0, 4).map((tech, idx) => (
                      <span key={idx} className="tech-badge">⚡ {tech}</span>
                    ))}
                    {problem.technologies.length > 4 && (
                      <span className="tech-badge more">+{problem.technologies.length - 4}</span>
                    )}
                  </div>
                )}

                <div className="ai-card-footer">
                  {userRole === 'guide' && (
                    <button
                      className={`btn-guide-adopt ${isOfferedByGuide ? 'offered' : ''}`}
                      onClick={() => {
                        setAdoptingProblem(problem);
                        if (coes.length > 0) setAdoptForm(prev => ({ ...prev, coeId: coes[0]._id }));
                      }}
                    >
                      {isOfferedByGuide ? '✓ Offered to Students (Re-offer)' : '📌 Select & Offer to Students'}
                    </button>
                  )}

                  <button
                    className={`btn-view-details ${isRequested ? 'btn-requested' : ''}`}
                    onClick={() => { setSelectedProblem(problem); setMessage(null); }}
                  >
                    {isRequested ? '✓ View Status & Details' : 'View Details & Opt →'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && problems.length > itemsPerPage && (
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

      {/* Modal Detail Dialog */}
      {selectedProblem && (() => {
        const status = checkProblemStatus(selectedProblem);
        const isRequested = !!status;

        return (
          <div className="ai-modal-overlay" onClick={() => setSelectedProblem(null)}>
            <div className="ai-modal-content" onClick={(e) => e.stopPropagation()}>
              <button className="modal-close-btn" onClick={() => setSelectedProblem(null)}>✕</button>

              <div className="modal-header">
                <span className="source-tag">🌐 Source: {selectedProblem.sourceName}</span>
                <span className={`difficulty-tag ${getDifficultyBadge(selectedProblem.difficulty)}`}>
                  Difficulty: {selectedProblem.difficulty}
                </span>
              </div>

              <h2 className="modal-title">{selectedProblem.title}</h2>

              {isRequested && (
                <div className={`modal-status-callout callout-${status}`}>
                  {status === 'accepted'
                    ? '🎉 This problem has been Allotted to your team!'
                    : '⏳ You have submitted a request for this problem statement. Waiting for Guide approval.'}
                </div>
              )}

              <div className="modal-meta-row">
                <span className="meta-badge domain">📚 Domain: {selectedProblem.domain}</span>
                {selectedProblem.dateCollected && (
                  <span className="meta-badge date">
                    📅 Collected: {new Date(selectedProblem.dateCollected).toLocaleDateString()}
                  </span>
                )}
              </div>

              {selectedProblem.offeredByGuides && selectedProblem.offeredByGuides.length > 0 && (
                <div className="modal-section guide-section">
                  <h4>👨‍🏫 Offered By Guide</h4>
                  <div className="guide-info-pill">
                    👤 <strong>{selectedProblem.offeredByGuides[0].guideId?.name || 'Assigned Guide'}</strong>
                    {selectedProblem.offeredByGuides[0].coeId?.name && (
                      <span> ({selectedProblem.offeredByGuides[0].coeId.name})</span>
                    )}
                  </div>
                </div>
              )}

              <div className="modal-section">
                <h4>📝 Problem Description</h4>
                <p className="modal-desc-text">{selectedProblem.description}</p>
              </div>

              {selectedProblem.technologies && selectedProblem.technologies.length > 0 && (
                <div className="modal-section">
                  <h4>🛠️ Required Technologies</h4>
                  <div className="modal-tech-list">
                    {selectedProblem.technologies.map((t, idx) => (
                      <span key={idx} className="modal-tech-tag">⚡ {t}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedProblem.keywords && selectedProblem.keywords.length > 0 && (
                <div className="modal-section">
                  <h4>🏷️ Tags & Keywords</h4>
                  <div className="modal-keywords-list">
                    {selectedProblem.keywords.map((k, idx) => (
                      <span key={idx} className="modal-keyword-tag">#{k}</span>
                    ))}
                  </div>
                </div>
              )}

              {selectedProblem.sourceUrl && (
                <div className="modal-section">
                  <h4>🔗 Reference Link</h4>
                  <a href={selectedProblem.sourceUrl} target="_blank" rel="noopener noreferrer" className="source-link">
                    {selectedProblem.sourceUrl} ↗
                  </a>
                </div>
              )}

              {message && (
                <div className={`modal-alert alert-${message.type}`}>
                  {message.text}
                </div>
              )}

              <div className="modal-actions">
                {userRole === 'student' && (
                  <button
                    className={`btn-request-problem ${isRequested ? 'disabled' : ''}`}
                    disabled={actionLoading || isRequested}
                    onClick={() => handleRequestProblem(selectedProblem._id)}
                  >
                    {actionLoading
                      ? 'Submitting Request...'
                      : isRequested
                      ? '✓ Request Submitted (Pending Approval)'
                      : '✨ Request to Work on This Problem'}
                  </button>
                )}
                <button className="btn-close-modal" onClick={() => setSelectedProblem(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Guide Adoption Modal Dialog */}
      {adoptingProblem && (
        <div className="ai-modal-overlay" onClick={() => setAdoptingProblem(null)}>
          <div className="ai-modal-content adopt-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setAdoptingProblem(null)}>✕</button>
            <h3>📌 Offer Problem Statement to Students</h3>
            <p style={{ color: '#64748b', fontSize: '14px' }}>
              Select a COE/RC and target year to offer <strong>"{adoptingProblem.title}"</strong> to your students.
            </p>

            <form onSubmit={handleAdoptByGuide}>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label style={{ fontWeight: '700', fontSize: '13px' }}>COE / RC <span style={{ color: 'red' }}>*</span></label>
                <select
                  value={adoptForm.coeId}
                  onChange={(e) => setAdoptForm({ ...adoptForm, coeId: e.target.value })}
                  required
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  <option value="">Select COE / RC</option>
                  {coes.map(c => (
                    <option key={c._id} value={c._id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ fontWeight: '700', fontSize: '13px' }}>Target Year <span style={{ color: 'red' }}>*</span></label>
                <select
                  value={adoptForm.targetYear}
                  onChange={(e) => setAdoptForm({ ...adoptForm, targetYear: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                >
                  {TARGET_YEARS.map(y => (
                    <option key={y} value={y}>{y} Year</option>
                  ))}
                </select>
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn-request-problem" disabled={actionLoading}>
                  {actionLoading ? 'Saving...' : '✅ Offer Statement to Students'}
                </button>
                <button type="button" className="btn-close-modal" onClick={() => setAdoptingProblem(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AIProblemExplorer;
