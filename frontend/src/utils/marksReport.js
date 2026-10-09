// Shared marks-report builder used by the Coordinator dashboard (guide + PRC marks)
// and the Guide dashboard (guide marks only).

export const TRACKED_MARK_EVENTS = [
  { key: 'prc1', label: 'PRC-1', aliases: ['prc-1', 'prc 1', 'prc1'] },
  { key: 'prc2', label: 'PRC-2', aliases: ['prc-2', 'prc 2', 'prc2'] }
];
export const MARK_COMPONENT_MAX = 10;
export const MARK_GROUP_MAX = MARK_COMPONENT_MAX * 2;
export const MARKS_REPORT_MAX = TRACKED_MARK_EVENTS.length * MARK_GROUP_MAX;
export const GUIDE_MARKS_REPORT_MAX = TRACKED_MARK_EVENTS.length * MARK_COMPONENT_MAX;

export const normalizeEventTitle = (value = '') => String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const isGuideApproved = (submission) => submission?.status === 'accepted' || submission?.status === 'completed';

export const compareNatural = (left, right) => String(left || '').localeCompare(String(right || ''), undefined, {
  numeric: true,
  sensitivity: 'base'
});

// True once the timeline event's deadline has passed (same rule the backend uses).
export const isDeadlinePassed = (deadline) => Boolean(deadline) && new Date() > new Date(deadline);

