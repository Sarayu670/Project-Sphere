import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ChatsListPanel.css';

const API_URL = '/api';

const ChatsListPanel = ({ batches, isOpen, onClose, onSelectTeam, onTotalCount }) => {
  const [chatsWithMessages, setChatsWithMessages] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchAllChats();
    }
  }, [isOpen, batches]);

  const fetchAllChats = async () => {
    try {
      setLoading(true);
      const chatCounts = {};
      let totalUnreadCount = 0;
      
      for (const batch of batches) {
        try {
          const response = await axios.get(`${API_URL}/chat/guide/batch/${batch._id}`);
          const chats = response.data.data || [];
          // Count only unread messages for this guide
          chatCounts[batch._id] = chats.reduce((acc, chat) => {
            if (chat.messages && chat.messages.length > 0) {
              // Check if guide has read this chat
              const guideHasRead = chat.readBy && chat.readBy.some(reader => reader.role === 'guide');
              let unreadCount = chat.messages.length;
              
              if (guideHasRead) {
                // Count only messages sent by student after guide read
                unreadCount = chat.messages.filter(msg => msg.senderType === 'student').length;
              }
              
              acc[chat.teamMemberId._id] = Math.max(0, unreadCount);
              totalUnreadCount += Math.max(0, unreadCount);
            }
            return acc;
          }, {});
        } catch (error) {
          console.error('Error fetching chats for batch:', batch._id);
        }
      }
      
      setChatsWithMessages(chatCounts);
      if (onTotalCount) {
        onTotalCount(totalUnreadCount);
      }
    } finally {
      setLoading(false);
    }
  };

  const getTotalUnreadCount = () => {
    return Object.values(chatsWithMessages).reduce((total, batchChats) => {
      return total + Object.values(batchChats).reduce((sum, count) => sum + count, 0);
    }, 0);
  };

  if (!isOpen) return null;

  return (
    <div className="chats-overlay" onClick={onClose}>
      <div className="chats-modal" onClick={(e) => e.stopPropagation()}>
        <div className="chats-header">
          <h2>Team Messages</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {loading && <div className="chats-loading">Loading...</div>}

        <div className="chats-list">
          {batches.length === 0 ? (
            <div className="no-chats">No teams assigned yet</div>
          ) : (
            batches.map(batch => {
              const batchChats = chatsWithMessages[batch._id] || {};
              const hasMessages = Object.keys(batchChats).length > 0;
              const totalMessages = Object.values(batchChats).reduce((a, b) => a + b, 0);

              return (
                <div key={batch._id} className="batch-chats-group">
                  <h3 className="batch-name">{batch.batchName || 'Batch'}</h3>
                  
                  {/* Show team cards */}
                  <div className="teams-in-batch">
                    {[batch].map(b => (
                      <div
                        key={b._id}
                        className={`team-chat-item ${hasMessages ? 'has-messages' : ''}`}
                        onClick={() => {
                          onSelectTeam({ batchId: b._id, teamMemberId: b.leaderStudentId?._id });
                          onClose();
                        }}
                      >
                        <div className="team-info">
                          <h4>{b.teamName}</h4>
                          <p>{b.leaderStudentId?.name || 'Team Leader'}</p>
                        </div>
                        {hasMessages && totalMessages > 0 && (
                          <div className="message-badge">{totalMessages}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {getTotalUnreadCount() > 0 && (
          <div className="chats-footer">
            <p>💬 {getTotalUnreadCount()} total messages</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatsListPanel;
