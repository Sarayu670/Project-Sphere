import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';
import './AIProgressMonitorCard.css';

function AIProgressMonitorCard({ batchId, userRole = 'student' }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('recommendations'); // 'recommendations' | 'delayed' | 'pending' | 'completed'

  const fetchAnalysis = useCallback(async () => {
    if (!batchId) return;
    setLoading(true);
    try {
      const res = await api.getBatchProgressAnalysis(batchId);
      setAnalysis(res.data.data);
    } catch (err) {
      console.error('Failed to fetch progress analysis:', err);
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await api.refreshBatchProgressAnalysis(batchId);
      setAnalysis(res.data.data);
    } catch (err) {
      alert('Failed to refresh progress analysis');
    } finally {
      setRefreshing(false);
    }
  };

  const getHealthColorClass = (status) => {
    switch (status) {
      case 'Ahead of Schedule': return 'health-emerald';
      case 'On Track': return 'health-indigo';
      case 'At Risk': return 'health-amber';
      case 'Delayed': return 'health-rose';
      default: return 'health-indigo';
    }
  };

  if (loading) {
    return (
      <div className="ai-monitor-skeleton">
        <div className="skeleton-line score"></div>
        <div className="skeleton-line text"></div>
      </div>
    );
  }

  if (!analysis) return null;

  const filteredRecs = (analysis.adaptiveRecommendations || []).filter(r => {
    if (userRole === 'student') return r.targetRole === 'student' || r.targetRole === 'both';
    if (userRole === 'guide') return r.targetRole === 'guide' || r.targetRole === 'both';
    return true;
  });

  return (
    <div className="ai-monitor-card">
      {/* Top Banner */}
      <div className="monitor-top-banner">
        <div className="health-score-container">
          <div className={`health-score-badge ${getHealthColorClass(analysis.healthStatus)}`}>
            <span className="score-num">{analysis.healthScore}</span>
            <span className="score-percent">%</span>
          </div>

          <div className="health-info">
            <div className="health-title-row">
              <h3>AI Health Score & Progress Monitor</h3>
              <span className={`status-badge-pill ${getHealthColorClass(analysis.healthStatus)}`}>
                ● {analysis.healthStatus}
              </span>
            </div>
            <p className="health-subtext">
              Continuously analyzing project milestones, submissions, guide feedback, and deadlines.
            </p>
          </div>
        </div>

        <button
          className="btn-refresh-monitor"
          disabled={refreshing}
          onClick={handleRefresh}
          title="Re-analyze project progress and update AI recommendations"
        >
          {refreshing ? '⌛ Analyzing...' : '🔄 Re-Analyze Progress'}
        </button>
      </div>

      {/* Tabs Bar */}
      <div className="monitor-tabs-bar">
        <button
          className={`monitor-tab-btn ${activeTab === 'recommendations' ? 'active' : ''}`}
          onClick={() => setActiveTab('recommendations')}
        >
          🤖 Adaptive AI Recommendations ({filteredRecs.length})
        </button>
        <button
          className={`monitor-tab-btn ${activeTab === 'delayed' ? 'active' : ''}`}
          onClick={() => setActiveTab('delayed')}
        >
          🚨 Delayed ({analysis.delayedActivities?.length || 0})
        </button>
        <button
          className={`monitor-tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          ⏳ Pending ({analysis.pendingActivities?.length || 0})
        </button>
        <button
          className={`monitor-tab-btn ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('completed')}
        >
          ✅ Completed ({analysis.completedActivities?.length || 0})
        </button>
      </div>

      {/* Tab 1: Recommendations Feed */}
      {activeTab === 'recommendations' && (
        <div className="monitor-content-area">
          {filteredRecs.length === 0 ? (
            <div className="monitor-empty-state">
              <p>🎉 No urgent AI recommendations at this time. Project is progressing smoothly!</p>
            </div>
          ) : (
            <div className="recommendations-feed">
              {filteredRecs.map((rec, idx) => (
                <div key={idx} className={`rec-card rec-${rec.type}`}>
                  <div className="rec-header">
                    <span className="rec-title">{rec.title}</span>
                    <span className="rec-target">Role: {rec.targetRole}</span>
                  </div>

                  <p className="rec-message">{rec.message}</p>

                  {rec.suggestedAction && (
                    <div className="rec-action-box">
                      💡 <strong>Suggested Action:</strong> {rec.suggestedAction}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Delayed Activities */}
      {activeTab === 'delayed' && (
        <div className="monitor-content-area">
          {(!analysis.delayedActivities || analysis.delayedActivities.length === 0) ? (
            <div className="monitor-empty-state">
              <p>✅ Zero delayed activities! All deadlines and milestones are up to date.</p>
            </div>
          ) : (
            <div className="activities-list">
              {analysis.delayedActivities.map((act, idx) => (
                <div key={idx} className="activity-item item-delayed">
                  <div className="act-icon">🚨</div>
                  <div className="act-details">
                    <strong>{act.title}</strong>
                    <p>{act.details}</p>
                    {act.dueDate && <span className="act-date">Due Date: {new Date(act.dueDate).toLocaleDateString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Pending Activities */}
      {activeTab === 'pending' && (
        <div className="monitor-content-area">
          {(!analysis.pendingActivities || analysis.pendingActivities.length === 0) ? (
            <div className="monitor-empty-state">
              <p>No upcoming pending activities.</p>
            </div>
          ) : (
            <div className="activities-list">
              {analysis.pendingActivities.map((act, idx) => (
                <div key={idx} className="activity-item item-pending">
                  <div className="act-icon">⏳</div>
                  <div className="act-details">
                    <strong>{act.title}</strong>
                    <p>{act.details}</p>
                    {act.dueDate && <span className="act-date">Target Date: {new Date(act.dueDate).toLocaleDateString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Completed Activities */}
      {activeTab === 'completed' && (
        <div className="monitor-content-area">
          {(!analysis.completedActivities || analysis.completedActivities.length === 0) ? (
            <div className="monitor-empty-state">
              <p>No completed activities logged yet.</p>
            </div>
          ) : (
            <div className="activities-list">
              {analysis.completedActivities.map((act, idx) => (
                <div key={idx} className="activity-item item-completed">
                  <div className="act-icon">✅</div>
                  <div className="act-details">
                    <strong>{act.title}</strong>
                    <p>{act.details}</p>
                    {act.completedDate && <span className="act-date">Completed: {new Date(act.completedDate).toLocaleDateString()}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AIProgressMonitorCard;
