import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import * as api from '../../services/api';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const MEETING_COUNT = 6;
const INTERVAL_DAYS = 15;

function pad2(n) { return String(n).padStart(2, '0'); }

function getLocalISODate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

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

function addDaysToLocalISODate(isoDate, days) {
  const parsed = parseLocalISODate(isoDate);
  if (!parsed) return null;
  const next = new Date(parsed);
  next.setDate(next.getDate() + days);
  return getLocalISODate(next);
}

function isValidISODate(iso) {
  if (typeof iso !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !!parseLocalISODate(iso);
}

function buildDefaultPlan() {
  const start = startOfDay(new Date());
  const scheduledDates = Array.from({ length: MEETING_COUNT }, (_, i) =>
    addDaysToLocalISODate(getLocalISODate(start), i * INTERVAL_DAYS)
  );
  return {
    scheduledDates,
    completed: Array.from({ length: MEETING_COUNT }, () => false),
    completedDates: Array.from({ length: MEETING_COUNT }, () => null),
    remarks: Array.from({ length: MEETING_COUNT }, () => ''),
  };
}

export default function GuideMeetings() {
  const { user } = useAuth();
  const [batches, setBatches] = useState([]);
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [plan, setPlan] = useState(null);
  const [rescheduleDraftISO, setRescheduleDraftISO] = useState('');
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [editingRemarkIndex, setEditingRemarkIndex] = useState(null);
  const [remarkDraft, setRemarkDraft] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(true);

  // Load guide's batches
  useEffect(() => {
    const fetchBatches = async () => {
      try {
        const res = await api.getMyBatches();
        const b = res.data.data || [];
        setBatches(b);
        if (b.length > 0) setSelectedBatchId(b[0]._id);
      } catch (error) {
        setBatches([]);
      } finally {
        setLoading(false);
      }
    };
    fetchBatches();
  }, []);

  // Load plan from backend when batch changes
  useEffect(() => {
    if (!selectedBatchId) {
      setPlan(null);
      return;
    }
    const fetchPlan = async () => {
      try {
        const res = await api.getMeetingPlan(selectedBatchId);
        setPlan(res.data.data);
      } catch (error) {
        console.error('Failed to fetch meeting plan:', error);
        setPlan(null);
      }
    };
    fetchPlan();
    setRescheduleOpen(false);
    setEditingRemarkIndex(null);
  }, [selectedBatchId]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const today = useMemo(() => startOfDay(now), [now]);
  const allCompleted = useMemo(() => plan?.completed.every(c => c === true) ?? false, [plan]);

  const persistPlan = async (nextPlan) => {
    if (!selectedBatchId) return;
    try {
      await api.updateMeetingPlan(selectedBatchId, nextPlan);
    } catch (error) {
      console.error('Error saving meeting plan:', error);
    }
  };

  const firstIncompleteIndex = useMemo(() => {
    if (!plan) return -1;
    return plan.completed.findIndex(c => c !== true);
  }, [plan]);

  const activeMeetingIndex = useMemo(() => {
    if (!plan || firstIncompleteIndex < 0) return null;
    return firstIncompleteIndex;
  }, [plan, firstIncompleteIndex]);

  const handleMarkCompleted = async (idx) => {
    if (!plan || idx !== activeMeetingIndex || plan.completed[idx]) return;
    const nextCompleted = [...plan.completed];
    nextCompleted[idx] = true;
    const nextCompletedDates = [...(plan.completedDates || Array(MEETING_COUNT).fill(null))];
    nextCompletedDates[idx] = getLocalISODate(new Date());
    const nextPlan = { ...plan, completed: nextCompleted, completedDates: nextCompletedDates };
    setPlan(nextPlan);
    await persistPlan(nextPlan);
  };

  const openReschedule = (idx) => {
    if (!plan || idx !== activeMeetingIndex || plan.completed[idx]) return;
    setRescheduleDraftISO(plan.scheduledDates[idx]);
    setRescheduleOpen(true);
  };

  const handleCancelReschedule = () => {
    setRescheduleOpen(false);
    setRescheduleDraftISO('');
  };

  const handleSaveReschedule = async (idx) => {
    if (!plan || idx !== activeMeetingIndex || !isValidISODate(rescheduleDraftISO)) return;
    const nextScheduled = [...plan.scheduledDates];
    nextScheduled[idx] = rescheduleDraftISO;
    for (let j = idx + 1; j < MEETING_COUNT; j++) {
      nextScheduled[j] = addDaysToLocalISODate(rescheduleDraftISO, (j - idx) * INTERVAL_DAYS);
    }
    const nextPlan = { ...plan, scheduledDates: nextScheduled };
    setPlan(nextPlan);
    await persistPlan(nextPlan);
    setRescheduleOpen(false);
    setRescheduleDraftISO('');
  };

  const openRemark = (idx) => {
    if (!plan) return;
    setEditingRemarkIndex(idx);
    setRemarkDraft(plan.remarks[idx] || '');
  };

  const cancelRemark = () => {
    setEditingRemarkIndex(null);
    setRemarkDraft('');
  };

  const saveRemark = async (idx) => {
    if (!plan) return;
    const nextRemarks = [...plan.remarks];
    nextRemarks[idx] = remarkDraft;
    const nextPlan = { ...plan, remarks: nextRemarks };
    setPlan(nextPlan);
    await persistPlan(nextPlan);
    setEditingRemarkIndex(null);
    setRemarkDraft('');
  };

  const generateStatusForm = () => {
    if (!plan) return;
    const doc = new jsPDF();
    const batchName = batches.find(b => b._id === selectedBatchId)?.teamName || selectedBatchId;
    doc.setFontSize(18);
    doc.setTextColor(33, 33, 33);
    doc.text("Guide Meetings Status Form", 14, 22);
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')}`, 14, 32);
    if (user?.name) doc.text(`Guide Name: ${user.name}`, 14, 40);
    doc.text(`Batch: ${batchName}`, 14, 48);
    const tableData = plan.scheduledDates.map((iso, i) => {
      const d = parseLocalISODate(iso);
      return [
        i + 1,
        plan.remarks[i] || 'No remark',
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
    doc.save("Status Form.pdf");
  };

  if (loading) {
    return <div className="tab-content"><div className="card empty-state"><h3>Loading batches...</h3></div></div>;
  }

  if (batches.length === 0) {
    return <div className="tab-content"><div className="card empty-state"><h3>No allotted teams yet</h3><p>Allot a team first to manage meetings.</p></div></div>;
  }

  return (
    <div className="tab-content">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <h2>Meetings</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div>
            <label style={{ fontWeight: 600, marginRight: '8px', color: '#444' }}>Batch:</label>
            <select
              value={selectedBatchId}
              onChange={e => setSelectedBatchId(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '14px' }}
            >
              {batches.map(b => <option key={b._id} value={b._id}>{b.teamName}</option>)}
            </select>
          </div>
          <span style={{ color: '#666', fontSize: '13px' }}>One meeting active at a time</span>
        </div>
      </div>

      {plan && (
        <div className="card" style={{ marginTop: '15px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 200px', gap: '10px', alignItems: 'center', padding: '0 4px 8px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ fontWeight: '700', color: '#444' }}>Meeting</div>
            <div style={{ fontWeight: '700', color: '#444' }}>Scheduled Date</div>
            <div style={{ fontWeight: '700', color: '#444' }}>Status</div>
          </div>

          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Array.from({ length: MEETING_COUNT }, (_, idx) => {
              const isCompleted = plan.completed[idx] === true;
              const isActive = idx === activeMeetingIndex;
              const scheduledISO = plan.scheduledDates[idx];
              const scheduledDate = parseLocalISODate(scheduledISO);
              const scheduledLabel = scheduledDate
                ? scheduledDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : scheduledISO;
              const completedDate = plan.completedDates?.[idx];
              const completedLabel = completedDate
                ? parseLocalISODate(completedDate)?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : null;

              const statusBadgeStyle = isCompleted
                ? { background: '#d4edda', color: '#155724', border: '1px solid #c3e6cb' }
                : isActive
                ? { background: '#dbedfe', color: '#1e3a8a', border: '1px solid #bfdbfe' }
                : { background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0' };

              return (
                <div key={idx} style={{
                  display: 'grid', gridTemplateColumns: '1fr 180px 200px', gap: '10px',
                  alignItems: 'center', padding: '12px', borderRadius: '10px',
                  border: '1px solid #e5e7eb', background: isCompleted ? '#f0fdf4' : '#fff',
                  opacity: !isActive && !isCompleted ? 0.9 : 1
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ fontWeight: '800', color: '#111827' }}>Meeting {idx + 1}</div>
                    <div style={{ color: '#6b7280', fontSize: '12px' }}>
                      {isCompleted && completedLabel ? `Completed on ${completedLabel}` :
                       isActive ? (scheduledDate && scheduledDate.getTime() > today.getTime() ? 'Upcoming actionable meeting' : 'Current active meeting') : 
                       'Locked until previous meetings are completed'}
                    </div>
                  </div>

                  <div style={{ fontWeight: '600', color: '#374151', fontSize: '14px' }}>{scheduledLabel}</div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '999px', width: 'fit-content', ...statusBadgeStyle }}>
                      <span>{isCompleted ? '✅' : isActive ? '🔵' : '🔒'}</span>
                      <span style={{ fontWeight: 700, fontSize: '13px' }}>
                        {isCompleted ? 'Completed' : isActive ? 'Active' : 'Locked'}
                      </span>
                    </div>

                    {!isCompleted && isActive && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button className="btn btn-primary" style={{ fontSize: '13px', padding: '6px 12px' }} onClick={() => handleMarkCompleted(idx)}>✔ Mark Completed</button>
                        <button className="btn btn-secondary" style={{ fontSize: '13px', padding: '6px 12px' }} onClick={() => openReschedule(idx)}>🗓️ Reschedule</button>
                      </div>
                    )}

                    {isCompleted && (
                      <button className="btn btn-secondary" style={{ fontSize: '13px', padding: '6px 12px', width: 'fit-content' }} onClick={() => openRemark(idx)}>
                        📝 {plan.remarks[idx] ? 'Edit Remark' : 'Add Remark'}
                      </button>
                    )}
                  </div>

                  {rescheduleOpen && isActive && !isCompleted && (
                    <div style={{ gridColumn: '1 / -1', marginTop: '5px', padding: '12px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>Reschedule Meeting {idx + 1}</div>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'end', flexWrap: 'wrap' }}>
                        <div className="form-group">
                          <label style={{ display: 'block', marginBottom: '6px' }}>New scheduled date</label>
                          <input type="date" value={rescheduleDraftISO} onChange={e => setRescheduleDraftISO(e.target.value)}
                            style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e0' }} />
                        </div>
                        <button className="btn btn-primary" onClick={() => handleSaveReschedule(idx)} disabled={!isValidISODate(rescheduleDraftISO)}>Save & Lock Future Dates</button>
                        <button className="btn btn-secondary" onClick={handleCancelReschedule}>Cancel</button>
                      </div>
                      <div style={{ marginTop: '8px', color: '#64748b', fontSize: '12px' }}>
                        Future meetings will be auto-adjusted to keep a {INTERVAL_DAYS}-day interval.
                      </div>
                    </div>
                  )}

                  {plan.remarks[idx] && editingRemarkIndex !== idx && (
                    <div style={{ gridColumn: '1 / -1', marginTop: '5px', padding: '10px 12px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontWeight: '600', color: '#444' }}>Remark: </span>
                      <span style={{ color: '#333', whiteSpace: 'pre-wrap' }}>{plan.remarks[idx]}</span>
                    </div>
                  )}

                  {editingRemarkIndex === idx && (
                    <div style={{ gridColumn: '1 / -1', marginTop: '5px', padding: '12px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
                        {plan.remarks[idx] ? 'Edit Remark' : 'Add Remark'} for Meeting {idx + 1}
                      </div>
                      <textarea value={remarkDraft} onChange={e => setRemarkDraft(e.target.value)}
                        placeholder="Type short notes or comments about this meeting..."
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0', minHeight: '70px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                      />
                      <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                        <button className="btn btn-primary" onClick={() => saveRemark(idx)}>Save Remark</button>
                        <button className="btn btn-secondary" onClick={cancelRemark}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="btn btn-primary"
          onClick={allCompleted ? generateStatusForm : undefined}
          disabled={!allCompleted}
          style={{
            padding: '11px 22px', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px',
            backgroundColor: allCompleted ? '#10b981' : '#e2e8f0',
            borderColor: allCompleted ? '#10b981' : '#e2e8f0',
            color: allCompleted ? '#fff' : '#94a3b8',
            cursor: allCompleted ? 'pointer' : 'not-allowed',
            transition: 'all 0.3s ease'
          }}
          title={!allCompleted ? "Complete all meetings first" : "Generate Status Form PDF"}
        >
          📄 Generate Status Form
        </button>
      </div>
    </div>
  );
}
