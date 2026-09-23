import { useState, useEffect, useCallback, useMemo } from "react";
import * as api from "../../services/api";
import usePolling from "../../utils/usePolling";
import * as XLSX from "xlsx-js-style";
import jsPDF from "jspdf";
import "jspdf-autotable";

const TARGET_YEARS = ["all", "2nd", "3rd", "4th"];
const ALL_COLUMNS = [
  { key: "teamName", label: "Team Name" },
  { key: "teamMembers", label: "Team Members" },
  { key: "year", label: "Year" },
  { key: "branch", label: "Branch" },
  { key: "section", label: "Section" },
  { key: "coe", label: "COE/RC", width: "100px" },
  { key: "domain", label: "Domain", width: "100px" },
  { key: "guide", label: "Guide", width: "100px" },
  { key: "marks", label: "Guide Marks" },
  { key: "prcMarks", label: "PRC Marks" },
  { key: "guidesFeedback", label: "Guide's Feedback", width: "120px" },
  { key: "adminRemarks", label: "Coordinator Feedback", width: "120px" },
];

const getColumnsForScope = (scope) => {
  if (scope) {
    return [
      { key: "teamName", label: "Team Name" },
      { key: "teamMembers", label: "Team Members" },
      { key: "coe", label: "COE/RC", width: "100px" },
      { key: "guide", label: "Guide", width: "100px" },
      { key: "marks", label: "Guide Marks" },
      { key: "prcMarks", label: "PRC Marks" },
      { key: "guidesFeedback", label: "Guide's Feedback", width: "120px" },
      { key: "adminRemarks", label: "PRC Remarks", width: "120px" },
    ];
  }
  return ALL_COLUMNS;
};

const isGuideApproved = (submission) => (
  submission?.status === 'accepted' || submission?.status === 'completed'
);

const hasUploadedVersion = (submission) => (
  Array.isArray(submission?.versions) && submission.versions.length > 0
);

const compareNatural = (left, right) => String(left || '').localeCompare(String(right || ''), undefined, {
  numeric: true,
  sensitivity: 'base'
});

const formatExcelComment = (value) => {
  const text = String(value || 'N/A').trim();
  if (!text) return 'N/A';
  return text.replace(/(.{1,58})(\s+|$)/g, '$1\n').trim();
};

