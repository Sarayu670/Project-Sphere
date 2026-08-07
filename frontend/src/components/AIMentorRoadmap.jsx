import React, { useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';
import './AIMentorRoadmap.css';

function AIMentorRoadmap({ batchId, userRole = 'student' }) {
  const [roadmap, setRoadmap] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [expandedPhase, setExpandedPhase] = useState(1);
  const [updatingTask, setUpdatingTask] = useState(null);

  const fetchRoadmap = useCallback(async () => {
    if (!batchId) return;
    setLoading(true);
    try {
      const res = await api.getBatchRoadmap(batchId);
      setRoadmap(res.data.data);
    } catch (err) {
      console.error('Failed to fetch roadmap:', err);
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => {
    fetchRoadmap();
  }, [fetchRoadmap]);

  const handleRegenerate = async () => {
    if (!window.confirm('Regenerate AI Roadmap? This will re-align all milestone phases with your problem statement.')) return;
    setRegenerating(true);
    try {
      const res = await api.regenerateBatchRoadmap(batchId);
      setRoadmap(res.data.data);
    } catch (err) {
      alert('Failed to regenerate roadmap: ' + (err.response?.data?.message || err.message));
    } finally {
      setRegenerating(false);
    }
  };

  const handleToggleTask = async (phaseIndex, taskIndex, currentStatus) => {
    setUpdatingTask(`${phaseIndex}-${taskIndex}`);
    try {
      const res = await api.updateMilestoneTask(batchId, {
        phaseIndex,
        taskIndex,
        completed: !currentStatus
      });
      setRoadmap(res.data.data);
    } catch (err) {
      console.error('Task update failed:', err);
    } finally {
      setUpdatingTask(null);
    }
  };

  if (loading) {
    return (
      <div className="roadmap-skeleton-card">
        <div className="skeleton-line title"></div>
        <div className="skeleton-line desc"></div>
        <div className="skeleton-line box"></div>
      </div>
    );
  }

  if (!roadmap) {
    return (
      <div className="roadmap-empty-card">
        <h3>🗺️ No AI Roadmap Available</h3>
        <p>Ensure your team is allotted a problem statement to generate an AI-tailored project roadmap.</p>
      </div>
    );
  }

  // Calculate overall task progress
  let totalTasks = 0;
  let completedTasks = 0;
  roadmap.milestones?.forEach(m => {
    m.tasks?.forEach(t => {
      totalTasks++;
      if (t.completed) completedTasks++;
    });
  });

  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="ai-roadmap-container">
      {/* Header Banner */}
      <div className="roadmap-header">
        <div className="roadmap-header-left">
          <h2>🗺️ AI Project Mentor & Personalised Roadmap</h2>
          <p className="problem-title">Project: <strong>{roadmap.problemTitle}</strong></p>
          <div className="roadmap-meta-tags">
            <span className="meta-tag domain">🧠 {roadmap.domain}</span>
            <span className="meta-tag tasks">✅ {completedTasks} / {totalTasks} Tasks Finalized</span>
          </div>
        </div>

        <div className="roadmap-header-right">
          <button
            className="btn-regenerate-roadmap"
            disabled={regenerating}
            onClick={handleRegenerate}
            title="Regenerate AI Roadmap tailored to current requirements"
          >
            {regenerating ? '⌛ AI Generator Working...' : '⚡ Regenerate AI Roadmap'}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="roadmap-progress-card">
        <div className="progress-label-row">
          <span>Overall Project Execution Progress</span>
          <span className="percent-text">{progressPercent}%</span>
        </div>
        <div className="roadmap-progress-track">
          <div
            className="roadmap-progress-bar"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
      </div>

      {/* Tech Stack Chips */}
      {roadmap.techStack && roadmap.techStack.length > 0 && (
        <div className="tech-stack-container">
          <span className="tech-stack-label">🛠️ Recommended Tech Stack:</span>
          <div className="tech-chips-row">
            {roadmap.techStack.map((tech, idx) => (
              <span key={idx} className="tech-chip">⚡ {tech}</span>
            ))}
          </div>
        </div>
      )}

      {/* AI Executive Summary */}
      {roadmap.aiSummary && (
        <div className="ai-summary-box">
          🤖 <strong>AI Mentor Note:</strong> {roadmap.aiSummary}
        </div>
      )}

      {/* Milestone Phases Stepper */}
      <div className="milestones-stepper">
        {roadmap.milestones?.map((milestone, pIdx) => {
          const isExpanded = expandedPhase === milestone.phase;
          const isCompleted = milestone.status === 'completed';
          const phaseTasksCount = milestone.tasks?.length || 0;
          const phaseDoneCount = milestone.tasks?.filter(t => t.completed).length || 0;

          return (
            <div
              key={milestone.phase}
              className={`milestone-phase-card ${isCompleted ? 'phase-completed' : ''} ${milestone.status === 'in_progress' ? 'phase-active' : ''}`}
            >
              <div
                className="phase-card-header"
                onClick={() => setExpandedPhase(isExpanded ? null : milestone.phase)}
              >
                <div className="phase-badge">
                  <span>Phase {milestone.phase}</span>
                </div>

                <div className="phase-info">
                  <h3 className="phase-title">{milestone.title}</h3>
                  <span className="phase-target-week">🗓️ Target Completion: Week {milestone.targetWeek}</span>
                </div>

                <div className="phase-status-right">
                  <span className={`status-pill pill-${milestone.status}`}>
                    {milestone.status === 'completed' ? '✓ Completed' : milestone.status === 'in_progress' ? '⚡ In Progress' : '⏳ Pending'}
                  </span>
                  <span className="task-counter">{phaseDoneCount}/{phaseTasksCount} Tasks</span>
                  <span className="accordion-icon">{isExpanded ? '▲' : '▼'}</span>
                </div>
              </div>

              {/* Accordion Content */}
              {isExpanded && (
                <div className="phase-card-body">
                  <p className="phase-desc">{milestone.description}</p>

                  <div className="sub-section">
                    <h4>📋 Milestone Tasks</h4>
                    <div className="tasks-list">
                      {milestone.tasks?.map((task, tIdx) => (
                        <div
                          key={tIdx}
                          className={`task-item ${task.completed ? 'task-done' : ''}`}
                          onClick={() => userRole === 'student' && handleToggleTask(pIdx, tIdx, task.completed)}
                        >
                          <input
                            type="checkbox"
                            checked={task.completed}
                            onChange={() => {}}
                            disabled={updatingTask === `${pIdx}-${tIdx}`}
                          />
                          <span className="task-text">{task.title}</span>
                          {task.completedAt && (
                            <span className="task-done-time">
                              Done {new Date(task.completedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {milestone.deliverables && milestone.deliverables.length > 0 && (
                    <div className="sub-section deliverables-section">
                      <h4>📦 Target Deliverables</h4>
                      <div className="deliverables-row">
                        {milestone.deliverables.map((deliv, dIdx) => (
                          <span key={dIdx} className="deliverable-tag">📄 {deliv}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AIMentorRoadmap;
