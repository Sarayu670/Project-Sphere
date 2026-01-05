import { useState, useEffect } from 'react';
import * as api from '../../services/api';

const TARGET_YEARS = ['all', '2nd', '3rd', '4th'];

function TimelineManagement() {
  const [events, setEvents] = useState([]);
  const [batches, setBatches] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [formData, setFormData] = useState({
    title: '', description: '', deadline: '', maxMarks: '', submissionRequirements: '', targetYear: 'all', order: 0
  });

  // Filters
  const [filterYear, setFilterYear] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterSection, setFilterSection] = useState('');

  // Admin remarks state
  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [selectedSubmissionForRemark, setSelectedSubmissionForRemark] = useState(null);
  const [remarkText, setRemarkText] = useState('');
  const [expandedRemarkSubmission, setExpandedRemarkSubmission] = useState(null);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      console.log('🔄 FETCH START: Getting timeline events...');
      
      let eventsData = [];
      let batchesData = [];
      let submissionsData = [];
      
      // Fetch events - CRITICAL
      try {
        console.log('📡 Calling api.getAllTimelineEvents()...');
        const eventsRes = await api.getAllTimelineEvents();
        console.log('📦 Raw eventsRes:', eventsRes);
        
        if (Array.isArray(eventsRes.data)) {
          eventsData = eventsRes.data;
        } else if (eventsRes.data?.data && Array.isArray(eventsRes.data.data)) {
          eventsData = eventsRes.data.data;
        }
        console.log(`✅ EVENTS EXTRACTED: ${eventsData.length} events`);
        console.log('📋 Events:', eventsData);
      } catch (error) {
        console.error('❌ EVENTS FETCH ERROR:', error.message);
      }
      
      // Fetch batches
      try {
        console.log('📡 Calling api.getAllBatches()...');
        const batchesRes = await api.getAllBatches();
        batchesData = batchesRes.data?.data || batchesRes.data || [];
        console.log(`✅ BATCHES EXTRACTED: ${batchesData.length} batches`);
      } catch (error) {
        console.error('⚠️ BATCHES FETCH ERROR:', error.message);
      }
      
      // Fetch submissions - NOT CRITICAL
      try {
        console.log('📡 Calling api.getAllSubmissions()...');
        const submissionsRes = await api.getAllSubmissions();
        submissionsData = submissionsRes.data?.data || submissionsRes.data || [];
        console.log(`✅ SUBMISSIONS EXTRACTED: ${submissionsData.length} submissions`);
      } catch (error) {
        console.error('⚠️ SUBMISSIONS FETCH ERROR (non-critical):', error.message);
        // Don't fail completely, submissions are optional for viewing timeline
      }
      
      // Set state
      console.log('💾 Setting state with:', {
        eventsCount: eventsData.length,
        batchesCount: batchesData.length,
        submissionsCount: submissionsData.length
      });
      
      setEvents(eventsData);
      setBatches(batchesData);
      setSubmissions(submissionsData);
      setLoading(false);
      console.log('✅ FETCH COMPLETE');
      
    } catch (error) {
      console.error('❌ FETCH ERROR:', error.message);
      console.error('❌ Full error:', error);
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvents(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('Submitting form with data:', formData);
    try {
      if (editingEvent) {
        console.log('Updating event:', editingEvent._id);
        await api.updateTimelineEvent(editingEvent._id, formData);
      } else {
        console.log('Creating new event');
        await api.createTimelineEvent(formData);
      }
      console.log('Event saved successfully');
      setShowForm(false);
      setEditingEvent(null);
      setFormData({ title: '', description: '', deadline: '', maxMarks: '', submissionRequirements: '', targetYear: 'all', order: 0 });
      fetchEvents();
    } catch (error) {
      console.error('Failed to save event:', error);
      console.error('Error response:', error.response);
      alert(error.response?.data?.message || 'Failed to save event');
    }
  };

  const handleEdit = (event) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || '',
      deadline: event.deadline.split('T')[0],
      maxMarks: event.maxMarks,
      submissionRequirements: event.submissionRequirements || '',
      targetYear: event.targetYear,
      order: event.order || 0
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this timeline event?')) return;
    try {
      await api.deleteTimelineEvent(id);
      fetchEvents();
    } catch (error) {
      alert('Failed to delete');
    }
  };

  const getStatusBadge = (deadline) => {
    const now = new Date();
    const dl = new Date(deadline);
    const diff = (dl - now) / (1000 * 60 * 60 * 24);
    if (diff < 0) return <span className="badge badge-danger">Past Due</span>;
    if (diff < 3) return <span className="badge badge-warning">Due Soon</span>;
    return <span className="badge badge-success">Upcoming</span>;
  };

  if (loading) {
    console.log('⏳ TimelineManagement: Loading...');
    return <div className="card" style={{ padding: '40px', textAlign: 'center' }}>⏳ Loading timeline events...</div>;
  }

  console.log('🎯 TimelineManagement: Rendering. Events count:', events.length);
  console.log('🎯 Events state:', events);

  return (
    <div className="tab-content">
      <div className="flex-between" style={{ marginBottom: '20px' }}>
        <h2>📅 Timeline Management</h2>
        <button className="btn btn-primary" onClick={() => { 
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          const defaultDate = tomorrow.toISOString().split('T')[0];
          setShowForm(true); 
          setEditingEvent(null); 
          setFormData({ title: '', description: '', deadline: defaultDate, maxMarks: '', submissionRequirements: '', targetYear: 'all', order: 0 }); 
        }}>
          + Add Event
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3>{editingEvent ? 'Edit Event' : 'Create New Timeline Event'}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div className="form-group">
                <label>Event Title *</label>
                <input type="text" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} placeholder="e.g., Abstract Submission, PRC-1" required />
              </div>
              <div className="form-group">
                <label>Deadline *</label>
                <input type="date" value={formData.deadline} onChange={(e) => setFormData({...formData, deadline: e.target.value})} required />
                <small style={{ color: '#666', fontSize: '12px' }}>Select a future date for the deadline</small>
              </div>
              <div className="form-group">
                <label>Maximum Marks *</label>
                <input type="number" value={formData.maxMarks} onChange={(e) => setFormData({...formData, maxMarks: e.target.value})} min="0" required />
              </div>
              <div className="form-group">
                <label>Target Year</label>
                <select value={formData.targetYear} onChange={(e) => setFormData({...formData, targetYear: e.target.value})}>
                  {TARGET_YEARS.map(y => <option key={y} value={y}>{y === 'all' ? 'All Years' : `${y} Year`}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Order (for sorting)</label>
                <input type="number" value={formData.order} onChange={(e) => setFormData({...formData, order: e.target.value})} />
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} rows={2} placeholder="Brief description of this review stage" />
            </div>
            <div className="form-group">
              <label>Submission Requirements</label>
              <textarea value={formData.submissionRequirements} onChange={(e) => setFormData({...formData, submissionRequirements: e.target.value})} rows={3} placeholder="What documents/files need to be submitted" />
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button type="submit" className="btn btn-primary">{editingEvent ? 'Update' : 'Create'} Event</button>
              <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); setEditingEvent(null); }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {selectedEvent && (
        <div>
          <button className="btn btn-secondary" onClick={() => setSelectedEvent(null)} style={{ marginBottom: '20px' }}>← Back to Timeline</button>
          
          <div className="card" style={{ marginBottom: '20px', borderLeft: '4px solid #667eea' }}>
            <h2>{selectedEvent.title}</h2>
            <p style={{ color: '#666' }}>{selectedEvent.description}</p>
            <div style={{ display: 'flex', gap: '20px', marginTop: '15px' }}>
              <span><strong>📅 Deadline:</strong> {new Date(selectedEvent.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <span><strong>🎯 Max Marks:</strong> {selectedEvent.maxMarks}</span>
            </div>
          </div>

          {/* Filters & Download */}
          <div className="card" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3>🔍 Filters</h3>
              <button className="btn btn-success" onClick={() => downloadReportAsCSV()}>
                📥 Download Report (CSV)
              </button>
            </div>
            <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Year</label>
                <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
                  <option value="">All Years</option>
                  <option value="2nd">2nd Year</option>
                  <option value="3rd">3rd Year</option>
                  <option value="4th">4th Year</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Branch</label>
                <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
                  <option value="">All Branches</option>
                  <option value="CSE">CSE</option>
                  <option value="IT">IT</option>
                  <option value="ECE">ECE</option>
                  <option value="CSM">CSM</option>
                  <option value="EEE">EEE</option>
                  <option value="CSD">CSD</option>
                  <option value="ETM">ETM</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Section</label>
                <select value={filterSection} onChange={(e) => setFilterSection(e.target.value)}>
                  <option value="">All Sections</option>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                  <option value="E">E</option>
                </select>
              </div>
              <button className="btn btn-secondary" onClick={() => { setFilterYear(''); setFilterBranch(''); setFilterSection(''); }}>Clear Filters</button>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Team Members</th>
                  <th>Class</th>
                  <th>COE</th>
                  <th>Guide</th>
                  <th>Marks</th>
                  <th>Remarks</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions
                  .filter(sub => {
                    // Handle both string and object formats for timelineEventId
                    const subEventId = typeof sub.timelineEventId === 'string' 
                      ? sub.timelineEventId 
                      : sub.timelineEventId?._id;
                    return subEventId === selectedEvent._id;
                  })
                  .filter(sub => {
                    const batchId = typeof sub.batchId === 'string' 
                      ? sub.batchId 
                      : sub.batchId?._id;
                    const batch = batches.find(b => b._id === batchId);
                    if (!batch) return false;
                    if (filterYear && batch.year !== filterYear) return false;
                    if (filterBranch && batch.branch !== filterBranch) return false;
                    if (filterSection && batch.section !== filterSection) return false;
                    return true;
                  })
                  .map(sub => {
                    const batchId = typeof sub.batchId === 'string' 
                      ? sub.batchId 
                      : sub.batchId?._id;
                    const batch = batches.find(b => b._id === batchId);
                    const latestVersion = sub.versions?.[sub.versions.length - 1];
                    const latestAdminRemark = sub.adminRemarks?.length > 0 ? sub.adminRemarks[sub.adminRemarks.length - 1] : null;
                    
                    // Debug: Log the batch data to see what we're getting
                    if (batch && batch.teamName) {
                      console.log(`📦 Batch ${batch.teamName}:`, {
                        leaderName: batch.leaderStudentId?.name,
                        leaderRollNumber: batch.leaderStudentId?.rollNumber,
                        leaderStudentIdFull: batch.leaderStudentId,
                        teamMembers: batch.teamMembers
                      });
                    }
                    
                    // Combine leader and team members
                    const leader = batch?.leaderStudentId;
                    const members = batch?.teamMembers || [];
                    
                    return (
                      <tr key={sub._id}>
                        <td><strong>{batch?.teamName}</strong></td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {leader && (
                              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#2d3748' }}>
                                👑 {leader.rollNumber || leader.name}
                              </div>
                            )}
                            {members.map((m, idx) => (
                              <div key={idx} style={{ fontSize: '12px', color: '#4a5568', paddingLeft: '18px' }}>
                                • {m.rollNo}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td>{batch?.year} {batch?.branch}-{batch?.section}</td>
                        <td>{batch?.coeId?.name || 'Not Assigned'}</td>
                        <td>
                          {batch?.guideId?.name ? (
                            <span style={{ fontWeight: '500', color: '#2d3748' }}>
                              👨‍🏫 {batch.guideId.name}
                            </span>
                          ) : (
                            <span style={{ color: '#718096', fontStyle: 'italic' }}>Not Assigned</span>
                          )}
                        </td>
                        <td>{sub.marks !== null ? `${sub.marks}/${selectedEvent.maxMarks}` : '-'}</td>
                        <td>
                          {latestAdminRemark ? (
                            <div 
                              style={{ 
                                fontSize: '12px', 
                                cursor: 'pointer',
                                padding: '8px',
                                background: '#f0f0f0',
                                borderRadius: '4px',
                                maxHeight: '50px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                              onClick={() => setExpandedRemarkSubmission(sub._id)}
                              title="Click to expand"
                            >
                              <strong>Admin:</strong> {latestAdminRemark.remark.substring(0, 50)}...
                              <br/>
                              <small style={{ color: '#999' }}>
                                {new Date(latestAdminRemark.createdAt).toLocaleDateString('en-IN')}
                              </small>
                            </div>
                          ) : (
                            <span style={{ color: '#999', fontSize: '12px' }}>No remarks</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                            {latestVersion?.fileUrl && (
                              <a href={latestVersion.fileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm">📁 View</a>
                            )}
                            <button 
                              className="btn btn-info btn-sm" 
                              onClick={() => { setSelectedSubmissionForRemark(sub); setShowRemarkModal(true); }}
                              title="Add Admin Remark"
                            >
                              💬 Remark
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!selectedEvent && events.length === 0 ? (
        <div className="card empty-state">
          <h3>❌ No Timeline Events</h3>
          <p>Create timeline events for Abstract Review, PRC-1, PRC-2, etc.</p>
          <p style={{ fontSize: '12px', color: '#999' }}>Debug: Events state is empty. Length = {events.length}</p>
        </div>
      ) : !selectedEvent ? (
        <div className="timeline-container">
          {events.map((event, idx) => (
            <div key={event._id} className="card timeline-event" style={{ borderLeft: '4px solid #667eea', marginBottom: '15px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                    <span style={{ background: '#667eea', color: 'white', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>{idx + 1}</span>
                    <h3 style={{ margin: 0 }}>{event.title}</h3>
                    {getStatusBadge(event.deadline)}
                    <span className="badge badge-info">{event.targetYear === 'all' ? 'All Years' : `${event.targetYear} Year`}</span>
                  </div>
                  <p style={{ color: '#666', margin: '5px 0' }}>{event.description}</p>
                </div>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => setSelectedEvent(event)}>👥 View Teams</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(event)}>✏️</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(event._id)}>🗑️</button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginTop: '15px', padding: '15px', background: '#f8fafc', borderRadius: '8px' }}>
                <div><strong>📅 Deadline:</strong><br/>{new Date(event.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                <div><strong>🎯 Max Marks:</strong><br/>{event.maxMarks}</div>
                <div><strong>📋 Requirements:</strong><br/><span style={{ fontSize: '13px', color: '#666' }}>{event.submissionRequirements || 'Not specified'}</span></div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Expanded Remark Modal */}
      {expandedRemarkSubmission && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1001
        }}>
          <div className="card" style={{ width: '90%', maxWidth: '600px', maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>📝 Full Feedback</h3>
              <button 
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  fontSize: '24px', 
                  cursor: 'pointer',
                  color: '#999'
                }}
                onClick={() => setExpandedRemarkSubmission(null)}
              >
                ×
              </button>
            </div>
            {(() => {
              const submission = submissions.find(s => s._id === expandedRemarkSubmission);
              const latestRemark = submission?.adminRemarks?.length > 0 ? submission.adminRemarks[submission.adminRemarks.length - 1] : null;
              if (!latestRemark) return null;
              
              return (
                <div>
                  <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', marginBottom: '15px' }}>
                    <div style={{ fontSize: '12px', color: '#667eea', fontWeight: 'bold', marginBottom: '8px' }}>
                      📅 {new Date(latestRemark.createdAt).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                    <p style={{ color: '#2d3748', fontSize: '14px', lineHeight: '1.6', whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                      {latestRemark.remark}
                    </p>
                  </div>
                </div>
              );
            })()}
            <button 
              className="btn btn-secondary"
              onClick={() => setExpandedRemarkSubmission(null)}
              style={{ width: '100%' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Admin Remark Modal */}
      {showRemarkModal && selectedSubmissionForRemark && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ width: '90%', maxWidth: '500px' }}>
            <h3>Add Admin Remark</h3>
            <div style={{ marginBottom: '15px', padding: '10px', background: '#f0f0f0', borderRadius: '5px' }}>
              <strong>Team:</strong> {batches.find(b => b._id === (typeof selectedSubmissionForRemark.batchId === 'string' ? selectedSubmissionForRemark.batchId : selectedSubmissionForRemark.batchId?._id))?.teamName}
            </div>
            <textarea
              value={remarkText}
              onChange={(e) => setRemarkText(e.target.value)}
              placeholder="Enter your remark here..."
              rows={5}
              style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '5px', border: '1px solid #ddd' }}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <button 
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    if (!remarkText.trim()) {
                      alert('Please enter a remark');
                      return;
                    }
                    await api.addAdminRemark(selectedSubmissionForRemark._id, remarkText);
                    setRemarkText('');
                    setShowRemarkModal(false);
                    setSelectedSubmissionForRemark(null);
                    fetchEvents();
                  } catch (error) {
                    console.error('Error adding remark:', error);
                  }
                }}
              >
                Save Remark
              </button>
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  setRemarkText('');
                  setShowRemarkModal(false);
                  setSelectedSubmissionForRemark(null);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Download report as CSV function
  async function downloadReportAsCSV() {
    if (!selectedEvent || submissions.length === 0) {
      alert('No submissions to download');
      return;
    }

    // Filter submissions for current event
    const eventSubmissions = submissions.filter(sub => {
      const subEventId = typeof sub.timelineEventId === 'string' 
        ? sub.timelineEventId 
        : sub.timelineEventId?._id;
      return subEventId === selectedEvent._id;
    });

    if (eventSubmissions.length === 0) {
      alert('No submissions to download');
      return;
    }

    // Prepare CSV data
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += `Timeline Event: ${selectedEvent.title}\n`;
    csvContent += `Generated on: ${new Date().toLocaleDateString('en-IN')}\n`;
    csvContent += `Deadline: ${new Date(selectedEvent.deadline).toLocaleDateString('en-IN')}\n`;
    csvContent += `Max Marks: ${selectedEvent.maxMarks}\n\n`;

    // Header row
    const headers = ['Team Name', 'Team Members', 'Year', 'Branch', 'Section', 'COE', 'Guide', 'Marks', 'Admin Remarks'];
    csvContent += headers.map(h => `"${h}"`).join(',') + '\n';

    // Data rows
    eventSubmissions.forEach(sub => {
      const batchId = typeof sub.batchId === 'string' 
        ? sub.batchId 
        : sub.batchId?._id;
      const batch = batches.find(b => b._id === batchId);
      const latestAdminRemark = sub.adminRemarks?.length > 0 ? sub.adminRemarks[sub.adminRemarks.length - 1].remark : 'N/A';
      const leaderRollNo = batch?.leaderStudentId?.rollNumber || 'N/A';
      const otherMembers = batch?.teamMembers?.length > 0 ? batch.teamMembers.map(m => m.rollNo).join('; ') : '';
      const allMembers = otherMembers ? `${leaderRollNo}; ${otherMembers}` : leaderRollNo;
      const coe = batch?.problemId?.coeId?.name || batch?.coeId?.name || 'N/A';
      const guide = batch?.guideId?.name || 'Not Assigned';

      const row = [
        batch?.teamName || 'Unknown',
        allMembers,
        batch?.year || 'N/A',
        batch?.branch || 'N/A',
        batch?.section || 'N/A',
        coe,
        guide,
        sub.marks !== null ? `${sub.marks}/${selectedEvent.maxMarks}` : 'N/A',
        `"${latestAdminRemark.replace(/"/g, '""')}"`
      ];
      csvContent += row.join(',') + '\n';
    });

    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${selectedEvent.title}_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export default TimelineManagement;