function TimelineReadOnly({ scope }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadEvents = async () => {
      try {
        const response = await api.getAllTimelineEvents(scope?.year);
        setEvents(response.data?.data || response.data || []);
      } catch (error) {
        console.error('Unable to fetch the section timeline:', error);
      } finally {
        setLoading(false);
      }
    };
    loadEvents();
  }, [scope?.year]);

  if (loading) return <div className="tab-content"><div className="card loading"><h3>Loading timeline...</h3></div></div>;

  return (
    <div className="tab-content">
      <div className="section-header" style={{ marginBottom: '20px' }}>
        <div>
          <h2>📅 Section Timeline</h2>
          <p style={{ color: '#64748b', margin: '4px 0 0' }}>Read-only milestones for {scope?.year} year.</p>
        </div>
      </div>
      {events.length === 0 ? (
        <div className="card empty-state"><h3>No timeline events</h3><p>There are no active milestones for this year.</p></div>
      ) : (
        <div style={{ display: 'grid', gap: '14px' }}>
          {events.map(event => (
            <article className="card" key={event._id} style={{ borderLeft: '4px solid #3b82f6' }}>
              <div className="flex-between" style={{ gap: '16px' }}>
                <div><h3 style={{ margin: 0 }}>{event.title}</h3><p style={{ margin: '8px 0', color: '#475569' }}>{event.description || 'No description provided.'}</p></div>
                <strong style={{ color: '#1d4ed8', whiteSpace: 'nowrap' }}>{new Date(event.deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
              </div>
              {event.submissionRequirements && <small style={{ color: '#64748b' }}>Requirements: {event.submissionRequirements}</small>}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function TimelineEditor({ scope = null, allowRemarkEditing = true }) {
  const [events, setEvents] = useState([]);
  const [batches, setBatches] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const canAddRemarks = allowRemarkEditing;
  const canEditPrcMarks = Boolean(scope && allowRemarkEditing);
  const [loading, setLoading] = useState(true);
  const visibleBatches = useMemo(() => {
    const filtered = !scope ? batches : batches.filter(batch =>
      batch.year === scope.year &&
      batch.branch === scope.branch &&
      batch.section === scope.section
    );
    return [...filtered].sort((left, right) => compareNatural(left.teamName, right.teamName));
  }, [batches, scope]);
  const visibleEvents = useMemo(() => {
    if (!scope) return events;
    return events.filter(event =>
      event.targetYear === 'all' ||
      event.targetYear === scope.year ||
      event.targetYear === undefined ||
      event.targetYear === null
    );
  }, [events, scope]);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    deadline: "",
    maxMarks: "",
    submissionRequirements: "",
    targetYear: scope?.year || "all",
    order: 0,
    isMarksEnabled: true,
  });

  // Pagination and lazy loading
  const [submissionPage, setSubmissionPage] = useState(1);
  const [submissionPagination, setSubmissionPagination] = useState({
    current: 1,
    total: 0,
    limit: 10,
    pages: 0
  });
  const SUBMISSIONS_PAGE_SIZE = 10;
  const [isLoadingMoreSubmissions, setIsLoadingMoreSubmissions] = useState(false);

  // Filters
  const [filterYear, setFilterYear] = useState(scope?.year || "");
  const [filterBranch, setFilterBranch] = useState(scope?.branch || "");
  const [filterSection, setFilterSection] = useState(scope?.section || "");

  // Admin remarks state
  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [selectedSubmissionForRemark, setSelectedSubmissionForRemark] =
    useState(null);
  const [remarkText, setRemarkText] = useState("");
  const [expandedRemarkSubmission, setExpandedRemarkSubmission] =
    useState(null);
  const [expandedFeedbackSubmission, setExpandedFeedbackSubmission] =
    useState(null);
  const activeColumns = useMemo(() => getColumnsForScope(scope), [scope]);
  const [selectedColumns, setSelectedColumns] = useState(() =>
    getColumnsForScope(scope).map((col) => col.key)
  );
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

  // Submission stats per event (shown on event cards): { [eventId]: { submitted, total } }
  const [eventStats, setEventStats] = useState({});

  // Toggle for submitted / not submitted filter in event detail view
  const [submissionFilter, setSubmissionFilter] = useState('all'); // 'all' | 'submitted' | 'not_submitted'


  // PRC Marks state
  const [showPRCMarksModal, setShowPRCMarksModal] = useState(false);
  const [selectedSubmissionForPRC, setSelectedSubmissionForPRC] = useState(null);
  const [selectedBatchForPRC, setSelectedBatchForPRC] = useState(null);
  const [prcStudentMarkInputs, setPrcStudentMarkInputs] = useState({});
  const [prcBatchStudents, setPrcBatchStudents] = useState([]);
  const [loadingPRCStudents, setLoadingPRCStudents] = useState(false);
  const [savingPRCMarks, setSavingPRCMarks] = useState(false);
  const [prcError, setPrcError] = useState("");

  useEffect(() => {
    setSelectedColumns(getColumnsForScope(scope).map((col) => col.key));
  }, [scope]);

  const openPRCMarksModal = useCallback(async (sub, batch) => {
    if (!canEditPrcMarks) {
      alert("Only the class coordinator can assign PRC marks.");
      return;
    }
    if (!isGuideApproved(sub)) {
      alert("PRC marks can only be given for accepted batches.");
      return;
    }
    setSelectedSubmissionForPRC(sub);
    setSelectedBatchForPRC(batch);
    setShowPRCMarksModal(true);
    setPrcError("");
    setLoadingPRCStudents(true);

    const batchId = typeof sub.batchId === "string" ? sub.batchId : sub.batchId?._id;
    try {
      const res = await api.getBatchStudents(batchId);
      const students = res.data?.data || [];
      setPrcBatchStudents(students);

      const existing = {};
      if (Array.isArray(sub.prcStudentMarks)) {
        sub.prcStudentMarks.forEach((sm) => {
          const sid = typeof sm.studentId === "object" ? sm.studentId?._id : sm.studentId;
          if (sid) {
            existing[sid] = sm.marks !== null && sm.marks !== undefined ? String(sm.marks) : "";
          }
        });
      }
      students.forEach((s) => {
        if (!(s._id in existing)) existing[s._id] = "";
      });
      setPrcStudentMarkInputs(existing);
    } catch (err) {
      console.error("Failed to load students for PRC marks:", err);
      setPrcError("Could not fetch students for this batch.");
    } finally {
      setLoadingPRCStudents(false);
    }
  }, [canEditPrcMarks]);

  const handleSavePRCMarks = async () => {
    if (!selectedSubmissionForPRC) return;
    if (!isGuideApproved(selectedSubmissionForPRC)) {
      setPrcError("PRC marks can only be given for accepted batches.");
      return;
    }
    setPrcError("");

    for (const s of prcBatchStudents) {
      const valStr = prcStudentMarkInputs[s._id];
      if (valStr !== "" && valStr !== undefined && valStr !== null) {
        const val = parseFloat(valStr);
        if (isNaN(val) || val < 0 || val > 25) {
          setPrcError(`Marks for ${s.name || s.rollNumber} must be between 0 and 25.`);
          return;
        }
      }
    }

    setSavingPRCMarks(true);
    try {
      const prcStudentMarks = prcBatchStudents.map((s) => ({
        studentId: s._id,
        marks: prcStudentMarkInputs[s._id] !== "" && prcStudentMarkInputs[s._id] !== undefined
          ? parseFloat(prcStudentMarkInputs[s._id])
          : null,
      }));

      const res = await api.assignPRCMarks(selectedSubmissionForPRC._id, { prcStudentMarks });
      const updatedSub = res.data?.data;

      if (updatedSub) {
        setSubmissions((prev) =>
          prev.map((s) => (s._id === updatedSub._id ? updatedSub : s))
        );
      }

      setShowPRCMarksModal(false);
      setSelectedSubmissionForPRC(null);
      setSelectedBatchForPRC(null);
    } catch (err) {
      console.error("Error saving PRC marks:", err);
      setPrcError(err.response?.data?.message || "Failed to save PRC marks.");
    } finally {
      setSavingPRCMarks(false);
    }
  };

  const fetchEvents = useCallback(async () => {
    try {
      let eventsData = [];

      try {
        const eventsRes = await api.getAllTimelineEvents(scope?.year);
        if (Array.isArray(eventsRes.data)) {
          eventsData = eventsRes.data;
        } else if (eventsRes.data?.data && Array.isArray(eventsRes.data.data)) {
          eventsData = eventsRes.data.data;
        }
      } catch (error) {
        console.error("Events fetch error:", error.message);
      }

      setEvents(eventsData);
      // Removed clearing of batches/submissions to avoid flickering during auto-poll
      if (loading) setLoading(false);
    } catch (error) {
      console.error("Fetch error:", error.message);
      if (loading) setLoading(false);
    }
  }, [loading, scope?.year]);

  // Fetch batches lazily - only when event is selected
  const fetchBatchesForEvent = useCallback(async () => {
    try {
      const batchesRes = scope ? await api.getSectionBatches() : await api.getAllBatches();
      const batchesData = batchesRes.data?.data || batchesRes.data || [];
      const scoped = scope
        ? batchesData.filter(batch => batch.year === scope.year && batch.branch === scope.branch && batch.section === scope.section)
        : batchesData;
      setBatches(scoped);
      return scoped;
    } catch (error) {
      console.error("Batches fetch error:", error.message);
      return [];
    }
  }, [scope]);

  // Fetch lightweight submission counts per event for stats on event cards
  const fetchEventStats = useCallback(async (eventsData) => {
    if (!eventsData || eventsData.length === 0) return;
    try {
      // Fetch all batches for total count
      const batchesRes = scope ? await api.getSectionBatches() : await api.getAllBatches();
      const batchesData = batchesRes.data?.data || batchesRes.data || [];
      const scopedBatches = scope
        ? batchesData.filter(b => b.year === scope.year && b.branch === scope.branch && b.section === scope.section)
        : batchesData;
      const filteredBatches = scopedBatches.filter(batch => (
        (!filterYear || batch.year === filterYear) &&
        (!filterBranch || batch.branch === filterBranch) &&
        (!filterSection || batch.section === filterSection)
      ));
      const totalBatches = filteredBatches.length;

      // Fetch all submissions for this scope with status='all'
      const subsRes = await api.getAllSubmissions({ status: 'all', limit: 1000 });
      const subsData = subsRes.data?.data || subsRes.data || [];
      const scopedBatchIds = new Set(filteredBatches.map(b => b._id.toString()));
      const statsMap = {};
      eventsData.forEach(event => {
        const approvedBatchIds = new Set();
        const submittedBatchIds = new Set();
        subsData.forEach(sub => {
          const subEventId = typeof sub.timelineEventId === 'string' ? sub.timelineEventId : sub.timelineEventId?._id;
          const subBatchId = typeof sub.batchId === 'string' ? sub.batchId : sub.batchId?._id;
          if (subEventId === event._id && hasUploadedVersion(sub) && subBatchId && scopedBatchIds.has(subBatchId.toString())) {
            if (isGuideApproved(sub)) {
              approvedBatchIds.add(subBatchId.toString());
            } else {
              submittedBatchIds.add(subBatchId.toString());
            }
          }
        });
        statsMap[event._id] = {
          approved: approvedBatchIds.size,
          submitted: submittedBatchIds.size,
          notSubmitted: Math.max(0, totalBatches - approvedBatchIds.size - submittedBatchIds.size),
          total: totalBatches
        };

      });
      setEventStats(statsMap);
    } catch (err) {
      console.error("Event stats fetch error:", err.message);
    }
  }, [scope, filterYear, filterBranch, filterSection, selectedEvent?._id]);

  // Fetch submissions for selected event with pagination
  const fetchSubmissionsForEvent = useCallback(async (eventId, page = 1) => {
    try {
      if (!eventId) return;

      if (page === 1) {
        if (submissions.length === 0) setIsLoadingMoreSubmissions(true);
      } else {
        setIsLoadingMoreSubmissions(true);
      }

      const submissionsRes = await api.getAllSubmissions({
        eventId,
        page,
        limit: 1000,
        status: 'all'
      });

      const newSubmissions = submissionsRes.data?.data || submissionsRes.data || [];
      const pagination = submissionsRes.data?.pagination || {
        current: page,
        total: 0,
        limit: 1000,
        pages: 0
      };

      setSubmissions(newSubmissions);

      setSubmissionPagination(pagination);
      setSubmissionPage(page);
      setIsLoadingMoreSubmissions(false);
    } catch (error) {
      console.error("Submissions fetch error:", error.message);
      setIsLoadingMoreSubmissions(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Load stats for event cards after events are available
  useEffect(() => {
    if (events.length > 0) {
      fetchEventStats(events);
    }
  }, [events, fetchEventStats, selectedEvent?._id]);

  // Reset submission filter when switching events
  useEffect(() => {
    setSubmissionFilter('all');
  }, [selectedEvent?._id]);

  useEffect(() => {
    if (!scope) return;
    setFilterYear(scope.year || "");
    setFilterBranch(scope.branch || "");
    setFilterSection(scope.section || "");
  }, [scope]);

  useEffect(() => {
    if (scope && selectedEvent && !visibleEvents.some(event => event._id === selectedEvent._id)) {
      setSelectedEvent(null);
    }
  }, [scope, selectedEvent, visibleEvents]);

  useEffect(() => {
    if (selectedEvent?._id) {
      const load = async () => {
        if (batches.length === 0) {
          await fetchBatchesForEvent();
        }
        await fetchSubmissionsForEvent(selectedEvent._id, 1);
      };
      load();
    }
  }, [selectedEvent?._id, fetchSubmissionsForEvent, fetchBatchesForEvent, batches.length]);

  const filteredEventSubmissions = useMemo(() => submissions.filter((sub) => {
    const subEventId = typeof sub.timelineEventId === "string"
      ? sub.timelineEventId
      : sub.timelineEventId?._id;
    if (subEventId !== selectedEvent?._id) return false;

    const batchId = typeof sub.batchId === "string" ? sub.batchId : sub.batchId?._id;
    const batch = visibleBatches.find((item) => item._id?.toString() === batchId?.toString());
    if (!batch) return false;
    if (filterYear && batch.year !== filterYear) return false;
    if (filterBranch && batch.branch !== filterBranch) return false;
    if (filterSection && batch.section !== filterSection) return false;

    const uploaded = hasUploadedVersion(sub);
    if (submissionFilter === 'approved') return uploaded && isGuideApproved(sub);
    if (submissionFilter === 'submitted') return uploaded && !isGuideApproved(sub);
    if (submissionFilter === 'not_submitted') return false;
    return uploaded;
  }).sort((left, right) => {
    const leftBatchId = typeof left.batchId === 'string' ? left.batchId : left.batchId?._id;
    const rightBatchId = typeof right.batchId === 'string' ? right.batchId : right.batchId?._id;
    const leftBatch = visibleBatches.find(batch => String(batch._id) === String(leftBatchId));
    const rightBatch = visibleBatches.find(batch => String(batch._id) === String(rightBatchId));
    return compareNatural(leftBatch?.teamName, rightBatch?.teamName);
  }), [submissions, selectedEvent?._id, visibleBatches, filterYear, filterBranch, filterSection, submissionFilter]);

  const notSubmittedBatches = useMemo(() => {
    if (submissionFilter !== 'all' && submissionFilter !== 'not_submitted') return [];
    const submittedBatchIds = new Set(
      submissions.filter((sub) => {
        const subEventId = typeof sub.timelineEventId === "string" ? sub.timelineEventId : sub.timelineEventId?._id;
        return subEventId === selectedEvent?._id && hasUploadedVersion(sub);
      }).map((sub) => {
        const batchId = typeof sub.batchId === "string" ? sub.batchId : sub.batchId?._id;
        return batchId?.toString();
      }).filter(Boolean)
    );

    return visibleBatches.filter((batch) => (
      !submittedBatchIds.has(batch._id?.toString()) &&
      (!filterYear || batch.year === filterYear) &&
      (!filterBranch || batch.branch === filterBranch) &&
      (!filterSection || batch.section === filterSection)
    ));
  }, [submissions, selectedEvent?._id, visibleBatches, filterYear, filterBranch, filterSection, submissionFilter]);

  const totalDisplayRows = filteredEventSubmissions.length + notSubmittedBatches.length;
  const displayPages = Math.ceil(totalDisplayRows / SUBMISSIONS_PAGE_SIZE);
  const displayPageStart = (submissionPagination.current - 1) * SUBMISSIONS_PAGE_SIZE;
  const displayPageEnd = displayPageStart + SUBMISSIONS_PAGE_SIZE;
  const submittedPageRows = filteredEventSubmissions.slice(displayPageStart, displayPageEnd);
  const notSubmittedPageStart = Math.max(0, displayPageStart - filteredEventSubmissions.length);
  const notSubmittedPageEnd = Math.max(0, displayPageEnd - filteredEventSubmissions.length);

  useEffect(() => {
    setSubmissionPagination((current) => ({
      ...current,
      total: totalDisplayRows,
      limit: SUBMISSIONS_PAGE_SIZE,
      pages: displayPages,
      current: displayPages > 0 ? Math.min(current.current, displayPages) : 1
    }));
  }, [totalDisplayRows, displayPages]);

  useEffect(() => {
    setSubmissionPage(1);
    setSubmissionPagination((current) => ({ ...current, current: 1 }));
  }, [selectedEvent?._id, submissionFilter, filterYear, filterBranch, filterSection]);

  // Poll every 60s for new events/batches only (not submissions) - reduced from 25s
  usePolling(fetchEvents, 60000);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showColumnDropdown && !e.target.closest('.column-dropdown-container')) {
        setShowColumnDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColumnDropdown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("Submitting form with data:", formData);

    const data = new FormData();
    Object.keys(formData).forEach(key => {
      data.append(key, formData[key]);
    });

    try {
      if (editingEvent) {
        console.log("Updating event:", editingEvent._id);
        await api.updateTimelineEvent(editingEvent._id, data);
      } else {
        console.log("Creating new event");
        await api.createTimelineEvent(data);
      }
      console.log("Event saved successfully");
      setShowForm(false);
      setEditingEvent(null);
      setFormData({
        title: "",
        description: "",
        deadline: "",
        maxMarks: "",
        submissionRequirements: "",
        targetYear: scope?.year || "all",
        order: 0,
        isMarksEnabled: true,
      });
      fetchEvents();
    } catch (error) {
      console.error("Failed to save event:", error);
      console.error("Error response:", error.response);
      alert(error.response?.data?.message || "Failed to save event");
    }
  };

  const handleEdit = (event) => {
    setEditingEvent(event);
    setFormData({
      title: event.title,
      description: event.description || "",
      deadline: event.deadline.split("T")[0],
      maxMarks: event.maxMarks,
      submissionRequirements: event.submissionRequirements || "",
      targetYear: scope?.year || event.targetYear,
      order: event.order || 0,
      isMarksEnabled: event.isMarksEnabled !== undefined ? event.isMarksEnabled : true,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this timeline event?")) return;
    try {
      await api.deleteTimelineEvent(id);
      fetchEvents();
    } catch (error) {
      alert("Failed to delete");
    }
  };

  const getStatusBadge = (deadline) => {
    const now = new Date();
    const dl = new Date(deadline);
    const diff = (dl - now) / (1000 * 60 * 60 * 24);
    if (diff < 0)
      return (
        <span className="timeline-badge badge-danger">
          Past Due
        </span>
      );
    if (diff < 3)
      return (
        <span className="timeline-badge badge-warning">
          Due Soon
        </span>
      );
    return (
      <span className="timeline-badge badge-success">
        Upcoming
      </span>
    );
  };

  if (loading && events.length === 0) {
    return (
      <div style={{ padding: '20px' }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="card" style={{ marginBottom: '15px', opacity: 0.5 }}>
            <div style={{ height: '18px', background: '#e2e8f0', borderRadius: '4px', width: '40%', marginBottom: '10px' }} />
            <div style={{ height: '12px', background: '#e2e8f0', borderRadius: '4px', width: '70%' }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="tab-content">
      <div className="flex-between" style={{ marginBottom: "20px" }}>
        <h2>📅 Timeline Management</h2>
        <button
          className="btn btn-primary"
          onClick={() => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const defaultDate = tomorrow.toISOString().split("T")[0];
            setShowForm(true);
            setEditingEvent(null);
            setFormData({
              title: "",
              description: "",
              deadline: defaultDate,
              maxMarks: "",
              submissionRequirements: "",
              targetYear: scope?.year || "all",
              order: 0,
              isMarksEnabled: true,
            });
          }}
        >
          + Add Event
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: "20px" }}>
          <h3>{editingEvent ? "Edit Event" : "Create New Timeline Event"}</h3>
          <form onSubmit={handleSubmit}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "15px",
              }}
            >
              <div className="form-group">
                <label>Event Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="e.g., Abstract Submission, PRC-1"
                  required
                />
              </div>
              <div className="form-group">
                <label>Deadline *</label>
                <input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) =>
                    setFormData({ ...formData, deadline: e.target.value })
                  }
                  required
                />
                <small style={{ color: "#666", fontSize: "12px" }}>
                  Select a future date for the deadline
                </small>
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px', height: '100%', marginTop: 'auto', paddingBottom: '10px' }}>
                <input
                  type="checkbox"
                  id="isMarksEnabled"
                  checked={formData.isMarksEnabled}
                  onChange={(e) =>
                    setFormData({ ...formData, isMarksEnabled: e.target.checked })
                  }
                  style={{ width: 'auto' }}
                />
                <label htmlFor="isMarksEnabled" style={{ margin: 0, cursor: 'pointer' }}>Enable Marks</label>
              </div>
              {formData.isMarksEnabled && (
                <div className="form-group">
                  <label>Maximum Marks *</label>
                  <input
                    type="number"
                    value={formData.maxMarks}
                    onChange={(e) =>
                      setFormData({ ...formData, maxMarks: e.target.value })
                    }
                    min="0"
                    required
                  />
                </div>
              )}
              <div className="form-group">
                <label>Target Year</label>
                {scope ? (
                  <div
                    style={{
                      padding: "10px 12px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      background: "#f8fafc",
                      fontWeight: 700
                    }}
                  >
                    {scope.year} Year
                  </div>
                ) : (
                  <select
                    value={formData.targetYear}
                    onChange={(e) =>
                      setFormData({ ...formData, targetYear: e.target.value })
                    }
                  >
                    {TARGET_YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y === "all" ? "All Years" : `${y} Year`}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="form-group">
                <label>Order (for sorting)</label>
                <input
                  type="number"
                  value={formData.order}
                  onChange={(e) =>
                    setFormData({ ...formData, order: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={2}
                placeholder="Brief description of this review stage"
              />
            </div>
            <div className="form-group">
              <label>Submission Requirements</label>
              <textarea
                value={formData.submissionRequirements}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    submissionRequirements: e.target.value,
                  })
                }
                rows={3}
                placeholder="What documents/files need to be submitted"
              />
            </div>

            <div style={{ display: "flex", gap: "10px" }}>
              <button type="submit" className="btn btn-primary">
                {editingEvent ? "Update" : "Create"} Event
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowForm(false);
                  setEditingEvent(null);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {selectedEvent && (
        <div>
          <button
            className="btn btn-secondary"
            onClick={() => setSelectedEvent(null)}
            style={{ marginBottom: "20px" }}
          >
            ← Back to Timeline
          </button>

          <div
            className="card"
            style={{ marginBottom: "20px", borderLeft: "4px solid #667eea" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
              <div style={{ flex: 1 }}>
                <h2 style={{ margin: "0 0 4px 0" }}>{selectedEvent.title}</h2>
                <p style={{ color: "#666", margin: "0 0 12px 0" }}>{selectedEvent.description}</p>
                <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
                  <span>
                    <strong>📅 Deadline:</strong>{" "}
                    {new Date(selectedEvent.deadline).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <span>
                    <strong>🎯 Max Marks:</strong> {selectedEvent.maxMarks}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Filters & Download */}
          <div className="card" style={{ marginBottom: "20px" }}>
            <div
              className="timeline-filter-header"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) auto",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "14px 20px",
                marginBottom: "15px",
              }}
            >
              <div className="timeline-filter-main" style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0, flexWrap: "wrap" }}>
                <h3 style={{ margin: 0, whiteSpace: "nowrap" }}>🔍 Filters</h3>
                {(() => {
                  const stats = eventStats[selectedEvent._id] || { approved: 0, submitted: 0, notSubmitted: 0 };
                  const submittedTotal = stats.approved + stats.submitted;
                  const total = stats.total || submittedTotal + stats.notSubmitted;
                  const submittedPercent = total ? Math.round((submittedTotal / total) * 100) : 0;
                  const approvedPercent = submittedTotal ? Math.round((stats.approved / submittedTotal) * 100) : 0;
                  return (
                    <div className="timeline-status-summary" style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
                      <div style={{ width: "64px", height: "64px", flex: "0 0 64px", borderRadius: "50%", display: "grid", placeItems: "center", background: `conic-gradient(#0ea5e9 0 ${submittedPercent}%, #fca5a5 ${submittedPercent}% 100%)` }}>
                        <div style={{ width: "46px", height: "46px", borderRadius: "50%", display: "grid", placeItems: "center", background: "#fff", color: "#0f172a", fontSize: "14px", fontWeight: 900 }}>{submittedPercent}%</div>
                      </div>
                      <div style={{ display: "grid", gap: "5px", minWidth: "260px", width: "min(100%, 390px)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", color: "#0369a1", fontSize: "12px", fontWeight: 800 }}><span>Submitted Total</span><span>{submittedTotal} / {total}</span></div>
                        <div style={{ height: "7px", background: "#e2e8f0", borderRadius: "99px", overflow: "hidden" }}><span style={{ display: "block", width: `${submittedPercent}%`, height: "100%", background: "#0ea5e9", borderRadius: "inherit" }} /></div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", color: "#1d4ed8", fontSize: "11px", fontWeight: 700 }}><span>Approved {stats.approved}</span><span>Not Approved {stats.submitted}</span></div>
                        <div style={{ height: "5px", background: "#dcfce7", borderRadius: "99px", overflow: "hidden" }}><span style={{ display: "block", width: `${approvedPercent}%`, height: "100%", background: "#2563eb", borderRadius: "inherit" }} /></div>
                        <div style={{ display: "flex", gap: "10px", color: "#64748b", fontSize: "11px", fontWeight: 700 }}><span><i style={{ display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", background: "#0ea5e9", marginRight: "4px" }} />Submitted</span><span><i style={{ display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", background: "#fca5a5", marginRight: "4px" }} />Not Submitted {stats.notSubmitted}</span></div>
                      </div>
                    </div>
                  );
                })()}
                {/* Submitted / Not Submitted toggle */}
                <div className="timeline-filter-toggle" style={{ display: "flex", width: "fit-content", maxWidth: "100%", overflowX: "auto", background: "#f1f5f9", borderRadius: "8px", padding: "4px", gap: "3px" }}>
                  {[
                    { value: 'all', label: 'All Teams' },
                    { value: 'approved', label: '✅ Submitted and Approved' },
                    { value: 'submitted', label: '📤 Submitted and Not Approved' },
                    { value: 'not_submitted', label: '❌ Not Submitted' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setSubmissionFilter(opt.value)}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "12px",
                        fontWeight: "600",
                        transition: "all 0.15s",
                        background: submissionFilter === opt.value ? "#667eea" : "transparent",
                        color: submissionFilter === opt.value ? "white" : "#64748b",
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="timeline-export-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-success"
                  onClick={() => downloadReportAsExcel()}
                  style={{ minWidth: '170px', height: '38px' }}
                >
                  📥 Download Excel Report
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => downloadReportAsPDF()}
                  style={{ minWidth: '170px', height: '38px', color: '#b91c1c', borderColor: '#fca5a5', background: '#fff1f2' }}
                >
                  📄 Download PDF
                </button>
              </div>
            </div>
            <div
              className="timeline-filter-controls"
              style={{
                display: "flex",
                gap: "20px",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              {scope ? (
                <div className="form-group" style={{ margin: 0 }}>
                  <label>Class</label>
                  <div
                    style={{
                      padding: "10px 14px",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      background: "#eff6ff",
                      color: "#1d4ed8",
                      fontWeight: 800,
                      minWidth: "190px"
                    }}
                  >
                    {scope.year} {scope.branch}-{scope.section}
                  </div>
                </div>
              ) : (
                <>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Year</label>
                    <select
                      value={filterYear}
                      onChange={(e) => setFilterYear(e.target.value)}
                    >
                      <option value="">All Years</option>
                      <option value="2nd">2nd Year</option>
                      <option value="3rd">3rd Year</option>
                      <option value="4th">4th Year</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label>Branch</label>
                    <select
                      value={filterBranch}
                      onChange={(e) => setFilterBranch(e.target.value)}
                    >
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
                    <select
                      value={filterSection}
                      onChange={(e) => setFilterSection(e.target.value)}
                    >
                      <option value="">All Sections</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                      <option value="E">E</option>
                    </select>
                  </div>
                </>
              )}
              <div className="form-group column-dropdown-container" style={{ margin: 0, position: "relative" }}>
                <label>Select Columns</label>
                <div
                  onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #ddd",
                    borderRadius: "4px",
                    cursor: "pointer",
                    background: "white",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    minWidth: "200px"
                  }}
                >
                  <span style={{ fontSize: "13px", color: "#666" }}>
                    {selectedColumns.length} column{selectedColumns.length !== 1 ? 's' : ''} selected
                  </span>
                  <span style={{ fontSize: "12px" }}>{showColumnDropdown ? '▲' : '▼'}</span>
                </div>
                {showColumnDropdown && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      marginTop: "4px",
                      background: "white",
                      border: "1px solid #ddd",
                      borderRadius: "4px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                      zIndex: 1000,
                      minWidth: "200px",
                      maxHeight: "300px",
                      overflowY: "auto"
                    }}
                  >
                    {activeColumns.map((col) => (
                      <label
                        key={col.key}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "8px 12px",
                          cursor: "pointer",
                          fontSize: "13px",
                          borderBottom: "1px solid #f0f0f0",
                          background: selectedColumns.includes(col.key) ? "#f0f7ff" : "white"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "#f8f9fa"}
                        onMouseLeave={(e) => e.currentTarget.style.background = selectedColumns.includes(col.key) ? "#f0f7ff" : "white"}
                      >
                        <span>{col.label}</span>
                        <input
                          type="checkbox"
                          checked={selectedColumns.includes(col.key)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedColumns((prev) => [...prev, col.key]);
                            } else {
                              setSelectedColumns((prev) => prev.filter((k) => k !== col.key));
                            }
                          }}
                          style={{ cursor: "pointer" }}
                        />
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {!scope && (
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setFilterYear("");
                    setFilterBranch("");
                    setFilterSection("");
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {isLoadingMoreSubmissions && submissions.length === 0 && (
            <div className="card" style={{ marginBottom: "20px", textAlign: "center", padding: "40px 20px" }}>
              <div style={{ fontSize: "18px", color: "#667eea", marginBottom: "10px" }}>⏳ Loading submissions...</div>
              <div style={{ fontSize: "13px", color: "#999" }}>This may take a moment if there are many submissions</div>
            </div>
          )}

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Team Members</th>
                  {!scope && <th>Class</th>}
                  <th style={{ width: "100px", maxWidth: "100px" }}>COE/RC</th>
                  {!scope && <th style={{ width: "100px", maxWidth: "100px" }}>Domain</th>}
                  <th style={{ width: "100px", maxWidth: "100px" }}>Guide</th>
                  <th>Guide Marks</th>
                  <th>PRC Marks</th>
                  <th style={{ width: "120px", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis" }}>Guide's Feedback</th>
                  <th style={{ width: "120px", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis" }}>{scope ? "PRC Remarks" : "Coordinator Feedback"}</th>
                  <th style={{ width: "60px" }}>File</th>
                </tr>
              </thead>
              <tbody>
                {submittedPageRows
                  .map((sub) => {
                    const batchId =
                      typeof sub.batchId === "string"
                        ? sub.batchId
                        : sub.batchId?._id;
                    const batch = visibleBatches.find((b) => b._id?.toString() === batchId?.toString());
                    const latestVersion =
                      sub.versions?.[sub.versions.length - 1];
                    const latestAdminRemark =
                      sub.adminRemarks?.length > 0
                        ? sub.adminRemarks[sub.adminRemarks.length - 1]
                        : null;

                    // Debug: Log the batch data to see what we're getting
                    if (batch && batch.teamName) {
                      console.log(`📦 Batch ${batch.teamName}:`, {
                        leaderName: batch.leaderStudentId?.name,
                        leaderRollNumber: batch.leaderStudentId?.rollNumber,
                        leaderStudentIdFull: batch.leaderStudentId,
                        teamMembers: batch.teamMembers,
                      });
                    }

                    // Combine leader and team members
                    const leader = batch?.leaderStudentId;
                    const members = batch?.teamMembers || [];

                    return (
                      <tr key={sub._id}>
                        <td>
                          <strong>{batch?.teamName}</strong>
                          <div style={{ marginTop: '4px' }}>
                            <span style={{ display: 'inline-block', padding: '3px 7px', borderRadius: '5px', background: isGuideApproved(sub) ? '#dbeafe' : '#dcfce7', color: isGuideApproved(sub) ? '#1d4ed8' : '#15803d', fontSize: '10px', fontWeight: 700 }}>
                              {isGuideApproved(sub) ? '✅ Submitted and Approved' : '📤 Submitted and Not Approved'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "5px",
                              minWidth: "132px",
                            }}
                          >
                            {[...members].sort((left, right) => compareNatural(left.rollNo, right.rollNo)).map((m, idx) => (
                              <div
                                key={idx}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  whiteSpace: "nowrap",
                                  fontSize: "11px",
                                  lineHeight: "1.25",
                                  color: "#475569",
                                }}
                              >
                                <span style={{ color: "#94a3b8", fontSize: "10px" }}>•</span>
                                <span>{m.rollNo || m.name || "—"}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        {!scope && (
                          <td>
                            {batch?.year} {batch?.branch}-{batch?.section}
                          </td>
                        )}
                        <td>{batch?.problemId?.coeId?.name || batch?.coeId?.name || batch?.coe?.name || "Not Assigned"}</td>
                        {!scope && <td>{batch?.domain || "Not Assigned"}</td>}
                        <td>
                          {batch?.guideId?.name ? (
                            <span
                              style={{ fontWeight: "500", color: "#2d3748" }}
                            >
                              {batch.guideId.name}
                            </span>
                          ) : (
                            <span
                              style={{ color: "#718096", fontStyle: "italic" }}
                            >
                              Not Assigned
                            </span>
                          )}
                        </td>
                        <td>
                          {(sub.status === 'accepted' || sub.status === 'completed') ? (
                            Array.isArray(sub.studentMarks) && sub.studentMarks.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                {sub.studentMarks.map((sm, idx) => (
                                  <div key={idx} style={{ fontSize: '12px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    <span style={{ color: '#4a5568', fontWeight: '500' }}>
                                      {sm.studentId?.rollNumber || '—'}
                                    </span>
                                    <span style={{ color: sm.marks !== null ? '#22c55e' : '#aaa', fontWeight: '600' }}>
                                      {sm.marks !== null ? `${sm.marks}/${selectedEvent.maxMarks}` : '—'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : sub.marks !== null ? (
                              <span style={{ fontSize: '13px' }}>{`${sub.marks}/${selectedEvent.maxMarks}`}</span>
                            ) : (
                              <span style={{ color: '#aaa', fontSize: '13px' }}>—</span>
                            )
                          ) : (
                            <span style={{ color: '#aaa', fontSize: '13px' }}>—</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            {!isGuideApproved(sub) ? (
                              <span style={{ color: '#aaa', fontSize: '13px' }}>—</span>
                            ) : (
                              <>
                                {Array.isArray(sub.prcStudentMarks) && sub.prcStudentMarks.length > 0 ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                    {sub.prcStudentMarks.map((sm, idx) => (
                                      <div key={idx} style={{ fontSize: '12px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                        <span style={{ color: '#4a5568', fontWeight: '500' }}>
                                          {sm.studentId?.rollNumber || '—'}
                                        </span>
                                        <span style={{ color: sm.marks !== null && sm.marks !== undefined ? '#2563eb' : '#aaa', fontWeight: '600' }}>
                                          {sm.marks !== null && sm.marks !== undefined ? `${sm.marks}/25` : '—'}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : sub.prcMarks !== null && sub.prcMarks !== undefined ? (
                                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#2563eb' }}>{`${sub.prcMarks}/25`}</span>
                                ) : (
                                  <span style={{ color: '#aaa', fontSize: '12px' }}>Not Assigned</span>
                                )}

                                {canEditPrcMarks && (
                                  <button
                                    className="btn btn-secondary"
                                    style={{
                                      fontSize: "11px",
                                      padding: "3px 8px",
                                      marginTop: "4px",
                                      alignSelf: "flex-start",
                                      background: "#eff6ff",
                                      color: "#1d4ed8",
                                      border: "1px solid #bfdbfe"
                                    }}
                                    onClick={() => openPRCMarksModal(sub, batch)}
                                  >
                                    {sub.prcStudentMarks?.length > 0 || (sub.prcMarks !== null && sub.prcMarks !== undefined)
                                      ? "✏️ Edit PRC Marks"
                                      : "+ Add PRC Marks"}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                        <td>
                          <div
                            style={{
                              width: "120px",
                              maxWidth: "120px",
                              minHeight: "60px",
                              display: "flex",
                              alignItems: "center",
                              overflow: "hidden"
                            }}
                          >
                            {sub.comments && sub.comments.length > 0 ? (
                              <div
                                style={{
                                  fontSize: "12px",
                                  cursor: "pointer",
                                  padding: "8px",
                                  background: "#e8f4f8",
                                  borderRadius: "4px",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  width: "100%",
                                  borderLeft: "3px solid #0ea5e9",
                                }}
                                onClick={() =>
                                  setExpandedFeedbackSubmission(sub._id)
                                }
                                title="Click to expand"
                              >
                                <strong>Guide:</strong>{" "}
                                {sub.comments[sub.comments.length - 1].comment.substring(0, 50)}...
                                <br />
                                <small style={{ color: "#666" }}>
                                  {new Date(
                                    sub.comments[sub.comments.length - 1].createdAt
                                  ).toLocaleDateString("en-IN")}
                                </small>
                              </div>
                            ) : (
                              <span style={{ color: "#999", fontSize: "12px" }}>
                                No feedback
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <div
                            style={{
                              width: "120px",
                              maxWidth: "120px",
                              minHeight: "60px",
                              display: "flex",
                              alignItems: "center",
                              overflow: "hidden"
                            }}
                          >
                            {latestAdminRemark ? (
                              <div
                                style={{
                                  fontSize: "12px",
                                  cursor: "pointer",
                                  padding: "8px",
                                  background: "#f0f0f0",
                                  borderRadius: "4px",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  width: "100%",
                                }}
                                onClick={() =>
                                  setExpandedRemarkSubmission(sub._id)
                                }
                                title="Click to expand"
                              >
                                {latestAdminRemark.remark.substring(0, 50)}...
                                <br />
                                <small style={{ color: "#999" }}>
                                  {new Date(
                                    latestAdminRemark.createdAt
                                  ).toLocaleDateString("en-IN")}
                                </small>
                              </div>
                            ) : !isGuideApproved(sub) ? (
                              <span style={{ color: '#aaa', fontSize: '13px', display: 'block', textAlign: 'center', width: '100%' }}>
                                —
                              </span>
                            ) : (
                              canAddRemarks ? (
                                <button
                                  className="btn btn-secondary"
                                  style={{
                                    fontSize: "11px",
                                    padding: "5px 10px",
                                    width: "100%"
                                  }}
                                  onClick={() => {
                                    setSelectedSubmissionForRemark(sub);
                                    setShowRemarkModal(true);
                                  }}
                                >
                                  {scope ? "+ Add PRC Remark" : "+ Add Feedback"}
                                </button>
                              ) : (
                                <span style={{ color: '#999', fontSize: '12px', display: 'block', textAlign: 'center' }}>
                                  View only
                                </span>
                              )
                            )}
                          </div>
                        </td>
                        <td>
                          {sub.versions && sub.versions.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                              <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                {sub.versions[sub.versions.length - 1]?.driveLink && (
                                  <a
                                    href={sub.versions[sub.versions.length - 1].driveLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={`Click to open Google Drive file (Version ${sub.versions.length})`}
                                    style={{ fontSize: '18px', cursor: 'pointer' }}
                                  >
                                    📁
                                  </a>
                                )}
                                {sub.versions[sub.versions.length - 1]?.fileUrl && (
                                  <a
                                    href={sub.versions[sub.versions.length - 1].fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Click to open uploaded file"
                                    style={{ fontSize: '18px', cursor: 'pointer' }}
                                  >
                                    📥
                                  </a>
                                )}
                              </div>
                              {sub.versions[sub.versions.length - 1]?.submittedByName ? (
                                <small style={{ fontSize: '10px', color: '#475569', textAlign: 'center', lineHeight: '1.2' }}>
                                  {sub.versions.length > 1 ? 'Updated by' : 'By'}:<br />
                                  <strong style={{ color: '#1e293b' }}>{sub.versions[sub.versions.length - 1].submittedByName}</strong>
                                </small>
                              ) : (
                                <small style={{ fontSize: '10px', color: '#94a3b8' }}>v{sub.versions.length}</small>
                              )}
                            </div>
                          ) : (
                            <span style={{ color: '#999', fontSize: '12px' }}>-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                {/* Not Submitted rows — batches with no accepted submission for this event */}
                {(submissionFilter === 'all' || submissionFilter === 'not_submitted') && (() => {
                  // Teams without an uploaded version are not submitted.
                  const submittedBatchIds = new Set(
                    submissions
                      .filter(sub => {
                        const subEventId = typeof sub.timelineEventId === "string" ? sub.timelineEventId : sub.timelineEventId?._id;
                        return (
                          subEventId === selectedEvent._id &&
                          hasUploadedVersion(sub)
                        );
                      })
                      .map(sub => {
                        const bId = typeof sub.batchId === "string" ? sub.batchId : sub.batchId?._id;
                        return bId ? bId.toString() : null;
                      })
                      .filter(Boolean)
                  );

                  return notSubmittedBatches
                    .slice(notSubmittedPageStart, notSubmittedPageEnd)
                    .map(batch => (
                      <tr key={`ns-${batch._id}`} style={{ background: '#fff8f8', opacity: 0.85 }}>
                        <td>
                          <strong>{batch.teamName}</strong>
                          <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '2px', fontWeight: '600' }}>❌ Not Submitted</div>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            {[...(batch.teamMembers || [])].sort((left, right) => compareNatural(left.rollNo, right.rollNo)).map((m, idx) => (
                              <div key={idx} style={{ fontSize: "12px", color: "#4a5568", paddingLeft: "18px" }}>
                                • {m.rollNo}
                              </div>
                            ))}
                          </div>
                        </td>
                        {!scope && <td>{batch.year} {batch.branch}-{batch.section}</td>}
                        <td>{batch?.coe?.name || batch?.coeId?.name || '—'}</td>
                        {!scope && <td>{batch?.domain || '—'}</td>}
                        <td>
                          {batch?.guideId?.name ? (
                            <span style={{ fontWeight: "500", color: "#2d3748" }}>{batch.guideId.name}</span>
                          ) : <span style={{ color: "#718096", fontStyle: "italic" }}>Not Assigned</span>}
                        </td>
                        <td><span style={{ color: '#aaa', fontSize: '13px' }}>—</span></td>
                        <td><span style={{ color: '#aaa', fontSize: '13px' }}>—</span></td>
                        <td><span style={{ color: '#aaa', fontSize: '12px' }}>—</span></td>
                        <td><span style={{ color: '#aaa', fontSize: '12px' }}>—</span></td>
                        <td><span style={{ color: '#aaa', fontSize: '12px' }}>—</span></td>
                      </tr>
                    ));
                })()}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {displayPages > 1 && (
            <div style={{
              marginTop: "20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px"
            }}>
              <div style={{ fontSize: "14px", color: "#666" }}>
                Showing {((submissionPagination.current - 1) * submissionPagination.limit) + 1} - {Math.min(submissionPagination.current * submissionPagination.limit, submissionPagination.total)} of {submissionPagination.total} submissions
                | Page {submissionPagination.current} of {submissionPagination.pages}
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => setSubmissionPagination((current) => ({ ...current, current: current.current - 1 }))}
                  disabled={submissionPagination.current <= 1}
                  style={{ padding: "4px 10px", fontSize: "12px" }}
                >
                  &lt; Prev
                </button>
                {Array.from({ length: displayPages }, (_, i) => i + 1).map((pageNum) => (
                  <button
                    key={pageNum}
                    className={`btn ${pageNum === submissionPagination.current ? "btn-primary" : "btn-secondary"}`}
                    onClick={() => setSubmissionPagination((current) => ({ ...current, current: pageNum }))}
                    disabled={isLoadingMoreSubmissions}
                    style={{ padding: "4px 10px", fontSize: "12px", minWidth: "32px" }}
                  >
                    {pageNum}
                  </button>
                ))}
                <button
                  className="btn btn-secondary"
                  onClick={() => setSubmissionPagination((current) => ({ ...current, current: current.current + 1 }))}
                  disabled={submissionPagination.current >= displayPages}
                  style={{ padding: "4px 10px", fontSize: "12px" }}
                >
                  Next &gt;
                </button>
              </div>
            </div>
          )}
        </div >
      )
      }

      {
        !selectedEvent && events.length === 0 ? (
          <div className="card empty-state">
            <h3>❌ No Timeline Events</h3>
            <p>Create timeline events for Abstract Review, PRC-1, PRC-2, etc.</p>
          </div>
        ) : !selectedEvent ? (
          <div className="timeline-container">
            {visibleEvents.map((event, idx) => (
              <div
                key={event._id}
                className="card timeline-event"
                style={{ borderLeft: "4px solid #667eea", marginBottom: "15px" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "start",
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "18px",
                        marginBottom: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          background: "#667eea",
                          color: "white",
                          borderRadius: "50%",
                          width: "36px",
                          height: "36px",
                          minWidth: "36px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: "bold",
                          fontSize: "16px",
                          flexShrink: 0,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <div style={{ flex: 1, minWidth: '350px' }}>
                        <h3 style={{ margin: '0 0 4px 0', wordBreak: 'break-word', lineHeight: '1.4', fontSize: '17px', fontWeight: '700' }}>{event.title}</h3>
                        <div className="title-badges" style={{ marginBottom: '4px' }}>
                          {getStatusBadge(event.deadline)}
                        </div>
                        <p style={{ color: "#666", margin: "0", lineHeight: '1.5', fontSize: '13px' }}>
                          {event.description}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "5px", flexShrink: 0 }}>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => setSelectedEvent(event)}
                    >
                      👥 View Teams
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleEdit(event)}
                    >
                      ✏️
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(event._id)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: "12px",
                    marginTop: "12px",
                    padding: "12px",
                    background: "#f8fafc",
                    borderRadius: "8px",
                    lineHeight: '1.5',
                  }}
                >
                  <div>
                    <strong style={{ fontSize: '13px', display: 'block', marginBottom: '3px' }}>📅 Deadline:</strong>
                    <span style={{ fontSize: '13px', lineHeight: '1.5', color: '#4a5568' }}>
                      {new Date(event.deadline).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                  <div>
                    <strong style={{ fontSize: '13px', display: 'block', marginBottom: '3px' }}>🎯 Max Marks:</strong>
                    <span style={{ fontSize: '13px', lineHeight: '1.5', color: '#4a5568' }}>{event.maxMarks}</span>
                  </div>
                  <div>
                    <strong style={{ fontSize: '13px', display: 'block', marginBottom: '3px' }}>📋 Requirements:</strong>
                    <span style={{ fontSize: "12px", color: "#4a5568", lineHeight: '1.5' }}>
                      {event.submissionRequirements || "Not specified"}
                    </span>
                  </div>
                  <div>
                    <strong style={{ fontSize: '13px', display: 'block', marginBottom: '3px' }}>📊 Submissions Status:</strong>
                    {(() => {
                      const stats = eventStats[event._id];
                      if (!stats) return <span style={{ fontSize: "12px", color: "#94a3b8" }}>Loading stats...</span>;
                      const notSub = stats.notSubmitted;
                      return (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: '#16a34a', background: '#dcfce7', padding: '2px 8px', borderRadius: '12px' }}>
                            {stats.approved + stats.submitted} Submitted Total
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: '#dc2626', background: '#fee2e2', padding: '2px 8px', borderRadius: '12px' }}>
                            {notSub} Pending
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null
      }

      {/* Expanded Guide Feedback Modal */}
      {
        expandedFeedbackSubmission && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1001,
            }}
            onClick={() => setExpandedFeedbackSubmission(null)}
          >
            <div
              className="card"
              style={{
                width: "90%",
                maxWidth: "600px",
                maxHeight: "80vh",
                overflow: "auto",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "20px",
                }}
              >
                <h3>💬 Guide's Feedback</h3>
                <button
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "24px",
                    cursor: "pointer",
                    color: "#999",
                  }}
                  onClick={() => setExpandedFeedbackSubmission(null)}
                >
                  ×
                </button>
              </div>
              {(() => {
                const submission = submissions.find(
                  (s) => s._id === expandedFeedbackSubmission
                );
                if (!submission?.comments?.length) return null;

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {submission.comments.map((c, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: "#e8f4f8",
                          padding: "12px",
                          borderRadius: "8px",
                          borderLeft: "3px solid #0ea5e9",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: "8px",
                          }}
                        >
                          <strong style={{ color: "#0c4a6e" }}>
                            {c.guideId?.name || "Guide"}
                          </strong>
                          <small style={{ color: "#64748b" }}>
                            {new Date(c.createdAt).toLocaleDateString("en-IN", {
                              weekday: "short",
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </small>
                        </div>
                        <p
                          style={{
                            margin: 0,
                            color: "#0c4a6e",
                            fontSize: "14px",
                            lineHeight: "1.6",
                            whiteSpace: "pre-wrap",
                            wordWrap: "break-word",
                          }}
                        >
                          {c.comment}
                        </p>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <button
                className="btn btn-secondary"
                onClick={() => setExpandedFeedbackSubmission(null)}
                style={{ width: "100%", marginTop: "20px" }}
              >
                Close
              </button>
            </div>
          </div>
        )
      }

      {/* Expanded Remark Modal */}
      {
        expandedRemarkSubmission && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1001,
            }}
          >
            <div
              className="card"
              style={{
                width: "90%",
                maxWidth: "600px",
                maxHeight: "80vh",
                overflow: "auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "20px",
                }}
              >
                <h3>📝 Full Feedback</h3>
                <button
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: "24px",
                    cursor: "pointer",
                    color: "#999",
                  }}
                  onClick={() => setExpandedRemarkSubmission(null)}
                >
                  ×
                </button>
              </div>
              {(() => {
                const submission = submissions.find(
                  (s) => s._id === expandedRemarkSubmission
                );
                const remarks = submission?.adminRemarks || [];

                return (
                  <div style={{ maxHeight: "400px", overflowY: "auto", marginBottom: "20px", paddingRight: "5px" }}>
                    {remarks.length > 0 ? (
                      remarks.map((r, idx) => (
                        <div
                          key={idx}
                          style={{
                            background: "#f8f9fa",
                            padding: "15px",
                            borderRadius: "8px",
                            marginBottom: "12px",
                            borderLeft: "4px solid #667eea",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "12px",
                              color: "#667eea",
                              fontWeight: "bold",
                              marginBottom: "8px",
                              display: "flex",
                              justifyContent: "space-between"
                            }}
                          >
                            <span>📅 {new Date(r.createdAt).toLocaleDateString("en-IN", {
                              weekday: "short",
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}</span>
                            {r.adminId?.name && <span>👤 {r.adminId.name}</span>}
                          </div>
                          <p
                            style={{
                              color: "#2d3748",
                              fontSize: "14px",
                              lineHeight: "1.6",
                              whiteSpace: "pre-wrap",
                              wordWrap: "break-word",
                              margin: 0
                            }}
                          >
                            {r.remark}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p style={{ textAlign: "center", color: "#999", padding: "20px" }}>No remarks found for this submission.</p>
                    )}
                  </div>
                );
              })()}
              <div style={{ display: "flex", gap: "10px" }}>
                {canAddRemarks && (!scope || isGuideApproved(submissions.find(s => s._id === expandedRemarkSubmission))) && (
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      const sub = submissions.find(s => s._id === expandedRemarkSubmission);
                      if (sub) {
                        setSelectedSubmissionForRemark(sub);
                        setShowRemarkModal(true);
                        setExpandedRemarkSubmission(null);
                      }
                    }}
                    style={{ flex: 1 }}
                  >
                    + Add Another Remark
                  </button>
                )}
                <button
                  className="btn btn-secondary"
                  onClick={() => setExpandedRemarkSubmission(null)}
                  style={{ flex: 1 }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* PRC Marks Modal */}
      {showPRCMarksModal && selectedSubmissionForPRC && selectedBatchForPRC && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div className="card" style={{ width: "90%", maxWidth: "520px", maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ marginBottom: "6px" }}>Assign PRC Marks (out of 25)</h3>
            <p style={{ color: "#64748b", fontSize: "13px", marginTop: 0, marginBottom: "14px" }}>
              Enter individual marks out of 25 for each student in this team.
            </p>

            <div
              style={{
                marginBottom: "16px",
                padding: "10px 14px",
                background: "#f1f5f9",
                borderRadius: "6px",
                fontSize: "13px",
              }}
            >
              <strong>Team:</strong> {selectedBatchForPRC.teamName} &nbsp;|&nbsp; <strong>Class:</strong> {selectedBatchForPRC.year} {selectedBatchForPRC.branch}-{selectedBatchForPRC.section}
            </div>

            {prcError && (
              <div style={{ padding: "8px 12px", background: "#fee2e2", color: "#b91c1c", borderRadius: "5px", marginBottom: "14px", fontSize: "13px" }}>
                {prcError}
              </div>
            )}

            {loadingPRCStudents ? (
              <div style={{ textAlign: "center", padding: "20px", color: "#666" }}>Loading student details...</div>
            ) : prcBatchStudents.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px", color: "#999" }}>No students found for this batch.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
                {[...prcBatchStudents].sort((left, right) => compareNatural(left.rollNumber || left.rollNo, right.rollNumber || right.rollNo)).map((student) => (
                  <div
                    key={student._id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 12px",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "6px",
                      gap: "10px",
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: "600", fontSize: "13px", color: "#1e293b" }}>
                        {student.name}
                      </div>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>
                        Roll No: {student.rollNumber || student.rollNo || "N/A"}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <input
                        type="number"
                        min="0"
                        max="25"
                        step="any"
                        placeholder="Marks"
                        value={prcStudentMarkInputs[student._id] ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setPrcStudentMarkInputs((prev) => ({
                            ...prev,
                            [student._id]: val,
                          }));
                        }}
                        style={{
                          width: "90px",
                          padding: "6px 10px",
                          borderRadius: "4px",
                          border: "1px solid #cbd5e1",
                          fontSize: "13px",
                          textAlign: "right",
                        }}
                      />
                      <span style={{ fontSize: "13px", color: "#64748b", fontWeight: "500" }}>/ 25</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                className="btn btn-primary"
                onClick={handleSavePRCMarks}
                disabled={savingPRCMarks || loadingPRCStudents}
                style={{ flex: 1 }}
              >
                {savingPRCMarks ? "Saving..." : "Save PRC Marks"}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowPRCMarksModal(false);
                  setSelectedSubmissionForPRC(null);
                  setSelectedBatchForPRC(null);
                  setPrcError("");
                }}
                disabled={savingPRCMarks}
                style={{ flex: 1 }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin / PRC Remark Modal */}
      {
        showRemarkModal && selectedSubmissionForRemark && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
          >
            <div className="card" style={{ width: "90%", maxWidth: "500px" }}>
              <h3>{scope ? "Add PRC Remark" : "Add Coordinator Feedback"}</h3>
              <div
                style={{
                  marginBottom: "15px",
                  padding: "10px",
                  background: "#f0f0f0",
                  borderRadius: "5px",
                }}
              >
                <strong>Team:</strong>{" "}
                {
                  batches.find(
                    (b) =>
                      b._id ===
                      (typeof selectedSubmissionForRemark.batchId === "string"
                        ? selectedSubmissionForRemark.batchId
                        : selectedSubmissionForRemark.batchId?._id)
                  )?.teamName
                }
              </div>
              <textarea
                value={remarkText}
                onChange={(e) => setRemarkText(e.target.value)}
                placeholder="Enter your feedback here..."
                rows={5}
                style={{
                  width: "100%",
                  padding: "10px",
                  marginBottom: "15px",
                  borderRadius: "5px",
                  border: "1px solid #ddd",
                }}
              />
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    try {
                      if (!remarkText.trim()) {
                        alert("Please enter feedback");
                        return;
                      }
                      if (scope && !isGuideApproved(selectedSubmissionForRemark)) {
                        alert("PRC remarks can only be given for accepted batches.");
                        return;
                      }
                      await api.addAdminRemark(
                        selectedSubmissionForRemark._id,
                        remarkText
                      );
                      setRemarkText("");
                      setShowRemarkModal(false);
                      setSelectedSubmissionForRemark(null);
                      fetchEvents();
                    } catch (error) {
                      console.error("Error adding remark:", error);
                    }
                  }}
                >
                  {scope ? "Save PRC Remark" : "Save Feedback"}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setRemarkText("");
                    setShowRemarkModal(false);
                    setSelectedSubmissionForRemark(null);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );

  async function downloadReportAsPDF() {
    if (!selectedEvent) {
      alert("No event selected to download report.");
      return;
    }

    try {
      const res = await api.getAllSubmissions({ eventId: selectedEvent._id, limit: 1000, status: 'all' });
      const eventSubmissions = res.data?.data || res.data || [];
      const reportBatches = visibleBatches.filter(batch => (
        (!filterYear || batch.year === filterYear) &&
        (!filterBranch || batch.branch === filterBranch) &&
        (!filterSection || batch.section === filterSection)
      ));
      const rows = reportBatches.map(batch => {
        const batchSubmissions = eventSubmissions.filter(sub => {
          const subEventId = typeof sub.timelineEventId === 'string' ? sub.timelineEventId : sub.timelineEventId?._id;
          const subBatchId = typeof sub.batchId === 'string' ? sub.batchId : sub.batchId?._id;
          return subEventId === selectedEvent._id && String(subBatchId) === String(batch._id) && hasUploadedVersion(sub);
        });
        const status = batchSubmissions.some(isGuideApproved)
          ? 'Guide Approved'
          : batchSubmissions.length > 0 ? 'Submitted and Not Approved' : 'Not Submitted';
        return [
          batch.teamName || '—',
          `${batch.year || ''} ${batch.branch || ''}-${batch.section || ''}`,
          batch.guideId?.name || 'Not Assigned',
          status
        ];
      }).sort((left, right) => compareNatural(left[0], right[0]));

      const sectionSummary = new Map();
      reportBatches.forEach(batch => {
        const batchSubmissions = eventSubmissions.filter(sub => {
          const subEventId = typeof sub.timelineEventId === 'string' ? sub.timelineEventId : sub.timelineEventId?._id;
          const subBatchId = typeof sub.batchId === 'string' ? sub.batchId : sub.batchId?._id;
          return subEventId === selectedEvent._id && String(subBatchId) === String(batch._id) && hasUploadedVersion(sub);
        });
        const section = batch.section || 'Unknown';
        if (!sectionSummary.has(section)) sectionSummary.set(section, { total: 0, approved: 0, submitted: 0, notSubmitted: 0 });
        const summary = sectionSummary.get(section);
        summary.total += 1;
        if (batchSubmissions.some(isGuideApproved)) summary.approved += 1;
        else if (batchSubmissions.length > 0) summary.submitted += 1;
        else summary.notSubmitted += 1;
      });

      const doc = new jsPDF({ orientation: 'landscape' });
      doc.setFontSize(16);
      doc.text(`${selectedEvent.title} - Batch Status Report`, 14, 16);
      doc.setFontSize(10);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 14, 23);
      let summaryY = 30;
      Array.from(sectionSummary.entries())
        .sort((left, right) => compareNatural(left[0], right[0]))
        .forEach(([section, summary]) => {
          doc.text(`${section} section (${summary.total} total): Submitted Total ${summary.approved + summary.submitted} | Approved ${summary.approved} | Not Approved ${summary.submitted} | Not Submitted ${summary.notSubmitted}`, 14, summaryY);
          summaryY += 6;
        });
      doc.autoTable({
        startY: summaryY + 2,
        head: [['Team', 'Class', 'Guide', 'Status']],
        body: rows,
        headStyles: { fillColor: [30, 64, 175] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        styles: { fontSize: 9, cellPadding: 4 }
      });
      doc.save(`${selectedEvent.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_Status_Report.pdf`);
    } catch (err) {
      console.error('Failed to export PDF report:', err);
      alert(`Failed to export PDF report: ${err.message}`);
    }
  }

  // Download report as Excel with merged cells for batch details
  async function downloadReportAsExcel() {
    if (!selectedEvent) {
      alert("No event selected to download report.");
      return;
    }

    try {
      // Fetch ALL submissions for current event so report is complete across all pages
      const res = await api.getAllSubmissions({ eventId: selectedEvent._id, limit: 1000, status: 'all' });
      const eventSubmissions = res.data?.data || res.data || [];

      // Filter submissions matching event
      const filteredSubs = eventSubmissions.filter(sub => {
        const subEventId = typeof sub.timelineEventId === "string" ? sub.timelineEventId : sub.timelineEventId?._id;
        if (subEventId !== selectedEvent._id || !hasUploadedVersion(sub)) return false;
        if (submissionFilter === 'approved' && !isGuideApproved(sub)) return false;
        if (submissionFilter === 'submitted' && isGuideApproved(sub)) return false;
        if (submissionFilter === 'not_submitted') return false;
        const batchId = typeof sub.batchId === "string" ? sub.batchId : sub.batchId?._id;
        const batch = visibleBatches.find((item) => item._id?.toString() === batchId?.toString());
        return batch &&
          (!filterYear || batch.year === filterYear) &&
          (!filterBranch || batch.branch === filterBranch) &&
          (!filterSection || batch.section === filterSection);
      }).sort((left, right) => {
        const leftId = typeof left.batchId === "string" ? left.batchId : left.batchId?._id;
        const rightId = typeof right.batchId === "string" ? right.batchId : right.batchId?._id;
        const leftBatch = visibleBatches.find(batch => String(batch._id) === String(leftId));
        const rightBatch = visibleBatches.find(batch => String(batch._id) === String(rightId));
        return compareNatural(leftBatch?.teamName, rightBatch?.teamName);
      });

      if (filteredSubs.length === 0 && visibleBatches.length === 0) {
        alert("No data available to download");
        return;
      }

      // Map active selected columns
      const activeCols = activeColumns.filter(col => selectedColumns.includes(col.key));
      const headers = activeCols.map(c => c.label);

      const aoaData = [headers];
      const merges = [];
      let currentRowIdx = 1; // 0 is header row

      // Process submitted batches
      filteredSubs.forEach((sub) => {
        const batchId = typeof sub.batchId === "string" ? sub.batchId : sub.batchId?._id;
        const batch = visibleBatches.find((b) => b._id?.toString() === batchId?.toString()) || batches.find(b => b._id === batchId);

        if (batch) {
          if (filterYear && batch.year !== filterYear) return;
          if (filterBranch && batch.branch !== filterBranch) return;
          if (filterSection && batch.section !== filterSection) return;
        }

        const adminRemarksText = sub.adminRemarks?.length > 0
          ? sub.adminRemarks.map(r => r.remark).join("; ")
          : "N/A";
        const guideFeedbackText = sub.comments?.length > 0
          ? sub.comments.map(c => c.comment).join("; ")
          : "N/A";
        const coe = batch?.problemId?.coeId?.name || batch?.coeId?.name || batch?.coe?.name || "N/A";
        const guide = batch?.guideId?.name || "Not Assigned";

        // Collect students for this batch
        const studentList = [];
        if (batch?.leaderStudentId && typeof batch.leaderStudentId === 'object') {
          studentList.push({
            _id: String(batch.leaderStudentId._id || ''),
            rollNo: batch.leaderStudentId.rollNumber || batch.leaderStudentId.rollNo || '',
            name: batch.leaderStudentId.name || ''
          });
        }
        (batch?.teamMembers || []).forEach((m) => {
          const roll = m.rollNo || m.rollNumber || '';
          if (!studentList.some((existing) => (existing._id && existing._id === String(m._id)) || (roll && existing.rollNo === roll))) {
            studentList.push({
              _id: String(m._id || ''),
              rollNo: roll,
              name: m.name || ''
            });
          }
        });
        (sub.studentMarks || []).forEach((sm) => {
          const s = sm.studentId;
          if (s && typeof s === 'object') {
            const roll = s.rollNumber || s.rollNo || '';
            if (!studentList.some((existing) => (existing._id && existing._id === String(s._id)) || (roll && existing.rollNo === roll))) {
              studentList.push({
                _id: String(s._id || ''),
                rollNo: roll,
                name: s.name || ''
              });
            }
          }
        });
        (sub.prcStudentMarks || []).forEach((sm) => {
          const s = sm.studentId;
          if (s && typeof s === 'object') {
            const roll = s.rollNumber || s.rollNo || '';
            if (!studentList.some((existing) => (existing._id && existing._id === String(s._id)) || (roll && existing.rollNo === roll))) {
              studentList.push({
                _id: String(s._id || ''),
                rollNo: roll,
                name: s.name || ''
              });
            }
          }
        });

        if (studentList.length === 0) {
          studentList.push({ _id: '', rollNo: 'N/A', name: 'N/A' });
        }

        studentList.sort((left, right) => compareNatural(left.rollNo, right.rollNo));

        const startRowForBatch = currentRowIdx;
        const numMembers = studentList.length;

        studentList.forEach((m) => {
          let guideMark = "N/A";
          if (sub.status === 'accepted' || sub.status === 'completed') {
            if (Array.isArray(sub.studentMarks) && sub.studentMarks.length > 0) {
              const sm = sub.studentMarks.find((entry) => {
                const sid = typeof entry.studentId === 'object' ? entry.studentId?._id : entry.studentId;
                const sroll = typeof entry.studentId === 'object' ? entry.studentId?.rollNumber : null;
                return (sid && String(sid) === String(m._id)) || (sroll && sroll === m.rollNo);
              });
              if (sm && sm.marks !== null && sm.marks !== undefined && sm.marks !== '') {
                guideMark = Number(sm.marks);
              }
            } else if (sub.marks !== null && sub.marks !== undefined && sub.marks !== '') {
              guideMark = Number(sub.marks);
            }
          }

          let prcMark = "N/A";
          if (Array.isArray(sub.prcStudentMarks) && sub.prcStudentMarks.length > 0) {
            const pm = sub.prcStudentMarks.find((entry) => {
              const sid = typeof entry.studentId === 'object' ? entry.studentId?._id : entry.studentId;
              const sroll = typeof entry.studentId === 'object' ? entry.studentId?.rollNumber : null;
              return (sid && String(sid) === String(m._id)) || (sroll && sroll === m.rollNo);
            });
            if (pm && pm.marks !== null && pm.marks !== undefined && pm.marks !== '') {
              prcMark = Number(pm.marks);
            }
          } else if (sub.prcMarks !== null && sub.prcMarks !== undefined && sub.prcMarks !== '') {
            prcMark = Number(sub.prcMarks);
          }

          const memberDisplay = m.name && m.rollNo && m.name !== m.rollNo
            ? `${m.name} (${m.rollNo})`
            : m.rollNo || m.name || "N/A";

          const rowMap = {
            teamName: batch?.teamName || "Unknown",
            teamMembers: memberDisplay,
            year: batch?.year || "N/A",
            branch: batch?.branch || "N/A",
            section: batch?.section || "N/A",
            coe: coe,
            domain: batch?.domain || "N/A",
            guide: guide,
            marks: guideMark,
            prcMarks: prcMark,
            guidesFeedback: formatExcelComment(guideFeedbackText),
            adminRemarks: formatExcelComment(adminRemarksText),
          };

          const rowValues = activeCols.map((c) => rowMap[c.key]);
          aoaData.push(rowValues);
          currentRowIdx++;
        });

        // Add merges for batch-level columns across member rows if numMembers > 1
        if (numMembers > 1) {
          const endRowForBatch = startRowForBatch + numMembers - 1;
          activeCols.forEach((col, colIdx) => {
            if (['teamName', 'year', 'branch', 'section', 'coe', 'domain', 'guide', 'guidesFeedback', 'adminRemarks'].includes(col.key)) {
              merges.push({
                s: { r: startRowForBatch, c: colIdx },
                e: { r: endRowForBatch, c: colIdx }
              });
            }
          });
        }
      });

      // Also process Not Submitted batches if shown
      if (submissionFilter === 'all' || submissionFilter === 'not_submitted') {
        const submittedBatchIds = new Set(
          filteredSubs.filter(sub => hasUploadedVersion(sub)).map(sub => {
            const bId = typeof sub.batchId === "string" ? sub.batchId : sub.batchId?._id;
            return bId ? bId.toString() : null;
          }).filter(Boolean)
        );

        const notSubmittedBatches = visibleBatches.filter(batch => {
          if (submittedBatchIds.has(batch._id?.toString())) return false;
          if (filterYear && batch.year !== filterYear) return false;
          if (filterBranch && batch.branch !== filterBranch) return false;
          if (filterSection && batch.section !== filterSection) return false;
          return true;
        });

        notSubmittedBatches.sort((left, right) => compareNatural(left.teamName, right.teamName)).forEach(batch => {
          const members = batch.teamMembers || [];
          const studentList = members.length > 0
            ? members
              .map(m => m.rollNo || m.name)
              .sort((left, right) => compareNatural(left, right))
            : ['N/A'];
          const startRowForBatch = currentRowIdx;
          const numMembers = studentList.length;

          studentList.forEach(mDisplay => {
            const rowMap = {
              teamName: batch.teamName,
              teamMembers: mDisplay,
              year: batch.year,
              branch: batch.branch,
              section: batch.section,
              coe: batch?.coe?.name || batch?.coeId?.name || "N/A",
              domain: batch.domain || "N/A",
              guide: batch.guideId?.name || "Not Assigned",
              marks: "Not Submitted",
              prcMarks: "Not Submitted",
              guidesFeedback: "N/A",
              adminRemarks: "N/A",
            };
            const rowValues = activeCols.map((c) => rowMap[c.key]);
            aoaData.push(rowValues);
            currentRowIdx++;
          });

          if (numMembers > 1) {
            const endRowForBatch = startRowForBatch + numMembers - 1;
            activeCols.forEach((col, colIdx) => {
              if (['teamName', 'year', 'branch', 'section', 'coe', 'domain', 'guide', 'guidesFeedback', 'adminRemarks'].includes(col.key)) {
                merges.push({
                  s: { r: startRowForBatch, c: colIdx },
                  e: { r: endRowForBatch, c: colIdx }
                });
              }
            });
          }
        });
      }

      // Create SheetJS Worksheet
      const worksheet = XLSX.utils.aoa_to_sheet(aoaData);
      worksheet['!merges'] = merges;
      worksheet['!rows'] = [
        { hpt: 24 },
        ...aoaData.slice(1).map(() => ({ hpt: 42 }))
      ];
      Object.keys(worksheet).forEach((cellAddress) => {
        if (cellAddress.startsWith('!')) return;
        worksheet[cellAddress].s = {
          alignment: { vertical: 'top', wrapText: true }
        };
      });

      // Set nice column widths
      worksheet['!cols'] = activeCols.map(col => {
        if (col.key === 'teamName') return { wch: 20 };
        if (col.key === 'teamMembers') return { wch: 25 };
        if (col.key === 'guide' || col.key === 'coe' || col.key === 'domain') return { wch: 22 };
        if (col.key === 'guidesFeedback' || col.key === 'adminRemarks') return { wch: 65 };
        return { wch: 14 };
      });

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Event Submissions');

      const fileName = `${selectedEvent.title.replace(/[^a-zA-Z0-9_-]/g, "_")}_Report_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
    } catch (err) {
      console.error("Failed to export Excel report:", err);
      alert("Failed to export Excel report: " + err.message);
    }
  }
}

function TimelineManagement({ readOnly = false, scope = null, allowRemarkEditing = true }) {
  return readOnly ? <TimelineReadOnly scope={scope} /> : <TimelineEditor scope={scope} allowRemarkEditing={allowRemarkEditing} />;
}

export default TimelineManagement;
