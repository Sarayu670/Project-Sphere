import { useState, useEffect } from 'react';
import * as api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import ChatPanel from '../../components/ChatPanel';
import { generateChatReport } from '../../utils/reportGenerator';
import CreateBatch from './CreateBatch';
import TeamMembers from './TeamMembers';
import COEList from './COEList';
import ProblemList from './ProblemList';
import ProjectDetails from './ProjectDetails';
import TimelineProgress from './TimelineProgress';
import './StudentDashboard.css';

function StudentDashboard() {
  const { user } = useAuth();
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedCOE, setSelectedCOE] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatData, setChatData] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

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
    
    // Fetch unread message count every 3 seconds when chat is closed
    if (!chatOpen && batch?._id) {
      const interval = setInterval(async () => {
        try {
          const leaderId = typeof batch?.leaderStudentId === 'object' 
            ? batch?.leaderStudentId._id 
            : batch?.leaderStudentId;
          
          if (leaderId && batch?._id) {
            const response = await api.get(`/chat/student/${batch._id}/${leaderId}`);
            if (response && response.data.data) {
              const msgs = response.data.data.messages || [];
              const readBy = response.data.data.readBy || [];
              
              // Find current user's last read timestamp
              const userReadData = readBy.find(reader => 
                reader.userId && 
                reader.userId.toString && 
                reader.userId.toString() === user?.id
              );
              const lastReadAt = userReadData?.lastReadAt ? new Date(userReadData.lastReadAt) : null;
              
              console.log('StudentDashboard DEBUG: user.id =', user?.id);
              console.log('StudentDashboard DEBUG: readBy =', readBy);
              console.log('StudentDashboard DEBUG: lastReadAt =', lastReadAt);
              
              // Count only messages from guide that came AFTER last read
              let unreadCount = 0;
              if (!lastReadAt) {
                // Never read before, count all guide messages
                unreadCount = msgs.filter(msg => msg.senderType === 'guide').length;
              } else {
                // Count only new messages from guide after last read
                unreadCount = msgs.filter(msg => 
                  msg.senderType === 'guide' && new Date(msg.timestamp) > lastReadAt
                ).length;
              }
              
              console.log('StudentDashboard DEBUG: unreadCount =', unreadCount);
              setUnreadCount(Math.max(0, unreadCount));
            }
          }
        } catch (error) {
          console.error('Error fetching unread count:', error);
        }
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [chatOpen, batch?._id, user?.id]);

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

  const handleOpenChat = async () => {
    try {
      const leaderId = typeof batch.leaderStudentId === 'object' 
        ? batch.leaderStudentId._id 
        : batch.leaderStudentId;
      
      if (leaderId) {
        try {
          const response = await api.get(`/chat/student/${batch._id}/${leaderId}`);
          setChatData(response.data.data);
        } catch (err) {
          // If chat doesn't exist yet, create a new one
          setChatData({ 
            _id: batch._id,
            batchId: batch, 
            teamMemberId: { _id: leaderId, teamName: batch.teamName },
            guideId: batch.guideId,
            messages: []
          });
        }
      }
      setChatOpen(true);
    } catch (error) {
      console.error('Error opening chat:', error);
    }
  };

  const handleDownloadReport = async () => {
    if (chatData && batch) {
      try {
        const guideName = batch.guideId?.name || 'Guide';
        generateChatReport(chatData, batch.teamName, guideName);
      } catch (error) {
        console.error('Error generating report:', error);
      }
    }
  };

  const handleChatLoaded = (data) => {
    setChatData(data);
    // When chat is opened, it's marked as read, so reset count to 0
    setUnreadCount(0);
  };

  const handleChatClose = () => {
    setChatOpen(false);
    // When chat closes, recalculate unread count from latest data
    if (chatData && chatData.messages && Array.isArray(chatData.messages)) {
      const readBy = chatData.readBy || [];
      
      // Find current user's read data
      let userReadData = null;
      for (const reader of readBy) {
        const readerUserId = reader.userId ? reader.userId.toString() : null;
        if (readerUserId === user?.id) {
          userReadData = reader;
          break;
        }
      }
      
      const lastReadAt = userReadData?.lastReadAt ? new Date(userReadData.lastReadAt) : null;
      
      console.log('handleChatClose - lastReadAt:', lastReadAt);
      console.log('handleChatClose - Total messages:', chatData.messages.length);
      
      if (!lastReadAt) {
        // Never read before, count all guide messages
        const unreadFromGuide = chatData.messages.filter(msg => msg.senderType === 'guide').length;
        console.log('handleChatClose - Never read, unread guide messages:', unreadFromGuide);
        setUnreadCount(unreadFromGuide);
      } else {
        // Count only new messages from guide after last read
        const unreadFromGuide = chatData.messages.filter(msg => {
          const msgTime = new Date(msg.timestamp);
          const isGuideMsg = msg.senderType === 'guide';
          const isAfterRead = msgTime > lastReadAt;
          console.log('Msg:', msg.senderName, 'Type:', msg.senderType, 'Time:', msgTime, 'After read?:', isAfterRead);
          return isGuideMsg && isAfterRead;
        }).length;
        console.log('handleChatClose - After read, unread guide messages:', unreadFromGuide);
        setUnreadCount(Math.max(0, unreadFromGuide));
      }
    }
  };

  return (
    <div className="student-dashboard">
      <div className="dashboard-header">
        <div className="header-left">
          <h1>👋 Welcome, Team {batch.teamName}</h1>
          <div className="status-info">
            <span className="status-label">Status:</span>
            <span className={`status-badge status-${getStatusClass()}`}>{getStatusText()}</span>
          </div>
        </div>
        <div className="header-right">
          {isAllotted && (
            <div className="header-actions">
              <button className="chat-btn" onClick={handleOpenChat} title="Chat with Guide">
                💬 Chat {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
              </button>
              <button className="report-btn" onClick={handleDownloadReport} title="Download Report" disabled={!chatData}>
                📄 Report
              </button>
            </div>
          )}
        </div>
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
          <TeamMembers batchId={batch._id} leader={batch.leaderStudentId} batchYear={batch.year} />
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

      <ChatPanel 
        batchId={batch._id} 
        teamMemberId={typeof batch.leaderStudentId === 'object' ? batch.leaderStudentId._id : batch.leaderStudentId}
        isOpen={chatOpen}
        onClose={handleChatClose}
        onChatLoaded={handleChatLoaded}
      />
    </div>
  );
}

export default StudentDashboard;

