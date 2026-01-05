import { useState, useEffect } from 'react';
import * as api from '../../services/api';
import CreateBatch from './CreateBatch';
import TeamMembers from './TeamMembers';
import COEList from './COEList';
import ProblemList from './ProblemList';
import ProjectDetails from './ProjectDetails';
import TimelineProgress from './TimelineProgress';
import './StudentDashboard.css';

function StudentDashboard() {
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCOE, setSelectedCOE] = useState(null);

  const fetchBatch = async () => {
    try {
      const res = await api.getMyBatch();
      setBatch(res.data.data);
    } catch (error) {
      setBatch(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatch();
  }, []);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  // No batch created yet
  if (!batch) {
    return <CreateBatch onBatchCreated={fetchBatch} />;
  }

  // Check various states
  const hasOptedProblem = batch.optedProblemId;
  const isAllotted = batch.allotmentStatus === 'allotted';
  const isPending = batch.allotmentStatus === 'pending';

  // Count pending opted problems
  const pendingOptedCount = batch.optedProblems?.filter(o => o.status === 'pending')?.length || 0;

  // Can select if not allotted and has less than 3 pending selections
  const canSelectProblem = !isAllotted && pendingOptedCount < 3;

  const getStatusText = () => {
    if (isAllotted) return batch.status;
    if (pendingOptedCount > 0) return `Waiting for Guide Approval (${pendingOptedCount} pending)`;
    return 'Select a Problem Statement';
  };

  const getStatusClass = () => {
    if (isAllotted) return batch.status.toLowerCase().replace(' ', '-');
    if (pendingOptedCount > 0) return 'pending';
    return 'not-started';
  };

  return (
    <div className="student-dashboard">
      <div className="dashboard-header">
        <h1>👋 Welcome, Team {batch.teamName}</h1>
        <p>Status: <span className={`status-badge status-${getStatusClass()}`}>{getStatusText()}</span></p>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          📊 Overview
        </button>
        <button className={`tab ${activeTab === 'team' ? 'active' : ''}`} onClick={() => setActiveTab('team')}>
          👥 Team Members
        </button>
        {canSelectProblem && (
          <button className={`tab ${activeTab === 'select' ? 'active' : ''}`} onClick={() => setActiveTab('select')}>
            🔍 Select Problem
          </button>
        )}
        {isAllotted && (
          <>
            <button className={`tab ${activeTab === 'timeline' ? 'active' : ''}`} onClick={() => setActiveTab('timeline')}>
              📅 Timeline & Submissions
            </button>
          </>
        )}
      </div>

      <div className="tab-content">
        {activeTab === 'overview' && (
          <ProjectDetails batch={batch} isPending={isPending} isAllotted={isAllotted} />
        )}

        {activeTab === 'team' && (
          <TeamMembers batchId={batch._id} leader={batch.leaderStudentId} />
        )}

        {activeTab === 'select' && canSelectProblem && (
          selectedCOE ? (
            <ProblemList
              coeId={selectedCOE._id}
              coeName={selectedCOE.name}
              onBack={() => setSelectedCOE(null)}
              onProblemSelected={fetchBatch}
              batch={batch}
            />
          ) : (
            <COEList onCOESelect={setSelectedCOE} />
          )
        )}

        {activeTab === 'timeline' && isAllotted && (
          <TimelineProgress batchId={batch._id} />
        )}
      </div>
    </div>
  );
}

export default StudentDashboard;

