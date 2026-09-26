import { useEffect, useMemo, useState } from 'react';
import * as api from '../../services/api';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const MEETING_COUNT = 6;
const INTERVAL_DAYS = 15;

function parseLocalISODate(isoDate) {
  const [y, m, d] = (isoDate || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(iso) {
  const d = parseLocalISODate(iso);
  if (!d) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminMeetings({ scope = null }) {
const [batches, setBatches] = useState([]);
const [plans, setPlans] = useState([]);
const [selectedMeetingIndex, setSelectedMeetingIndex] = useState(null);
const [loading, setLoading] = useState(true);
  
// Filters
const [filterYear, setFilterYear] = useState(scope?.year || 'All');
const [filterBranch, setFilterBranch] = useState(scope?.branch || 'All');
const [filterSection, setFilterSection] = useState(scope?.section || 'All');
const [filterCompletionStatus, setFilterCompletionStatus] = useState('All');

  // Load data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [batchesRes, plansRes] = await Promise.all(scope
          ? [api.getSectionBatches(), api.getSectionMeetingPlans()]
          : [api.getAllBatches(), api.getAllMeetingPlans()]
        );
        setBatches(batchesRes.data.data || []);
        setPlans(plansRes.data.data || []);
      } catch (error) {
        console.error('Error fetching admin meetings data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [scope?.year, scope?.branch, scope?.section]);

  const years = scope ? [scope.year] : ['All', '2nd', '3rd', '4th'];
  const branches = scope ? [scope.branch] : ['All', 'CSE', 'IT', 'ECE', 'CSM', 'EEE', 'CSD', 'ETM'];
  const sections = scope ? [scope.section] : ['All', 'A', 'B', 'C', 'D', 'E'];

  const filteredBatches = useMemo(() => {
    return batches.filter(b => {
      const matchYear = filterYear === 'All' || b.year === filterYear;
      const matchBranch = filterBranch === 'All' || b.branch === filterBranch;
      const matchSection = filterSection === 'All' || b.section === filterSection;
      return matchYear && matchBranch && matchSection;
    });
  }, [batches, filterYear, filterBranch, filterSection]);

  const stats = useMemo(() => {
    const total = filteredBatches.length;
    
    // Find absolute maximum number of meetings across available plans to display columns dynamically
    let maxMeetings = MEETING_COUNT;
    const batchIds = new Set(filteredBatches.map(b => b._id.toString()));
    const filteredPlans = plans.filter(p => batchIds.has(p.batchId.toString()));
    
    filteredPlans.forEach(p => {
      if (p.scheduledDates && p.scheduledDates.length > maxMeetings) {
        maxMeetings = p.scheduledDates.length;
      }
    });

    if (total === 0) return Array(maxMeetings).fill({ completed: 0, total: 0 });

    return Array.from({ length: maxMeetings }, (_, i) => {
      const completed = filteredPlans.filter(p => p.completed[i] === true).length;
      // Some batches might not have the extra meetings appended yet.
      // E.g. meeting 7 might only exist for 1 batch. To avoid 0/100, we compute total_for_this_meeting dynamically above index 5
      const totalForThisMeeting = i < MEETING_COUNT ? total : filteredPlans.filter(p => p.scheduledDates.length > i).length;
      return { completed, total: totalForThisMeeting };
    });
  }, [filteredBatches, plans]);

  const batchesForSelectedMeeting = useMemo(() => {
    if (selectedMeetingIndex === null) return [];
    
    const batchIds = new Set(filteredBatches.map(b => b._id.toString()));
    return plans
      .filter(p => batchIds.has(p.batchId.toString()))
      .map(plan => {
        const batch = batches.find(b => b._id.toString() === plan.batchId.toString());
        return {
          batch,
          plan,
          completed: plan.completed[selectedMeetingIndex] === true,
          remark: plan.remarks?.[selectedMeetingIndex] || ''
        };
      })
      .filter(item => {
        // Apply completion status filter
        if (filterCompletionStatus === 'All') return true;
        if (filterCompletionStatus === 'Completed') return item.completed === true;
        if (filterCompletionStatus === 'Not Completed') return item.completed === false;
        return true;
      });
  }, [selectedMeetingIndex, filteredBatches, plans, batches, filterCompletionStatus]);

  const clearFilters = () => {
    setFilterYear(scope?.year || 'All');
    setFilterBranch(scope?.branch || 'All');
    setFilterSection(scope?.section || 'All');
    setFilterCompletionStatus('All');
  };

  const generateStatusForm = () => {
    if (selectedMeetingIndex === null) return;
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.setTextColor(33, 33, 33);
    doc.text(`Meeting Progress Report`, 14, 22);
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 14, 32);
    if (filterCompletionStatus !== 'All') {
      doc.text(`Status Filter: ${filterCompletionStatus}`, 14, 38);
    }

    const tableData = batchesForSelectedMeeting.map((item, idx) => {
      return [
        idx + 1,
        item.batch?.teamName || 'Unknown',
        `${item.batch?.year} ${item.batch?.branch}-${item.batch?.section}`,
        item.batch?.guideId?.name || 'N/A',
        item.completed ? 'Completed' : 'Pending',
        item.remark || '-'
      ];
    });

    doc.autoTable({
      startY: filterCompletionStatus !== 'All' ? 46 : 40,
      head: [['S.No', 'Team Name', 'Year/Branch/Section', 'Guide', 'Status', 'Remark']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 138] },
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: { 0: { cellWidth: 15, halign: 'center' } }
    });

    doc.save(`Meeting_Report.pdf`);
  };

  const downloadAsCSV = () => {
    if (batchesForSelectedMeeting.length === 0) {
      alert('No data to download');
      return;
    }

    const headers = ['S.No', 'Team Name', 'Team Members', 'Year', 'Branch', 'Section', 'Guide', 'Status', 'Remark'];
    const rows = batchesForSelectedMeeting.map((item, idx) => [
      idx + 1,
      item.batch?.teamName || 'Unknown',
      item.batch?.teamMembers?.map(m => m.rollNo || m.name).join('; ') || '',
      item.batch?.year || '',
      item.batch?.branch || '',
      item.batch?.section || '',
      item.batch?.guideId?.name || 'Not Assigned',
      item.completed ? 'Completed' : 'Not Completed',
      item.remark || ''
    ]);

    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.map(cell => `"${cell}"`).join(',') + '\n';
    });

    const link = document.createElement('a');
    link.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    link.download = `Meeting_Report_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (loading) {
    return <div className="tab-content"><div className="card loading"><h3>Loading meetings overview...</h3></div></div>;
  }

  return (
    <div className="tab-content">
      <div className="section-header" style={{ marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0 }}>{scope ? 'Section Meetings' : 'Meetings Overview'}</h2>
          <p style={{ color: '#666', fontSize: '14px', margin: '4px 0 0' }}>{scope ? `${scope.year} ${scope.branch}-${scope.section} only. ` : ''}Click on a meeting to view all teams and their completion status.</p>
        </div>
      </div>

      {selectedMeetingIndex === null ? (
        <>
          {/* Filters */}
          <div className="card" style={{ marginBottom: '20px', padding: '15px' }}>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Year</label>
                <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}>
                  {years.map(y => <option key={y} value={y}>{y === 'All' ? 'All Years' : y}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Branch</label>
                <select value={filterBranch} onChange={e => setFilterBranch(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}>
                  {branches.map(b => <option key={b} value={b}>{b === 'All' ? 'All Branches' : b}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: '150px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Section</label>
                <select value={filterSection} onChange={e => setFilterSection(e.target.value)} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd' }}>
                  {sections.map(s => <option key={s} value={s}>{s === 'All' ? 'All Sections' : s}</option>)}
                </select>
              </div>
              <button 
                onClick={clearFilters}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e0', background: '#fff', color: '#4a5568', fontWeight: 600, cursor: 'pointer' }}
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* Progress List */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {stats.map((stat, i) => (
              <div 
                key={i} 
                onClick={() => setSelectedMeetingIndex(i)}
                style={{ 
                  padding: '20px', border: '1px solid #e2e8f0', borderRadius: '12px', 
                  background: '#fff', display: 'flex', alignItems: 'center', gap: '20px',
                  cursor: 'pointer', transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={{ 
                  width: '40px', height: '40px', borderRadius: '50%', background: '#3b82f6', 
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  fontWeight: 'bold', fontSize: '18px', flexShrink: 0
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'baseline' }}>
                    <h4 style={{ margin: 0, color: '#1e293b' }}>
                      {i < MEETING_COUNT ? `Meeting ${i + 1}` : `Extra Meeting ${i - MEETING_COUNT + 1}`}
                    </h4>
                    <span style={{ fontWeight: 'bold', color: '#3b82f6', fontSize: '18px' }}>
                      {stat.completed} / {stat.total}
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ 
                      width: `${stat.total > 0 ? (stat.completed / stat.total) * 100 : 0}%`, 
                      height: '100%', background: '#10b981', transition: 'width 0.5s ease-in-out' 
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div style={{ marginTop: '0' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => setSelectedMeetingIndex(null)} 
            style={{ marginBottom: '20px' }}
          >
            ← Back to Overview
          </button>

          <h2>{selectedMeetingIndex < MEETING_COUNT ? `Meeting ${selectedMeetingIndex + 1}` : `Extra Meeting ${selectedMeetingIndex - MEETING_COUNT + 1}`} - Teams Status</h2>

          {/* Filters for Meeting Details */}
          <div className="card" style={{ marginBottom: '20px', maxWidth: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) auto', gap: '20px', alignItems: 'end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Year</label>
                <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
                  {years.map(y => <option key={y} value={y}>{y === 'All' ? 'All Years' : y}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Branch</label>
                <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
                  {branches.map(b => <option key={b} value={b}>{b === 'All' ? 'All Branches' : b}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Section</label>
                <select value={filterSection} onChange={(e) => setFilterSection(e.target.value)}>
                  {sections.map(s => <option key={s} value={s}>{s === 'All' ? 'All Sections' : s}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Status</label>
                <select value={filterCompletionStatus} onChange={(e) => setFilterCompletionStatus(e.target.value)}>
                  <option value="All">All Status</option>
                  <option value="Completed">Completed</option>
                  <option value="Not Completed">Not Completed</option>
                </select>
              </div>
              <button className="btn btn-secondary" onClick={clearFilters}>
                Clear Filters
              </button>
            </div>
          </div>

          {batchesForSelectedMeeting.length === 0 ? (
            <div className="card empty-state">
              <h3>No Teams Found</h3>
              <p>No teams match the selected filters</p>
            </div>
          ) : (
            <div className="table-container">
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '15px' }}>
              <button 
                className="btn btn-primary"
                onClick={generateStatusForm}
                title="Download filtered data as PDF"
              >
                📄 PDF Report
              </button>
              <button 
                className="btn btn-secondary"
                onClick={downloadAsCSV}
                title="Download filtered data as CSV"
              >
                📊 CSV Export
              </button>
            </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Team Name</th>
                    <th>Team Members</th>
                    <th style={{ width: "150px" }}>Guide</th>
                    <th style={{ width: "150px" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {batchesForSelectedMeeting.map((item, idx) => {
                    const isCompleted = item.completed;
                    const statusLabel = isCompleted ? 'COMPLETED' : 'NOT COMPLETED';
                    const statusColor = isCompleted ? '#10b981' : '#ef4444';
                    const statusBg = isCompleted ? '#d1fae5' : '#fee2e2';
                    
                    return (
                      <tr key={idx}>
                        <td><strong>{item.batch?.teamName || 'Unknown'}</strong></td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {item.batch?.teamMembers && item.batch.teamMembers.map((member, memberIdx) => (
                              <div key={memberIdx} style={{ fontSize: '12px', color: '#4a5568' }}>
                                • {member.rollNo || member.name}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td>{item.batch?.guideId?.name || 'Not Assigned'}</td>
                        <td>
                          <span style={{ 
                            padding: '6px 12px', 
                            borderRadius: '4px', 
                            fontSize: '12px', 
                            fontWeight: 'bold',
                            background: statusBg,
                            color: statusColor,
                            display: 'inline-block'
                          }}>
                            {isCompleted ? '✓' : '✕'} {statusLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