export function buildMarksReport(batches = [], timelineEvents = [], submissions = []) {
  const markGroups = TRACKED_MARK_EVENTS.map(config => {
    const events = (timelineEvents || []).filter(event => {
      const normalized = normalizeEventTitle(event?.title || '');
      return config.aliases.some(alias => normalized.includes(alias));
    });
    const guideEvent = events.find(event => normalizeEventTitle(event.title).includes('guide')) || events[0];
    const prcEvent = events.find(event => normalizeEventTitle(event.title).includes('prc') && event._id !== guideEvent?._id)
      || events.find(event => event._id !== guideEvent?._id);
    return {
      key: config.key,
      label: config.label,
      guideEvent,
      prcEvent,
      max: MARK_GROUP_MAX,
      guideMax: MARK_COMPONENT_MAX,
      prcMax: MARK_COMPONENT_MAX
    };
  });

  if (!markGroups.some(group => group.guideEvent || group.prcEvent)) {
    return { columns: [], rows: [] };
  }

  const submissionsByKey = new Map();
  for (const submission of submissions) {
    const batchId = submission?.batchId && typeof submission.batchId === 'object' ? submission.batchId._id : submission.batchId;
    const eventId = submission?.timelineEventId && typeof submission.timelineEventId === 'object' ? submission.timelineEventId._id : submission.timelineEventId;
    if (!batchId || !eventId) continue;
    submissionsByKey.set(`${String(batchId)}::${String(eventId)}`, submission);
  }

  const rows = [];
  for (const batch of [...batches].sort((left, right) => compareNatural(left.teamName, right.teamName))) {
    const batchId = String(batch?._id || '');
    if (!batchId) continue;

    const members = new Map();
    const addMember = (member) => {
      if (!member) return;
      const uniqueKey = String(member._id || member.rollNo || member.rollNumber || `${member.name || 'member'}-${Math.random()}`);
      if (!members.has(uniqueKey)) {
        members.set(uniqueKey, {
          _id: member._id || member.rollNo || member.rollNumber || uniqueKey,
          name: member.name || 'Unknown Student',
          rollNo: member.rollNo || member.rollNumber || '—'
        });
      }
    };

    if (batch.leaderStudentId && typeof batch.leaderStudentId === 'object') {
      addMember(batch.leaderStudentId);
    }
    (batch.teamMembers || []).forEach(addMember);

    for (const submission of submissions) {
      const currentBatchId = submission?.batchId && typeof submission.batchId === 'object' ? submission.batchId._id : submission.batchId;
      if (String(currentBatchId) !== batchId) continue;
      (submission.studentMarks || []).forEach(markEntry => {
        const student = markEntry?.studentId && typeof markEntry.studentId === 'object' ? markEntry.studentId : null;
        if (!student) return;
        addMember({
          _id: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
          rollNo: student.rollNumber
        });
      });
      (submission.prcStudentMarks || []).forEach(markEntry => {
        const student = markEntry?.studentId && typeof markEntry.studentId === 'object' ? markEntry.studentId : null;
        if (!student) return;
        addMember({
          _id: student._id,
          name: student.name,
          rollNumber: student.rollNumber,
          rollNo: student.rollNumber
        });
      });
    }

    const memberList = Array.from(members.values()).sort((left, right) => compareNatural(left.rollNo, right.rollNo));
    if (!memberList.length) continue;

    for (const member of memberList) {
      const row = {
        studentId: member._id,
        teamKey: batchId,
        teamName: batch.teamName || 'Unknown Team',
        projectTitle: batch.problemId?.title || batch.problemTitle || batch.title || 'Not Assigned',
        guideName: batch.guideId?.name || (typeof batch.guideId === 'string' ? batch.guideId : 'Not Assigned'),
        memberName: member.name,
        rollNumber: member.rollNo || '—'
      };
      let total = 0;
      let guideTotal = 0;
      const guideFeedbacks = [];
      const prcFeedbacks = [];

      for (const group of markGroups) {
        const guideSubmission = group.guideEvent && submissionsByKey.get(`${batchId}::${String(group.guideEvent._id)}`);
        const prcSubmission = group.prcEvent && submissionsByKey.get(`${batchId}::${String(group.prcEvent._id)}`);
        const submission = guideSubmission || prcSubmission;
        const findStudentMark = (source, predicate) => (source?.studentMarks || []).find(markEntry => {
          const studentId = markEntry?.studentId && typeof markEntry.studentId === 'object' ? markEntry.studentId._id : markEntry.studentId;
          return String(studentId) === String(member._id) && predicate(markEntry);
        });

        const guideEntry = findStudentMark(guideSubmission || submission, markEntry => (
          markEntry.marks !== null && markEntry.marks !== undefined
        ));
        const guideMarks = guideEntry ? Number(guideEntry.marks) : 0;
        const prcEntry = [...(prcSubmission?.prcStudentMarks || []), ...(guideSubmission?.prcStudentMarks || [])].find(markEntry => {
          const sid = markEntry?.studentId && typeof markEntry.studentId === 'object' ? markEntry.studentId._id : markEntry.studentId;
          return String(sid) === String(member._id);
        });
        const nestedPrcEntry = findStudentMark(prcSubmission || submission, markEntry => (
          markEntry.prcMarks !== null && markEntry.prcMarks !== undefined
        ));
        const guideNestedPrcEntry = guideSubmission && findStudentMark(guideSubmission, markEntry => (
          markEntry.prcMarks !== null && markEntry.prcMarks !== undefined
        ));
        const prcMarks = prcEntry?.marks ?? nestedPrcEntry?.prcMarks ?? guideNestedPrcEntry?.prcMarks
          ?? prcSubmission?.prcMarks ?? guideSubmission?.prcMarks ?? 0;

        if (guideSubmission?.comments?.length) guideFeedbacks.push(...guideSubmission.comments.map(comment => comment.comment).filter(Boolean));
        if (prcSubmission?.adminRemarks?.length) prcFeedbacks.push(...prcSubmission.adminRemarks.map(remark => remark.remark).filter(Boolean));

        row[`${group.key}Guide`] = guideMarks;
        row[`${group.key}Prc`] = prcMarks;
        row[`${group.key}Total`] = guideMarks + prcMarks;
        row[`${group.key}SubmissionId`] = prcSubmission?._id || submission?._id || '';
        row[`${group.key}TimelineEventId`] = group.prcEvent?._id || group.guideEvent?._id || '';
        row[`${group.key}GuideSubmissionId`] = guideSubmission?._id || (!group.guideEvent ? submission?._id : '') || '';
        row[`${group.key}GuideEventId`] = group.guideEvent?._id || group.prcEvent?._id || '';
        row[`${group.key}BatchId`] = batchId;
        row[`${group.key}GuideApproved`] = isGuideApproved(guideSubmission);

        total += (guideMarks + prcMarks);
        guideTotal += guideMarks;
      }

      row.guideFeedback = guideFeedbacks.length > 0 ? guideFeedbacks.join(' | ') : 'N/A';
      row.prcFeedback = prcFeedbacks.length > 0 ? prcFeedbacks.join(' | ') : 'N/A';
      row.total = total;
      row.guideTotal = guideTotal;
      row.outOf = MARKS_REPORT_MAX;
      row.percentage = Math.round((total / MARKS_REPORT_MAX) * 100);
      rows.push(row);
    }
  }

  return {
    columns: markGroups.map(group => {
      const guideDeadlineEvent = group.guideEvent || group.prcEvent;
      return {
        key: group.key,
        label: group.label,
        guideKey: `${group.key}Guide`,
        prcKey: `${group.key}Prc`,
        totalKey: `${group.key}Total`,
        guideMax: group.guideMax,
        prcMax: group.prcMax,
        max: group.max,
        guideDeadline: guideDeadlineEvent?.deadline || null,
        guideEventTitle: guideDeadlineEvent?.title || group.label
      };
    }),
    rows
  };
}

export function getTeamRowSpan(rows, index) {
  const nextTeamIndex = rows.slice(index).findIndex(row => row.teamKey !== rows[index].teamKey);
  return nextTeamIndex === -1 ? rows.length - index : nextTeamIndex;
}
