import { useEffect, useMemo, useState } from 'react';
import * as api from '../../services/api';

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

function addDaysToLocalISODate(isoDate, days) {
  const parsed = parseLocalISODate(isoDate);
  if (!parsed) return null;
  const next = new Date(parsed);
  next.setDate(next.getDate() + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
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
        setPlan(null);
      } finally {
        setLoading(false);
      }
    };
    fetchPlan();
  }, [batchId]);

  const today = useMemo(() => startOfDay(now), [now]);

  const firstIncompleteIndex = useMemo(() => {
    if (!plan) return -1;
    return plan.completed.findIndex(c => c !== true);
  }, [plan]);

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
        {Array.from({ length: MEETING_COUNT }, (_, idx) => {
          const isCompleted = plan.completed[idx] === true;
          const completedDateISO = plan.completedDates?.[idx];
          const scheduledISO = plan.scheduledDates[idx];
          const scheduledDate = parseLocalISODate(scheduledISO);

          const isNextUp = idx === firstIncompleteIndex;
          const isPrevIncomplete = idx > 0 && !plan.completed[idx - 1];
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
            const prevCompletedISO = idx > 0 ? plan.completedDates?.[idx - 1] : null;
            if (prevCompletedISO) {
              const nextDateISO = addDaysToLocalISODate(prevCompletedISO, INTERVAL_DAYS);
              subText = `Meeting ${idx + 1} will be conducted after ${INTERVAL_DAYS} days from the previous meeting date (available from ${formatDate(nextDateISO || scheduledISO)})`;
            } else {
              subText = `Available in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} (from ${availableDate})`;
            }
          } else if (isNextUp) {
            subText = 'Ready — guide will mark this meeting';
          }

          const cardBg = isCompleted ? '#f0fdf4' : '#fff';
          const borderColor = isCompleted ? '#bbf7d0' : '#e5e7eb';
          const numberBg = isCompleted ? '#22c55e' : '#f3f4f6';
          const numberColor = isCompleted ? '#fff' : '#6b7280';
          const titleColor = isCompleted ? '#166534' : '#111827';

          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '14px',
                padding: '16px 18px',
                borderRadius: '12px',
                border: `1px solid ${borderColor}`,
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
                fontWeight: '800', fontSize: '15px'
              }}>
                {idx + 1}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '700', fontSize: '16px', color: titleColor }}>
                  Meeting {idx + 1}
                </div>
                {subText && (
                  <div style={{ color: '#4b5563', fontSize: '13px', marginTop: '4px', lineHeight: '1.4' }}>
                    {subText}
                  </div>
                )}
                {isCompleted && plan.remarks?.[idx] && (
                  <div style={{ marginTop: '8px', padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#374151' }}>
                    <span style={{ fontWeight: 600 }}>Remark: </span>{plan.remarks[idx]}
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
    </div>
  );
}
