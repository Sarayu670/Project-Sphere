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
  const [addMeetingOpen, setAddMeetingOpen] = useState(false);
  const [addMeetingInsertAfter, setAddMeetingInsertAfter] = useState(0);
  const [addMeetingDate, setAddMeetingDate] = useState('');
  const [addMeetingCompleted, setAddMeetingCompleted] = useState(false);
  const [addMeetingRemark, setAddMeetingRemark] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [scheduleInstruction, setScheduleInstruction] = useState('');
  const [remarkDraft, setRemarkDraft] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(true);

  const persistPlan = async (newPlan) => {
    try {
      await api.updateMeetingPlan(selectedBatchId, newPlan);
    } catch (err) {
      console.error('Failed to update plan:', err);
      alert('Failed to save changes.');
    }
  };

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

  // Build Visual Timeline
  const displayMeetings = useMemo(() => {
    if (!plan) return [];
    
    // Parse all meetings from backend arrays
    const rawMeetings = plan.scheduledDates.map((date, i) => {
      const isExtra = i >= MEETING_COUNT;
      let insertAfter = isExtra ? (MEETING_COUNT - 1) : null;
      let cleanRemark = plan.remarks?.[i] || '';
      
      if (isExtra && cleanRemark) {
        const match = cleanRemark.match(/^\[INSERT_AFTER:(\d+)\](.*)/s);
        if (match) {
          insertAfter = parseInt(match[1], 10);
          cleanRemark = match[2].trim();
        }
      }
      return {
        originalIndex: i,
        scheduledDateISO: date,
        completed: plan.completed[i],
        completedDateISO: plan.completedDates?.[i] || null,
        remark: cleanRemark,
        isExtra,
        insertAfter
      };
    });

    const finalOrder = [];
    let extraCount = 0;
    
    // Process base meetings (0 to 5)
    for (let i = 0; i < Math.min(MEETING_COUNT, rawMeetings.length); i++) {
       const baseMeeting = rawMeetings[i];
       baseMeeting.title = `Meeting ${i + 1}`;
       finalOrder.push(baseMeeting);
       
       // Find any extras inserted after this base meeting
       const extras = rawMeetings.filter(m => m.isExtra && m.insertAfter === i);
       // Sort these extras chronologically
       extras.sort((a, b) => {
          const tA = parseLocalISODate(a.scheduledDateISO);
          const tB = parseLocalISODate(b.scheduledDateISO);
          return (tA ? tA.getTime() : 0) - (tB ? tB.getTime() : 0);
       });
       
       extras.forEach(ext => {
          extraCount++;
          ext.title = `Extra Meeting ${extraCount}`;
          finalOrder.push(ext);
       });
    }

    // Process orphaned extras (failsafe)
    const orphans = rawMeetings.filter(m => m.isExtra && (typeof m.insertAfter !== 'number' || m.insertAfter >= MEETING_COUNT || m.insertAfter < 0));
    orphans.sort((a, b) => {
       const tA = parseLocalISODate(a.scheduledDateISO);
       const tB = parseLocalISODate(b.scheduledDateISO);
       return (tA ? tA.getTime() : 0) - (tB ? tB.getTime() : 0);
    });
    orphans.forEach(ext => {
      extraCount++;
      ext.title = `Extra Meeting ${extraCount}`;
      finalOrder.push(ext);
    });

    return finalOrder;
  }, [plan]);

  const today = useMemo(() => startOfDay(now), [now]);
  const allCompleted = useMemo(() => plan?.completed.every(c => c === true) ?? false, [plan]);

  const isMeetingWithinWindow = (scheduledISO) => {
    const scheduledDate = parseLocalISODate(scheduledISO);
    if (!scheduledDate) return false;
    const endDate = new Date(scheduledDate);
    endDate.setDate(endDate.getDate() + INTERVAL_DAYS);
    return today >= startOfDay(scheduledDate) && today <= startOfDay(endDate);
  };

  const hasMeetingTimedOut = (scheduledISO) => {
    const scheduledDate = parseLocalISODate(scheduledISO);
    if (!scheduledDate) return false;
    const endDate = new Date(scheduledDate);
    endDate.setDate(endDate.getDate() + INTERVAL_DAYS);
    return today > startOfDay(endDate);
  };

  const getDaysRemaining = (scheduledISO) => {
    const scheduledDate = parseLocalISODate(scheduledISO);
    if (!scheduledDate) return 0;
    const endDate = new Date(scheduledDate);
    endDate.setDate(endDate.getDate() + INTERVAL_DAYS);
    const daysLeft = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysLeft);
  };

  const firstIncompleteDisplayIndex = useMemo(() => {
    if (displayMeetings.length === 0) return -1;
    return displayMeetings.findIndex(m => m.completed !== true);
  }, [displayMeetings]);

  const activeMeetingDisplayIndex = useMemo(() => {
    if (firstIncompleteDisplayIndex < 0) return null;
    const m = displayMeetings[firstIncompleteDisplayIndex];
    const scheduledDate = parseLocalISODate(m.scheduledDateISO);
    if (!scheduledDate) return null;
    if (today >= startOfDay(scheduledDate)) {
      return firstIncompleteDisplayIndex;
    }
    return null;
  }, [displayMeetings, firstIncompleteDisplayIndex, today]);

  const handleMarkCompleted = async (displayIdx) => {
    if (!plan || displayIdx !== activeMeetingDisplayIndex) return;
    const m = displayMeetings[displayIdx];
    if (m.completed) return;
    
    if (!isMeetingWithinWindow(m.scheduledDateISO)) {
      alert(`❌ ${m.title} is no longer within its active window. The 15-day deadline has passed.`);
      return;
    }
    
    const nextCompleted = [...plan.completed];
    nextCompleted[m.originalIndex] = true;
    const nextCompletedDates = [...(plan.completedDates || Array(plan.scheduledDates.length).fill(null))];
    nextCompletedDates[m.originalIndex] = getLocalISODate(new Date());
    const nextPlan = { ...plan, completed: nextCompleted, completedDates: nextCompletedDates };
    setPlan(nextPlan);
    await persistPlan(nextPlan);
  };

  const openReschedule = (displayIdx) => {
    if (!plan) return;
    const m = displayMeetings[displayIdx];
    if (m.completed) return;
    setRescheduleDraftISO(m.scheduledDateISO);
    setRescheduleOpen(true);
  };

  const handleCancelReschedule = () => {
    setRescheduleOpen(false);
    setRescheduleDraftISO('');
  };

  const handleSaveReschedule = async (displayIdx) => {
    if (!plan || displayIdx !== firstIncompleteDisplayIndex || !isValidISODate(rescheduleDraftISO)) return;
    
    const newDate = parseLocalISODate(rescheduleDraftISO);
    if (newDate && newDate < today) {
      alert('❌ Cannot schedule a meeting for a past date. Please select today or a future date.');
      return;
    }
    
    const m = displayMeetings[displayIdx];
    const nextScheduled = [...plan.scheduledDates];
    
    if (!m.isExtra) {
      // Cascade schedule downstream chronologically ONLY for original meetings
      nextScheduled[m.originalIndex] = rescheduleDraftISO;
      for (let j = m.originalIndex + 1; j < Math.min(6, plan.scheduledDates.length); j++) {
        nextScheduled[j] = addDaysToLocalISODate(rescheduleDraftISO, (j - m.originalIndex) * INTERVAL_DAYS);
      }
    } else {
      // Just update this extra meeting
      nextScheduled[m.originalIndex] = rescheduleDraftISO;
    }
    
    const nextPlan = { ...plan, scheduledDates: nextScheduled };
    setPlan(nextPlan);
    await persistPlan(nextPlan);
    setRescheduleOpen(false);
    setRescheduleDraftISO('');
  };

  const openRemark = (displayIdx) => {
    if (!plan) return;
    const m = displayMeetings[displayIdx];
    setEditingRemarkIndex(m.originalIndex);
    setRemarkDraft(m.remark);
  };

  const cancelRemark = () => {
    setEditingRemarkIndex(null);
    setRemarkDraft('');
  };

  const saveRemark = async (originalIdx) => {
    if (!plan) return;
    
    let prefix = '';
    if (originalIdx >= 6) {
       // preserve serialization tag if any
       const rawRemark = plan.remarks[originalIdx] || '';
       const match = rawRemark.match(/^\[INSERT_AFTER:\d+\]/);
       if (match) prefix = match[0] + ' ';
    }
    
    const nextRemarks = [...plan.remarks];
    nextRemarks[originalIdx] = prefix + remarkDraft;
    const nextPlan = { ...plan, remarks: nextRemarks };
    setPlan(nextPlan);
    await persistPlan(nextPlan);
    setEditingRemarkIndex(null);
    setRemarkDraft('');
  };

  const openAddMeeting = () => {
    if (!plan) return;
    setAddMeetingInsertAfter(0); // Default to inserting after Meeting 1
    setAddMeetingDate(getLocalISODate(today));
    setAddMeetingCompleted(false);
    setAddMeetingRemark('');
    setAddMeetingOpen(true);
    
    setScheduleInstruction('Scroll down to schedule a meeting ↓');
    setTimeout(() => setScheduleInstruction(''), 4000);
    
    setTimeout(() => {
      document.getElementById('add-meeting-form')?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
  };

  const cancelAddMeeting = () => {
    setAddMeetingOpen(false);
    setAddMeetingDate('');
    setAddMeetingCompleted(false);
    setAddMeetingRemark('');
  };

  const handleSaveNewMeeting = async () => {
    if (!plan || !isValidISODate(addMeetingDate)) return;
    
    const newDate = parseLocalISODate(addMeetingDate);
    if (newDate && newDate < today) {
       alert('❌ Cannot schedule a meeting for a past date. Please select today or a future date.');
       return;
    }
    
    const m1Date = parseLocalISODate(plan.scheduledDates[0]);
    if (newDate < m1Date) {
      alert(`Meeting date cannot be before Meeting 1 (${plan.scheduledDates[0]}).`);
      return;
    }

    const prevDate = parseLocalISODate(plan.scheduledDates[addMeetingInsertAfter]);
    const nextDate = addMeetingInsertAfter < 5 ? parseLocalISODate(plan.scheduledDates[addMeetingInsertAfter + 1]) : null;

    let isOutofBounds = false;
    if (newDate < prevDate) isOutofBounds = true;
    if (nextDate && newDate > nextDate) isOutofBounds = true;

    if (isOutofBounds) {
       let suggestedIndex = 5;
       for(let i=0; i<5; i++) {
          const lower = parseLocalISODate(plan.scheduledDates[i]);
          const upper = parseLocalISODate(plan.scheduledDates[i+1]);
          if (newDate >= lower && newDate <= upper) {
             suggestedIndex = i;
             break;
          }
       }
       if (suggestedIndex === 5) {
          alert(`You can insert this meeting after Meeting 6`);
       } else {
          alert(`You can insert this meeting between Meeting ${suggestedIndex + 1} and Meeting ${suggestedIndex + 2}`);
       }
       return;
    }

    const nextPlan = { ...plan };
    nextPlan.scheduledDates = [...(plan.scheduledDates || []), addMeetingDate];
    nextPlan.completed = [...(plan.completed || []), addMeetingCompleted];
    
    const newCompletedDate = addMeetingCompleted ? getLocalISODate(new Date()) : null;
    nextPlan.completedDates = [...(plan.completedDates || Array(plan.scheduledDates.length).fill(null)), newCompletedDate];
    
    const baseRemark = addMeetingCompleted ? addMeetingRemark : '';
    const newRemark = `[INSERT_AFTER:${addMeetingInsertAfter}] ${baseRemark}`;
    nextPlan.remarks = [...(plan.remarks || Array(plan.scheduledDates.length).fill('')), newRemark];

    setPlan(nextPlan);
    await persistPlan(nextPlan);
    setSuccessMessage('Meeting is scheduled');
    setTimeout(() => setSuccessMessage(''), 4000); // Auto-hide after 4s
    setAddMeetingOpen(false);
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
    
    // AutoTable utilizes the chronological displayMeetings
    const tableData = displayMeetings.map((m, i) => {
      const d = parseLocalISODate(m.scheduledDateISO);
      return [
        m.title,
        m.remark || 'No remark',
        d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : m.scheduledDateISO
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
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <label style={{ fontWeight: 600, marginRight: '8px', color: '#444' }}>Batch:</label>
            <select
              value={selectedBatchId}
              onChange={e => setSelectedBatchId(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e0', fontSize: '14px' }}
            >
              {batches.map(b => <option key={b._id} value={b._id}>{b.teamName}</option>)}
            </select>
          </div>
          <button 
            className="btn btn-primary"
            onClick={openAddMeeting}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', padding: '8px 16px', background: '#3b82f6', borderColor: '#3b82f6' }}
            disabled={!plan}
          >
            ➕ Schedule Meeting
          </button>
        </div>
      </div>

      {successMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          backgroundColor: '#ecfdf5',
          color: '#065f46',
          padding: '12px 24px',
          borderRadius: '8px',
          border: '1px solid #10b981',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          animation: 'slideUpFade 0.3s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>✅</span>
            {successMessage}
          </div>
          <button 
            onClick={() => setSuccessMessage('')} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#065f46', padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ×
          </button>
        </div>
      )}

      {scheduleInstruction && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          backgroundColor: '#eff6ff',
          color: '#1e40af',
          padding: '12px 24px',
          borderRadius: '8px',
          border: '1px solid #3b82f6',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          animation: 'slideUpFade 0.3s ease-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>ℹ️</span>
            {scheduleInstruction}
          </div>
          <button 
            onClick={() => setScheduleInstruction('')} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#1e40af', padding: '0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            ×
          </button>
        </div>
      )}

      {plan && (
        <div className="card" style={{ marginTop: '15px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 200px', gap: '10px', alignItems: 'center', padding: '0 4px 8px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ fontWeight: '700', color: '#444' }}>Meeting</div>
            <div style={{ fontWeight: '700', color: '#444' }}>Scheduled Date</div>
            <div style={{ fontWeight: '700', color: '#444' }}>Status</div>
          </div>

          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {displayMeetings.map((m, displayIdx) => {
              const isCompleted = m.completed === true;
              const isActive = displayIdx === activeMeetingDisplayIndex;
              const scheduledISO = m.scheduledDateISO;
              const scheduledDate = parseLocalISODate(scheduledISO);
              const scheduledLabel = scheduledDate
                ? scheduledDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : scheduledISO;
              const completedDate = m.completedDateISO;
              const completedLabel = completedDate
                ? parseLocalISODate(completedDate)?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                : null;

              const statusBadgeStyle = isCompleted
                ? { background: '#d4edda', color: '#155724', border: '1px solid #c3e6cb' }
                : hasMeetingTimedOut(scheduledISO)
                ? { background: '#f8d7da', color: '#721c24', border: '1px solid #f5c6cb' }
                : isActive
                ? { background: '#dbedfe', color: '#1e3a8a', border: '1px solid #bfdbfe' }
                : { background: '#f1f5f9', color: '#334155', border: '1px solid #e2e8f0' };

              return (
                <div key={m.originalIndex} style={{
                  display: 'grid', gridTemplateColumns: '1fr 180px 200px', gap: '10px',
                  alignItems: 'center', padding: '12px', borderRadius: '10px',
                  border: m.isExtra ? '2px dashed #93c5fd' : '1px solid #e5e7eb',
                  background: isCompleted ? '#f0fdf4' : (m.isExtra ? '#f8fafc' : '#fff'),
                  opacity: !isActive && !isCompleted ? 0.9 : 1
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <div style={{ fontWeight: '800', color: '#111827', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {m.title}
                      {m.isExtra && <span style={{ padding: '2px 6px', fontSize: '10px', background: '#e0f2fe', color: '#0369a1', borderRadius: '4px', border: '1px solid #bae6fd' }}>EXTRA</span>}
                    </div>
                    <div style={{ color: '#6b7280', fontSize: '12px' }}>
                      {isCompleted && completedLabel ? `Completed on ${completedLabel}` :
                       hasMeetingTimedOut(scheduledISO) ? '⏰ Deadline passed - Cannot mark as complete' :
                       isMeetingWithinWindow(scheduledISO) ? `Active window: ${getDaysRemaining(scheduledISO)} days remaining` :
                       isActive ? (scheduledDate && scheduledDate.getTime() > today.getTime() ? 'Upcoming actionable meeting' : 'Current active meeting') : 
                       'Locked until previous meetings are completed'}
                    </div>
                  </div>

                  <div style={{ fontWeight: '600', color: '#374151', fontSize: '14px' }}>{scheduledLabel}</div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '999px', width: 'fit-content', ...statusBadgeStyle }}>
                      <span>{isCompleted ? '✅' : hasMeetingTimedOut(scheduledISO) ? '⏰' : isActive ? '🔵' : '🔒'}</span>
                      <span style={{ fontWeight: 700, fontSize: '13px' }}>
                        {isCompleted ? 'Completed' : hasMeetingTimedOut(scheduledISO) ? 'Timed Out' : isActive ? 'Active' : 'Locked'}
                      </span>
                    </div>

                    {!isCompleted && isActive && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button 
                          className="btn btn-primary" 
                          style={{ fontSize: '13px', padding: '6px 12px', opacity: hasMeetingTimedOut(scheduledISO) ? 0.5 : 1, cursor: hasMeetingTimedOut(scheduledISO) ? 'not-allowed' : 'pointer' }} 
                          onClick={() => handleMarkCompleted(displayIdx)}
                          disabled={hasMeetingTimedOut(scheduledISO)}
                          title={hasMeetingTimedOut(scheduledISO) ? 'Deadline passed - cannot mark as complete' : ''}
                        >
                          ✔ Mark Completed
                        </button>
                      </div>
                    )}

                    {!isCompleted && displayIdx === firstIncompleteDisplayIndex && (
                      <button 
                        className="btn btn-secondary" 
                        style={{ fontSize: '13px', padding: '6px 12px', width: 'fit-content' }} 
                        onClick={() => openReschedule(displayIdx)}
                        title="Reschedule this meeting to an earlier date"
                      >
                        🗓️ Reschedule
                      </button>
                    )}

                    {isCompleted && (
                      <button className="btn btn-secondary" style={{ fontSize: '13px', padding: '6px 12px', width: 'fit-content' }} onClick={() => openRemark(displayIdx)}>
                        📝 {m.remark ? 'Edit Remark' : 'Add Remark'}
                      </button>
                    )}
                  </div>

                  {rescheduleOpen && displayIdx === firstIncompleteDisplayIndex && !isCompleted && (
                    <div style={{ gridColumn: '1 / -1', marginTop: '5px', padding: '12px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>Reschedule {m.title}</div>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'end', flexWrap: 'wrap' }}>
                        <div className="form-group">
                          <label style={{ display: 'block', marginBottom: '6px' }}>New scheduled date (from today onwards)</label>
                          <input 
                            type="date" 
                            value={rescheduleDraftISO} 
                            onChange={e => setRescheduleDraftISO(e.target.value)}
                            min={getLocalISODate(today)}
                            style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e0' }} 
                          />
                          <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
                            ℹ️ You can only schedule from today or future dates
                          </div>
                        </div>
                        <button className="btn btn-primary" onClick={() => handleSaveReschedule(displayIdx)} disabled={!isValidISODate(rescheduleDraftISO)}>Save & Lock Future Dates</button>
                        <button className="btn btn-secondary" onClick={handleCancelReschedule}>Cancel</button>
                      </div>
                      <div style={{ marginTop: '8px', color: '#64748b', fontSize: '12px' }}>
                        Future meetings will be auto-adjusted to keep a {INTERVAL_DAYS}-day interval.
                      </div>
                    </div>
                  )}

                  {m.remark && editingRemarkIndex !== m.originalIndex && (
                    <div style={{ gridColumn: '1 / -1', marginTop: '5px', padding: '10px 12px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontWeight: '600', color: '#444' }}>Remark: </span>
                      <span style={{ color: '#333', whiteSpace: 'pre-wrap' }}>{m.remark}</span>
                    </div>
                  )}

                  {editingRemarkIndex === m.originalIndex && (
                    <div style={{ gridColumn: '1 / -1', marginTop: '5px', padding: '12px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontWeight: '800', color: '#0f172a', marginBottom: '8px' }}>
                        {m.remark ? 'Edit Remark' : 'Add Remark'} for {m.title}
                      </div>
                      <textarea value={remarkDraft} onChange={e => setRemarkDraft(e.target.value)}
                        placeholder="Type short notes or comments about this meeting..."
                        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0', minHeight: '70px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                      />
                      <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                        <button className="btn btn-primary" onClick={() => saveRemark(m.originalIndex)}>Save Remark</button>
                        <button className="btn btn-secondary" onClick={cancelRemark}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add Meeting Form */}
            {addMeetingOpen && (
              <div id="add-meeting-form" style={{
                display: 'flex', flexDirection: 'column', gap: '12px',
                padding: '16px', borderRadius: '10px',
                border: '1px solid #2563eb', background: '#eff6ff'
              }}>
                <div style={{ fontWeight: '800', color: '#1e3a8a', fontSize: '16px' }}>Schedule Extra Meeting</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#334155' }}>Insert After</label>
                    <select 
                      value={addMeetingInsertAfter} 
                      onChange={e => setAddMeetingInsertAfter(Number(e.target.value))}
                      style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e0', width: 'fit-content' }}
                    >
                      {Array.from({length: Math.min(MEETING_COUNT, plan.scheduledDates.length)}).map((_, i) => (
                        <option key={i} value={i}>Meeting {i + 1}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#334155' }}>Date</label>
                    <input 
                      type="date" 
                      value={addMeetingDate} 
                      onChange={e => setAddMeetingDate(e.target.value)}
                      min={getLocalISODate(today)}
                      style={{ padding: '10px 12px', borderRadius: '6px', border: '1px solid #cbd5e0', width: 'fit-content' }} 
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                    <input 
                      type="checkbox" 
                      id="addMeetingCompletedStatus"
                      checked={addMeetingCompleted}
                      onChange={e => setAddMeetingCompleted(e.target.checked)}
                      disabled={!allCompleted}
                      style={{ width: '16px', height: '16px', cursor: !allCompleted ? 'not-allowed' : 'pointer' }}
                    />
                    <label htmlFor="addMeetingCompletedStatus" style={{ fontWeight: 600, color: '#334155', cursor: !allCompleted ? 'not-allowed' : 'pointer', margin: 0 }}>
                      Mark as Completed
                    </label>
                    {!allCompleted && (
                      <span style={{ fontSize: '12px', color: '#ef4444', marginLeft: '4px' }}>
                        (Cannot mark as complete until all previous meetings are completed)
                      </span>
                    )}
                  </div>
                  <div className="form-group" style={{ marginBottom: 0, opacity: addMeetingCompleted ? 1 : 0.6 }}>
                    <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, color: '#334155' }}>Remark</label>
                    <textarea 
                      value={addMeetingRemark} 
                      onChange={e => setAddMeetingRemark(e.target.value)}
                      placeholder={addMeetingCompleted ? "Type short notes or agenda for this meeting..." : "Requires 'Completed' status to add remarks"}
                      disabled={!addMeetingCompleted}
                      style={{ 
                        width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e0', 
                        minHeight: '70px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
                        cursor: !addMeetingCompleted ? 'not-allowed' : 'text',
                        backgroundColor: !addMeetingCompleted ? '#f1f5f9' : '#fff'
                      }}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                  <button className="btn btn-primary" onClick={handleSaveNewMeeting} disabled={!isValidISODate(addMeetingDate)}>Save and Lock</button>
                  <button className="btn btn-secondary" onClick={cancelAddMeeting}>Cancel</button>
                </div>
              </div>
            )}
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

      <style>{`
        @keyframes slideDownFade {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUpFade {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
