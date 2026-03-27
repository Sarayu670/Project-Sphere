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

export default function AdminMeetings() {
  const [batches, setBatches] = useState([]);
  const [plans, setPlans] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [viewMode, setViewMode] = useState('overview'); // 'overview' or 'batch'
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [filterYear, setFilterYear] = useState('All');
  const [filterBranch, setFilterBranch] = useState('All');
  const [filterSection, setFilterSection] = useState('All');

  // Load data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [batchesRes, plansRes] = await Promise.all([
          api.getAllBatches(),
          api.getAllMeetingPlans()
        ]);
        setBatches(batchesRes.data.data || []);
        setPlans(plansRes.data.data || []);
      } catch (error) {
        console.error('Error fetching admin meetings data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const years = ['All', '2nd', '3rd', '4th'];
  const branches = ['All', 'CSE', 'IT', 'ECE', 'CSM', 'EEE', 'CSD', 'ETM'];
  const sections = ['All', 'A', 'B', 'C', 'D', 'E'];

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
    if (total === 0) return Array(MEETING_COUNT).fill({ completed: 0, total: 0 });

    const batchIds = new Set(filteredBatches.map(b => b._id.toString()));
    const filteredPlans = plans.filter(p => batchIds.has(p.batchId.toString()));

    return Array.from({ length: MEETING_COUNT }, (_, i) => {
      const completed = filteredPlans.filter(p => p.completed[i] === true).length;
      return { completed, total };
    });
  }, [filteredBatches, plans]);

  const currentBatchPlan = useMemo(() => {
    if (viewMode !== 'batch' || !selectedBatchId) return null;
    return plans.find(p => p.batchId.toString() === selectedBatchId.toString());
  }, [viewMode, selectedBatchId, plans]);

  const handleBatchSelect = (batchId) => {
    setSelectedBatchId(batchId);
    setViewMode('batch');
  };

  const clearFilters = () => {
    setFilterYear('All');
    setFilterBranch('All');
    setFilterSection('All');
  };

  const generateStatusForm = () => {
    if (!currentBatchPlan) return;
    const doc = new jsPDF();
    const batch = batches.find(b => b._id.toString() === selectedBatchId.toString());
    const batchName = batch?.teamName || selectedBatchId;
    const guideName = batch?.guideId?.name || 'N/A';

    doc.setFontSize(18);
    doc.setTextColor(33, 33, 33);
    doc.text("Guide Meetings Status Form", 14, 22);
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 14, 32);
    doc.text(`Guide Name: ${guideName}`, 14, 40);
    doc.text(`Batch: ${batchName}`, 14, 48);

    const tableData = currentBatchPlan.scheduledDates.map((iso, i) => {
      const d = parseLocalISODate(iso);
      return [
        i + 1,
        currentBatchPlan.remarks[i] || 'No remark',
        d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : iso
      ];
    });

    doc.autoTable({
      startY: 56,
      head: [['S.No', 'Remark', 'Date']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 138] },
      styles: { fontSize: 11, cellPadding: 5 },
      columnStyles: { 0: { cellWidth: 20, halign: 'center' }, 2: { cellWidth: 40, halign: 'center' } }
    });

    const finalY = doc.lastAutoTable.finalY || 60;
    doc.setFontSize(12);
    doc.setTextColor(33, 33, 33);
    doc.text("Guide Signature", 14, finalY + 30);
    doc.line(14, finalY + 45, 60, finalY + 45);
    doc.save(`Status_Form_${batchName.replace(/\s+/g, '_')}.pdf`);
  };

  if (loading) {
    return <div className="tab-content"><div className="card loading"><h3>Loading meetings overview...</h3></div></div>;
  }

  return (
    <div className="tab-content">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Meetings Overview</h2>
          <p style={{ color: '#666', fontSize: '14px', margin: '4px 0 0' }}>Track meeting completion status across all teams.</p>
        </div>
        <button 
          className={`btn ${viewMode === 'overview' ? 'btn-secondary' : 'btn-primary'}`}
          onClick={() => setViewMode(viewMode === 'overview' ? 'batch' : 'overview')}
        >
          {viewMode === 'overview' ? '🔍 View Specific Batch' : '🔙 Back to Overview'}
        </button>
      </div>

      {viewMode === 'overview' ? (
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
              <div key={i} style={{ 
                padding: '20px', border: '1px solid #e2e8f0', borderRadius: '12px', 
                background: '#fff', display: 'flex', alignItems: 'center', gap: '20px'
              }}>
                <div style={{ 
                  width: '40px', height: '40px', borderRadius: '50%', background: '#3b82f6', 
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                  fontWeight: 'bold', fontSize: '18px', flexShrink: 0
                }}>
                  {i + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', alignItems: 'baseline' }}>
                    <h4 style={{ margin: 0, color: '#1e293b' }}>Meeting {i + 1}</h4>
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
          <div className="card" style={{ marginBottom: '15px', padding: '15px', background: '#f8fafc' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontWeight: 600, color: '#444' }}>Select Batch to View Details:</label>
              <select
                value={selectedBatchId}
                onChange={e => setSelectedBatchId(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '14px', minWidth: '300px' }}
              >
                <option value="">-- Choose a Batch --</option>
                {batches.map(b => (
                  <option key={b._id} value={b._id}>
                    {b.teamName} ({b.year} {b.branch}-{b.section} | {b.guideId?.name || 'No Guide'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!currentBatchPlan ? (
            <div className="card empty-state">
              <div style={{ fontSize: '48px', marginBottom: '15px' }}>📅</div>
              <h3>No Meeting Plan Found</h3>
              <p>Please select a batch or wait for the guide to initialize the plan.</p>
            </div>
          ) : (
            <div className="card animated fadeIn">
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid #edf2f7' }}>
                <h3 style={{ margin: 0 }}>Details for {batches.find(b => b._id.toString() === selectedBatchId.toString())?.teamName}</h3>
                <button 
                  className="btn btn-primary"
                  onClick={generateStatusForm}
                  disabled={!currentBatchPlan.completed.every(c => c)}
                  style={{ opacity: currentBatchPlan.completed.every(c => c) ? 1 : 0.5 }}
                >
                  📄 Download Status Form
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 200px', gap: '10px', fontWeight: 'bold', color: '#64748b', padding: '0 12px 10px', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <div>Meeting</div>
                <div>Scheduled Date</div>
                <div>Status</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Array.from({ length: MEETING_COUNT }, (_, idx) => {
                  const isCompleted = currentBatchPlan.completed[idx] === true;
                  const statusLabel = isCompleted ? 'Completed' : 'Pending';
                  
                  return (
                    <div key={idx} style={{ 
                      display: 'grid', gridTemplateColumns: '1fr 180px 200px', gap: '10px', 
                      alignItems: 'center', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0',
                      background: isCompleted ? '#f0fdf4' : '#fff'
                    }}>
                      <div style={{ fontWeight: 'bold' }}>Meeting {idx + 1}</div>
                      <div style={{ fontSize: '14px', color: '#4a5568' }}>{formatDate(currentBatchPlan.scheduledDates[idx])}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ 
                          padding: '4px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 'bold',
                          background: isCompleted ? '#def7ec' : '#f3f4f6',
                          color: isCompleted ? '#03543f' : '#4b5563'
                        }}>
                          {isCompleted ? '✅' : '⚪'} {statusLabel}
                        </span>
                      </div>
                      {currentBatchPlan.remarks?.[idx] && (
                        <div style={{ gridColumn: '1/-1', marginTop: '8px', fontSize: '13px', color: '#718096', padding: '8px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #edf2f7' }}>
                          <strong>Remark:</strong> {currentBatchPlan.remarks[idx]}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
