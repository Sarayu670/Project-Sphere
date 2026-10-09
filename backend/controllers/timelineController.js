const TimelineEvent = require('../models/TimelineEvent');
const Submission = require('../models/Submission');
const Batch = require('../models/Batch');
const Guide = require('../models/Guide');
const Student = require('../models/Student');
const ProjectEntry = require('../models/ProjectEntry');
const { sendTimelineNotificationEmail } = require('../utils/mailer');
const { buildTimelineVisibilityFilter } = require('../utils/timelineVisibility');

const VALID_DEPARTMENTS = ['ALL', 'CSE', 'IT', 'ECE', 'CSM', 'EEE', 'CSD', 'ETM'];

// ================= CREATE EVENT =================
exports.createEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      deadline,
      maxMarks,
      submissionRequirements,
      targetYear,
      order,
      isMandatoryFormat,
      isMarksEnabled
    } = req.body;

    const parseBool = (val) => {
      if (val === undefined || val === null) return true;
      if (typeof val === 'boolean') return val;
      return val === 'true' || val === '1' || val === 'on';
    };

    let referenceFileData = null;
    if (req.file) {
      referenceFileData = {
        url: `/uploads/reference/${req.file.filename}`,
        name: req.file.originalname
      };
    }


    // Branch lock removed: admins choose the target branch explicitly.
    const requestedDept = String(req.body.department || 'ALL').trim().toUpperCase();
    const targetDept = VALID_DEPARTMENTS.includes(requestedDept) ? requestedDept : 'ALL';
    const targetYr = targetYear || 'all';

    const event = await TimelineEvent.create({
      title,
      description,
      deadline,
      maxMarks: parseBool(isMarksEnabled) ? Number(maxMarks) : 0,
      submissionRequirements,
      targetYear: targetYr,
      order: Number(order) || 0,
      isMandatoryFormat: parseBool(isMandatoryFormat),
      isMarksEnabled: parseBool(isMarksEnabled),
      referenceFile: referenceFileData,
      createdBy: req.user._id,
      department: targetDept
    });


    console.log(`[Timeline] Event created: "${event.title}", Year: ${targetYr}, Dept: ${targetDept}`);

    // ================= TARGETED EMAIL NOTIFICATION =================
    // Only send to respective students and guides of the targeted year and branch
    try {
      console.log(`[Timeline] Finding targeted recipients: Year=${targetYr}, Dept=${targetDept}`);

      // 1. Filter Students by target year and branch/department
      const studentFilter = {};
      if (targetYr !== 'all') {
        studentFilter.year = targetYr;
      }
      if (targetDept !== 'ALL') {
        studentFilter.branch = targetDept;
      }
      const students = await Student.find(studentFilter).select('name email branch year').lean();

      // 2. Filter Guides: find batches for this year & branch to get their allocated guides
      const batchFilter = {};
      if (targetYr !== 'all') batchFilter.year = targetYr;
      if (targetDept !== 'ALL') batchFilter.branch = targetDept;
      
      const batches = await Batch.find(batchFilter).populate('guideId', 'name email department').lean();
      
      const guideEmailMap = new Map();
      batches.forEach(b => {
        if (b.guideId && b.guideId.email) {
          guideEmailMap.set(b.guideId.email.toLowerCase().trim(), b.guideId.name);
        }
      });

      // Also include department guides if department is specific (e.g. CSE)
      if (targetDept !== 'ALL') {
        const deptGuides = await Guide.find({ department: targetDept }).select('name email').lean();
        deptGuides.forEach(g => {
          if (g.email) guideEmailMap.set(g.email.toLowerCase().trim(), g.name);
        });
      } else if (targetYr === 'all' && targetDept === 'ALL') {
        // Institution-wide: include all guides
        const allGuides = await Guide.find({}).select('name email').lean();
        allGuides.forEach(g => {
          if (g.email) guideEmailMap.set(g.email.toLowerCase().trim(), g.name);
        });
      }

      // Collect all recipient emails
      const studentEmails = students.map(s => s.email?.toLowerCase().trim()).filter(Boolean);
      const guideEmails = Array.from(guideEmailMap.keys());
      const allRecipients = [...new Set([...studentEmails, ...guideEmails])];

      console.log(`[Timeline] Notifying ${studentEmails.length} students and ${guideEmails.length} guides (${allRecipients.length} unique emails)`);

      if (allRecipients.length > 0) {
        // Send asynchronously with BCC batching to avoid blocking HTTP response
        sendTimelineNotificationEmail(allRecipients, event)
          .then(result => {
            if (result) {
              console.log('[Timeline] Email notification delivery complete:', result);
            }
          })
          .catch(error => {
            console.error('[Timeline] Error in timeline email notification:', error.message);
          });
      } else {
        console.log('[Timeline] No recipients matched the target year/department filter');
      }
    } catch (emailError) {
      console.error('[Timeline] Error preparing targeted email notifications:', emailError.message);
    }

    res.status(201).json({ success: true, data: event });
  } catch (error) {
    console.error("❌ Error creating event:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ================= GET ALL EVENTS =================
exports.getAllEvents = async (req, res) => {
  try {
    const { year, branch } = req.query;

    // Base active filter
    const conditions = [
      { $or: [{ isActive: true }, { isActive: { $exists: false } }] }
    ];

    // Optional explicit filters (e.g. admin filtering the list)
    if (year && year !== 'all') {
      conditions.push({ targetYear: { $in: [year, 'all'] } });
    }
    if (branch && branch !== 'ALL' && branch !== 'all') {
      conditions.push({ department: { $in: [branch, 'ALL'] } });
    }

    // Visibility: admins see every branch/year. A timeline created for a particular
    // year + branch is visible only to students of that year + branch and to the
    // guides (and coordinators) of teams in that year + branch.
    const visibilityFilter = await buildTimelineVisibilityFilter(req.user);
    if (visibilityFilter) conditions.push(visibilityFilter);

    const query = { $and: conditions };

    const events = await TimelineEvent.find(query)
      .sort({ order: 1, deadline: 1 })
      .populate('createdBy', 'name');

    res.status(200).json({
      success: true,
      data: events
    });

  } catch (error) {
    console.error("❌ Error fetching events:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


// ================= UPDATE EVENT =================
exports.updateEvent = async (req, res) => {
  try {
    const {
      title,
      description,
      deadline,
      maxMarks,
      submissionRequirements,
      targetYear,
      order,
      isActive,
      isMandatoryFormat,
      isMarksEnabled
    } = req.body;

    const updateData = {};

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (deadline !== undefined) updateData.deadline = deadline;
    if (maxMarks !== undefined) updateData.maxMarks = Number(maxMarks);
    if (submissionRequirements !== undefined) updateData.submissionRequirements = submissionRequirements;
    if (targetYear !== undefined) updateData.targetYear = targetYear;
    if (order !== undefined) updateData.order = Number(order);
    if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true;

    const parseBool = (val) => {
      if (val === undefined || val === null) return true;
      if (typeof val === 'boolean') return val;
      return val === 'true' || val === '1' || val === 'on';
    };

    if (isMandatoryFormat !== undefined) {
      updateData.isMandatoryFormat = parseBool(isMandatoryFormat);
    }

    if (isMarksEnabled !== undefined) {
      const enabled = parseBool(isMarksEnabled);
      updateData.isMarksEnabled = enabled;
      if (!enabled) updateData.maxMarks = 0;
    }

    if (req.body.department !== undefined) {
      const requestedDept = String(req.body.department || 'ALL').trim().toUpperCase();
      updateData.department = VALID_DEPARTMENTS.includes(requestedDept) ? requestedDept : 'ALL';
    }

    if (req.file) {
      updateData.referenceFile = {
        url: `/uploads/reference/${req.file.filename}`,
        name: req.file.originalname
      };
    } else if (req.body.removeReferenceFile === 'true' || req.body.removeReferenceFile === true) {
      updateData.referenceFile = null;
    }

    const event = await TimelineEvent.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.status(200).json({
      success: true,
      data: event
    });

  } catch (error) {
    console.error("❌ Update error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ================= DELETE EVENT =================
exports.deleteEvent = async (req, res) => {
  try {
    const event = await TimelineEvent.findByIdAndDelete(req.params.id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    await Submission.deleteMany({ timelineEventId: req.params.id });

    res.status(200).json({
      success: true,
      message: 'Event deleted'
    });

  } catch (error) {
    console.error("❌ Delete error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// ================= GET TIMELINE FOR BATCH =================
exports.getTimelineForBatch = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.batchId);

    if (!batch) {
      return res.status(404).json({
        success: false,
        message: 'Batch not found'
      });
    }

    const canViewStudentMarks = req.user?.role === 'student'
      && await Student.exists({ _id: req.user._id, batchId: batch._id });

    const query = { isActive: true };

    // Filter by year: match the batch's year OR events targeting 'all' years
    if (batch.year) {
      query.$and = [
        { $or: [{ targetYear: batch.year }, { targetYear: 'all' }] }
      ];
    }

    // Filter by department: only show events for this batch's branch OR institution-wide ('ALL') events
    // This prevents ECE timeline events from appearing in CSE student dashboards
    const branchFilter = { $or: [{ department: batch.branch }, { department: 'ALL' }] };
    if (query.$and) {
      query.$and.push(branchFilter);
    } else {
      query.$and = [branchFilter];
    }

    const events = await TimelineEvent.find(query)
      .sort({ order: 1, deadline: 1 });

    const submissions = await Submission.find({ batchId: req.params.batchId })
      .populate('comments.guideId', 'name')
      .populate('marksAssignedBy', 'name')
      .populate('adminRemarks.adminId', 'name');

    const timelineWithStatus = events.map(event => {
      const submission = submissions.find(
        s => s.timelineEventId.toString() === event._id.toString()
      );

      let sanitizedSubmission = null;
      let studentMarks = null;
      if (submission) {
        sanitizedSubmission = submission.toObject();
        const personalMark = canViewStudentMarks
          ? submission.studentMarks.find(mark => {
            const studentId = mark.studentId?._id || mark.studentId;
            return studentId?.toString() === req.user._id.toString();
          })
          : null;
        studentMarks = personalMark ? personalMark.marks : submission.marks;
        delete sanitizedSubmission.marks;
        delete sanitizedSubmission.studentMarks;
        delete sanitizedSubmission.prcMarks;
        delete sanitizedSubmission.prcStudentMarks;
      }

      return {
        ...event.toObject(),
        submission: sanitizedSubmission,
        submissionStatus: submission?.status || 'not_started',
        marks: canViewStudentMarks ? studentMarks : null,
        currentVersion: submission?.currentVersion || 0
      };
    });

    res.status(200).json({
      success: true,
      data: timelineWithStatus
    });

  } catch (error) {
    console.error("❌ Timeline error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
