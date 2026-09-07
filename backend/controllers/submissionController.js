const Submission = require('../models/Submission');
const TimelineEvent = require('../models/TimelineEvent');
const Batch = require('../models/Batch');
const pdf = require('pdf-parse');
const fs = require('fs');
const { sendGuideSubmissionEmail, sendGuideFeedbackNotificationEmail } = require('../utils/mailer');
const Student = require('../models/Student');
const Guide = require('../models/Guide');

async function validateSubmission(filePath, isMandatoryFormat, context = {}) {
  if (!isMandatoryFormat) return { isValid: true, errors: [] };

  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    const text = data.text;
    const errors = [];

    // Base Institutional Rules
    const rules = [
      {
        pattern: /G\.?\s*Narayanamma\s*Institute\s*of\s*Technology\s*&\s*Science/i,
        message: "Institution name 'G. Narayanamma Institute of Technology & Science' not found in header."
      },
      {
        pattern: /DEPARTMENT\s*OF\s*COMPUTER\s*SCIENCE\s*AND\s*ENGINEERING/i,
        message: "Department name 'DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING' not found."
      },
      {
        pattern: /Abstract:/i,
        message: "Section heading 'Abstract:' not found."
      },
      {
        pattern: /H\/W\s*&\s*S\/W\s*Requirements/i,
        message: "Section heading 'H/W & S/W Requirements' not found."
      }
    ];

    // Context-specific rules (Project Title, Guide, Team)
    if (context.projectTitle) {
      rules.push({
        pattern: new RegExp(context.projectTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
        message: `Project title '${context.projectTitle}' not found in document.`
      });
    }

    if (context.guideName) {
      rules.push({
        pattern: new RegExp(context.guideName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
        message: `Guide name '${context.guideName}' not found.`
      });
    }

    if (context.teamMembers && context.teamMembers.length > 0) {
      context.teamMembers.forEach(member => {
        if (member.rollNo) {
          rules.push({
            pattern: new RegExp(member.rollNo, 'i'),
            message: `Team member roll number '${member.rollNo}' not found.`
          });
        }
      });
    }

    rules.forEach(rule => {
      if (!rule.pattern.test(text)) {
        errors.push(rule.message);
      }
    });

    // Basic word count check for abstract
    const abstractMatch = text.match(/Abstract:([\s\S]*?)(H\/W|Requirements|Introduction|$)/i);
    if (abstractMatch) {
      const abstractText = abstractMatch[1].trim();
      const wordCount = abstractText.split(/\s+/).filter(w => w.length > 0).length;
      if (wordCount > 250) {
        errors.push(`Abstract section seems too long (${wordCount} words). Requirement is approx 200 words.`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  } catch (err) {
    console.error('Validation error:', err);
    return { isValid: true, errors: ['Warning: Could not perform automated format check on this file type.'] };
  }
}

// @desc    Submit or update a submission (Student)
// @route   POST /api/submissions
exports.createOrUpdateSubmission = async (req, res) => {
  try {
    const { batchId, timelineEventId, description, driveLink } = req.body;

    if (!driveLink || !driveLink.trim()) {
      return res.status(400).json({ success: false, message: 'Google Drive link is required' });
    }

    // Verify batch exists and student is member of the batch
    const batch = await Batch.findById(batchId).populate('guideId').populate('problemId');
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    // Check if current student belongs to this batch
    const student = await Student.findById(req.user._id);
    if (!student || !student.batchId || student.batchId.toString() !== batchId.toString()) {
      return res.status(403).json({ success: false, message: 'You are not a member of this batch' });
    }

    // Check if event exists
    const event = await TimelineEvent.findById(timelineEventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Timeline event not found' });
    }

    const timelineEvents = await TimelineEvent.find({
      isActive: true,
      $or: [
        { targetYear: batch.year },
        { targetYear: 'all' }
      ]
    }).sort({ order: 1, deadline: 1 }).select('_id');
    const eventIndex = timelineEvents.findIndex(item => item._id.toString() === event._id.toString());

    if (eventIndex > 0) {
      const previousSubmission = await Submission.findOne({
        batchId,
        timelineEventId: timelineEvents[eventIndex - 1]._id
      }).select('status');

      if (previousSubmission?.status !== 'accepted') {
        return res.status(400).json({
          success: false,
          message: 'Complete and get the previous timeline milestone accepted before submitting this event.'
        });
      }
    }

    // Check if deadline has passed
    if (new Date() > event.deadline) {
      return res.status(400).json({ success: false, message: 'Submission deadline has passed' });
    }

    let submission = await Submission.findOne({ batchId, timelineEventId });

    if (submission) {
      // Add new version
      const newVersion = submission.currentVersion + 1;
      submission.versions.push({
        version: newVersion,
        driveLink: driveLink.trim(),
        description,
        submittedAt: new Date()
      });
      submission.currentVersion = newVersion;
      submission.status = 'submitted';
      await submission.save();
    } else {
      // Create new submission
      submission = await Submission.create({
        batchId,
        timelineEventId,
        versions: [{
          version: 1,
          driveLink: driveLink.trim(),
          description,
          submittedAt: new Date()
        }],
        currentVersion: 1,
        status: 'submitted'
      });
    }

    res.status(201).json({
      success: true,
      data: submission,
      validation: { isValid: true, errors: [] }
    });

    // Trigger Email Notification (Non-blocking)
    try {
      if (batch && batch.guideId && batch.guideId.email) {
        console.log(`[Notification] Triggering email for batch: ${batch.teamName}, guide: ${batch.guideId.name} (${batch.guideId.email})`);
        const students = await Student.find({ batchId: batch._id });
        const studentNames = students.map(s => s.name);
        
        await sendGuideSubmissionEmail(
          batch.guideId.email,
          batch.guideId.name,
          studentNames,
          event.title,
          batch.problemId ? batch.problemId.title : 'N/A',
          description,
          driveLink,
          batch.teamName
        );
      }
    } catch (emailError) {
      console.error('[Notification] Error in email trigger logic:', emailError);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get submission details
// @route   GET /api/submissions/:id
exports.getSubmission = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.id)
      .populate('batchId', 'teamName year branch section')
      .populate('timelineEventId', 'title maxMarks deadline isMarksEnabled')
      .populate('comments.guideId', 'name')
      .populate('adminRemarks.adminId', 'name')
      .populate('marksAssignedBy', 'name')
      .populate('studentMarks.studentId', 'name rollNumber')
      .populate('studentMarks.assignedBy', 'name');

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    res.status(200).json({ success: true, data: submission });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// @desc    Get all submissions for a batch
// @route   GET /api/submissions/batch/:batchId
exports.getBatchSubmissions = async (req, res) => {
  try {
    const submissions = await Submission.find({ batchId: req.params.batchId })
      .populate('timelineEventId', 'title maxMarks deadline isMarksEnabled')
      .populate('comments.guideId', 'name')
      .populate('adminRemarks.adminId', 'name');

    // Strip per-student marks so students cannot see them
    const sanitized = submissions.map(sub => {
      const obj = sub.toObject();
      delete obj.studentMarks;
      delete obj.marks; // also hide legacy group marks
      return obj;
    });

    res.status(200).json({ success: true, data: sanitized });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// @desc    Get submissions for guide's batches
// @route   GET /api/submissions/guide
exports.getGuideSubmissions = async (req, res) => {
  try {
    const batches = await Batch.find({ guideId: req.user._id, allotmentStatus: 'allotted' });
    const batchIds = batches.map(b => b._id);

    const submissions = await Submission.find({ batchId: { $in: batchIds }, status: { $ne: 'not_started' } })
      .populate('batchId', 'teamName year branch section leaderStudentId')
      .populate('timelineEventId', 'title maxMarks deadline isMarksEnabled')
      .populate('comments.guideId', 'name')
      .populate('adminRemarks.adminId', 'name')
      .populate('studentMarks.studentId', 'name rollNumber')
      .populate('studentMarks.assignedBy', 'name')
      .sort({ updatedAt: -1 });

    res.status(200).json({ success: true, data: submissions });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add comment to submission (Guide)
// @route   POST /api/submissions/:id/comment
exports.addComment = async (req, res) => {
  try {
    const { comment } = req.body;
    const submission = await Submission.findById(req.params.id)
      .populate('batchId', 'teamName')
      .populate('timelineEventId', 'title');

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    submission.comments.push({
      guideId: req.user._id,
      comment,
      createdAt: new Date()
    });

    // Only update status to needs_revision if it's not already accepted or rejected
    if (submission.status !== 'accepted' && submission.status !== 'rejected') {
      submission.status = 'needs_revision';
    }

    await submission.save();

    const updated = await Submission.findById(req.params.id).populate('comments.guideId', 'name');
    
    // Send email notification to students asynchronously
    try {
      console.log('[Notification] Sending feedback notification to students...');
      
      // Get guide details
      const guide = await Guide.findById(req.user._id).select('name email').lean();
      const guideName = guide ? guide.name : 'Your Guide';
      
      // Get all students from the batch
      const students = await Student.find({ batchId: submission.batchId._id }).select('name email').lean();
      
      if (students.length > 0) {
        const submissionDetails = {
          teamName: submission.batchId.teamName,
          timelineTitle: submission.timelineEventId.title,
          submissionType: submission.timelineEventId.title,
          feedback: comment,
          marks: submission.marks,
          status: submission.status,
          driveLink: submission.versions[submission.currentVersion - 1]?.driveLink || ''
        };
        
        // Send emails asynchronously without blocking the response
        sendGuideFeedbackNotificationEmail(students, guideName, submissionDetails)
          .then(result => {
            if (result) {
              console.log('[Notification] Feedback email results:', result);
            }
          })
          .catch(error => {
            console.error('[Notification] Error sending feedback emails:', error);
          });
      } else {
        console.log('[Notification] No students found in this batch');
      }
    } catch (emailError) {
      console.error('[Notification] Error in feedback email trigger logic:', emailError);
    }

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Assign marks (Guide) — per student
// @route   POST /api/submissions/:id/marks
exports.assignMarks = async (req, res) => {
  try {
    const { marks, status, comment, studentMarks } = req.body;
    const submission = await Submission.findById(req.params.id)
      .populate('timelineEventId', 'maxMarks title')
      .populate('batchId', 'teamName');

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    // Add comment if provided
    if (comment && comment.trim()) {
      submission.comments.push({
        guideId: req.user._id,
        comment: comment.trim(),
        createdAt: new Date()
      });
    }

    // Handle per-student marks (new behaviour)
    if (Array.isArray(studentMarks) && studentMarks.length > 0) {
      for (const sm of studentMarks) {
        if (sm.marks !== null && sm.marks !== undefined && sm.marks > submission.timelineEventId.maxMarks) {
          return res.status(400).json({ success: false, message: `Marks cannot exceed ${submission.timelineEventId.maxMarks}` });
        }
      }

      // Upsert: update existing entry for student or push new one
      for (const sm of studentMarks) {
        const existing = submission.studentMarks.find(
          e => e.studentId.toString() === sm.studentId.toString()
        );
        if (existing) {
          existing.marks = sm.marks !== '' && sm.marks !== null && sm.marks !== undefined ? parseFloat(sm.marks) : null;
          existing.assignedBy = req.user._id;
          existing.assignedAt = new Date();
        } else {
          submission.studentMarks.push({
            studentId: sm.studentId,
            marks: sm.marks !== '' && sm.marks !== null && sm.marks !== undefined ? parseFloat(sm.marks) : null,
            assignedBy: req.user._id,
            assignedAt: new Date()
          });
        }
      }
      // Keep legacy marks field as null since we now use per-student marks
      submission.marks = null;
    } else {
      // Legacy single-mark fallback
      if (marks > submission.timelineEventId.maxMarks) {
        return res.status(400).json({ success: false, message: `Marks cannot exceed ${submission.timelineEventId.maxMarks}` });
      }
      submission.marks = marks;
      submission.marksAssignedBy = req.user._id;
      submission.marksAssignedAt = new Date();
    }

    submission.status = status || 'accepted';
    await submission.save();

    // Re-fetch with proper population to ensure comments and studentMarks are populated
    const updated = await Submission.findById(req.params.id)
      .populate('comments.guideId', 'name')
      .populate('marksAssignedBy', 'name')
      .populate('batchId', 'teamName')
      .populate('timelineEventId', 'title maxMarks isMarksEnabled')
      .populate('studentMarks.studentId', 'name rollNumber')
      .populate('studentMarks.assignedBy', 'name');

    // Send email notification to students asynchronously
    try {
      console.log('[Notification] Sending marks assignment notification to students...');
      
      // Get guide details
      const guide = await Guide.findById(req.user._id).select('name email').lean();
      const guideName = guide ? guide.name : 'Your Guide';
      
      // Get all students from the batch
      const students = await Student.find({ batchId: submission.batchId._id }).select('name email').lean();
      
      if (students.length > 0) {
        const submissionDetails = {
          teamName: submission.batchId.teamName,
          timelineTitle: submission.timelineEventId.title,
          submissionType: submission.timelineEventId.title,
          feedback: comment ? comment.trim() : null,
          marks: null, // individual marks are private; don't send in email
          status: status || 'accepted',
          driveLink: submission.versions[submission.currentVersion - 1]?.driveLink || ''
        };
        
        // Send emails asynchronously without blocking the response
        sendGuideFeedbackNotificationEmail(students, guideName, submissionDetails)
          .then(result => {
            if (result) {
              console.log('[Notification] Marks assignment email results:', result);
            }
          })
          .catch(error => {
            console.error('[Notification] Error sending marks assignment emails:', error);
          });
      } else {
        console.log('[Notification] No students found in this batch');
      }
    } catch (emailError) {
      console.error('[Notification] Error in marks assignment email trigger logic:', emailError);
    }

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};


// @desc    Get all submissions (Admin)
// @route   GET /api/submissions
// Query params: page (default 1), limit (default 50), eventId (optional), batchId (optional), status (optional - default 'accepted')
exports.getAllSubmissions = async (req, res) => {
  try {
    console.log('📡 Getting submissions...');
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const eventId = req.query.eventId;
    const batchId = req.query.batchId;
    const status = req.query.status;
    const isCoordinatorRequest = req.user.role === 'guide' && req.user.isCoordinator && req.user.coordinatorSection;
    
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};
    if (eventId) filter.timelineEventId = eventId;

    if (isCoordinatorRequest) {
      const { year, branch, section } = req.user.coordinatorSection;
      const coordinatorBatches = await Batch.find({ year, branch, section }).select('_id');
      const coordinatorBatchIds = coordinatorBatches.map(b => b._id);

      if (coordinatorBatchIds.length === 0) {
        return res.status(200).json({
          success: true,
          data: [],
          pagination: { current: page, total: 0, limit, pages: 0 }
        });
      }

      filter.batchId = { $in: coordinatorBatchIds };
    }

    if (batchId) {
      const batchFilter = Array.isArray(filter.batchId) ? { $in: filter.batchId } : batchId;
      filter.batchId = isCoordinatorRequest
        ? { $in: Array.isArray(batchFilter.$in) ? batchFilter.$in.filter(id => id.toString() === batchId.toString()) : [batchId] }
        : batchId;
    }

    if (status && status !== 'all') {
      filter.status = status;
    }

    const submissions = await Submission.find(filter)
      .populate('batchId', 'teamName year branch section leaderStudentId guideId problemId coeId researchArea')
      .populate('timelineEventId', 'title maxMarks')
      .populate('comments.guideId', 'name')
      .populate('adminRemarks.adminId', 'name')
      .populate('marksAssignedBy', 'name')
      .populate('studentMarks.studentId', 'name rollNumber')
      .populate('studentMarks.assignedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(); // Use lean() for better performance on large result sets

    // Get total count for pagination
    const total = await Submission.countDocuments(filter);

    console.log(`✅ Found ${submissions.length} submissions for page ${page} with status: ${status}`);

    res.status(200).json({ 
      success: true, 
      data: submissions,
      pagination: {
        current: page,
        total,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('❌ Error getting submissions:', error.message);
    console.error('❌ Stack:', error.stack);
    res.status(200).json({ success: true, data: [], pagination: { current: 1, total: 0, limit: 50, pages: 0 } });
  }
};

// @desc    Add remark to submission (Admin only)
// @route   POST /api/submissions/:id/admin-remark
exports.addAdminRemark = async (req, res) => {
  try {
    const { remark } = req.body;
    const submission = await Submission.findById(req.params.id);

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    const isCoordinatorRemark = req.user.role === 'guide' && req.user.isCoordinator;
    const remarkOwnerType = isCoordinatorRemark ? 'Guide' : 'Admin';

    const duplicate = submission.adminRemarks.find(r =>
      r.adminId.toString() === req.user._id.toString() &&
      r.adminRemarkType === remarkOwnerType &&
      r.remark === remark &&
      (new Date() - new Date(r.createdAt)) < 60000
    );

    if (duplicate) {
      console.log('⚠️ Duplicate remark detected, skipping...');
    } else {
      submission.adminRemarks.push({
        adminId: req.user._id,
        adminRemarkType: remarkOwnerType,
        remark,
        createdAt: new Date()
      });
      await submission.save();
    }

    const updated = await Submission.findById(req.params.id)
      .populate('adminRemarks.adminId', 'name')
      .populate('comments.guideId', 'name');

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get students in a batch (for guide to assign per-student marks)
// @route   GET /api/submissions/batch/:batchId/students
exports.getStudentsByBatch = async (req, res) => {
  try {
    const students = await Student.find({ batchId: req.params.batchId })
      .select('_id name rollNumber')
      .lean();
    res.status(200).json({ success: true, data: students });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

