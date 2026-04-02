import { useEffect, useMemo, useState } from 'react';
import * as api from '../../services/api';

const MEETING_COUNT = 6;
const INTERVAL_DAYS = 15;

function pad2(n) {
  return String(n).padStart(2, '0');
}

function getLocalISODate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseLocalISODate(isoDate) {
  const [y, m, d] = (isoDate || '').split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function isValidISODate(iso) {
  if (typeof iso !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && !!parseLocalISODate(iso);
}

function addDaysToLocalISODate(isoDate, days) {
  const parsed = parseLocalISODate(isoDate);
  if (!parsed) return null;
  const next = new Date(parsed);
  next.setDate(next.getDate() + days);
  return getLocalISODate(next);
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

export default function StudentMeetings({ batchId }) {
const [plan, setPlan] = useState(null);
const [loading, setLoading] = useState(true);
const [now] = useState(() => new Date());

  useEffect(() => {
    if (!batchId) {
      setPlan(null);
      setLoading(false);
      return;
    }

    const fetchPlan = async () => {
      try {
        const res = await api.getMeetingPlan(batchId);
        setPlan(res.data.data);
      } catch (error) {
        console.error('Error fetching meeting plan:', error);
        setPlan(null);
      } finally {
        setLoading(false);
      }
    };

    // Initial fetch
    fetchPlan();

    // Poll every 30 seconds to auto-reflect guide's changes
    const pollInterval = setInterval(() => {
      fetchPlan();
    }, 30000);

    return () => clearInterval(pollInterval);
  }, [batchId]);

  const today = useMemo(() => startOfDay(now), [now]);

  const displayMeetings = useMemo(() => {
    if (!plan) return [];
    
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
    
    for (let i = 0; i < Math.min(MEETING_COUNT, rawMeetings.length); i++) {
       const baseMeeting = rawMeetings[i];
       baseMeeting.title = `Meeting ${i + 1}`;
       finalOrder.push(baseMeeting);
       
       const extras = rawMeetings.filter(m => m.isExtra && m.insertAfter === i);
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

  const firstIncompleteDisplayIndex = useMemo(() => {
    if (displayMeetings.length === 0) return -1;
    return displayMeetings.findIndex(m => m.completed !== true);
  }, [displayMeetings]);

  if (loading) {
    return <div style={{ padding: '24px 0' }}><div className="card loading"><h3>Loading...</h3></div></div>;
  }

  if (!plan) {
    return (
      <div style={{ padding: '24px 0' }}>
        <div style={{ textAlign: 'center', padding: '40px 20px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🤝</div>
          <h3 style={{ color: '#374151', marginBottom: '8px' }}>No Meeting Schedule Yet</h3>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
            Your guide hasn't set up the meeting schedule for your team yet. Check back later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '4px 0' }}>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          Meetings
        </h2>
        <p style={{ color: '#6b7280', margin: 0, fontSize: '14px' }}>
          Track your project meetings with your guide. Meetings follow a sequential schedule with {INTERVAL_DAYS} days between each.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {displayMeetings.map((m, displayIdx) => {
          const isCompleted = m.completed === true;
          const completedDateISO = m.completedDateISO;
          const scheduledISO = m.scheduledDateISO;
          const scheduledDate = parseLocalISODate(scheduledISO);

          const isNextUp = displayIdx === firstIncompleteDisplayIndex;
          const isPrevIncomplete = displayIdx > 0 && !displayMeetings[displayIdx - 1].completed;
          const notYetDue = scheduledDate && scheduledDate.getTime() > today.getTime();

          let subText = '';
          if (isCompleted && completedDateISO) {
            subText = `Completed on ${formatDate(completedDateISO)}`;
          } else if (isPrevIncomplete) {
            subText = 'Waiting for previous meeting to be completed';
          } else if (isNextUp && notYetDue) {
            const availableDate = scheduledDate ? formatDate(scheduledISO) : '';
            const msLeft = scheduledDate.getTime() - today.getTime();
            const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
            const prevCompletedISO = displayIdx > 0 ? displayMeetings[displayIdx - 1].completedDateISO : null;
            if (prevCompletedISO) {
              const nextDateISO = addDaysToLocalISODate(prevCompletedISO, INTERVAL_DAYS);
              subText = `${m.title} will be conducted after ${INTERVAL_DAYS} days from the previous meeting date (available from ${formatDate(nextDateISO || scheduledISO)})`;
            } else {
              subText = `Available in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} (from ${availableDate})`;
            }
          } else if (isNextUp) {
            subText = 'Ready — guide will mark this meeting';
          }

          const cardBg = isCompleted ? '#f0fdf4' : (m.isExtra ? '#f8fafc' : '#fff');
          const borderColor = isCompleted ? '#bbf7d0' : (m.isExtra ? '#93c5fd' : '#e5e7eb');
          const borderStyle = m.isExtra ? 'dashed' : 'solid';
          const numberBg = isCompleted ? '#22c55e' : (m.isExtra ? '#e0f2fe' : '#f3f4f6');
          const numberColor = isCompleted ? '#fff' : (m.isExtra ? '#0369a1' : '#6b7280');
          const titleColor = isCompleted ? '#166534' : '#111827';

          return (
            <div
              key={m.originalIndex}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '14px',
                padding: '16px 18px',
                borderRadius: '12px',
                border: `2px ${borderStyle} ${borderColor}`,
                background: cardBg,
                opacity: !isCompleted && !isNextUp ? 0.7 : 1,
                boxShadow: isCompleted ? 'none' : '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                background: numberBg, color: numberColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: '800', fontSize: m.isExtra ? '12px' : '15px', textAlign: 'center'
              }}>
                {m.isExtra ? 'EX' : (m.originalIndex + 1)}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '700', fontSize: '16px', color: titleColor }}>
                  {m.title}
                </div>
                {subText && (
                  <div style={{ color: '#4b5563', fontSize: '13px', marginTop: '4px', lineHeight: '1.4' }}>
                    {subText}
                  </div>
                )}
                {m.remark && (
                  <div style={{ marginTop: '8px', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#374151' }}>
                    <span style={{ fontWeight: 600 }}>Remark: </span>{m.remark}
                  </div>
                )}
              </div>

              <div style={{ flexShrink: 0, fontSize: '20px' }}>
                {isCompleted ? '✅' : '🔒'}
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
