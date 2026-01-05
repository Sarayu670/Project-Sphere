const Submission = require('../models/Submission');
const TimelineEvent = require('../models/TimelineEvent');
const Batch = require('../models/Batch');

// @desc    Submit or update a submission (Student)
// @route   POST /api/submissions
exports.createOrUpdateSubmission = async (req, res) => {
  try {
    const { batchId, timelineEventId, fileUrl, fileName, description } = req.body;

    // Verify batch exists and student is leader
    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }
    if (batch.leaderStudentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only team leader can submit' });
    }

    // Check if event exists
    const event = await TimelineEvent.findById(timelineEventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Timeline event not found' });
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
        fileUrl,
        fileName,
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
          fileUrl,
          fileName,
          description,
          submittedAt: new Date()
        }],
        currentVersion: 1,
        status: 'submitted'
      });
    }

    res.status(201).json({ success: true, data: submission });
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
      .populate('timelineEventId', 'title maxMarks deadline')
      .populate('comments.guideId', 'name')
      .populate('marksAssignedBy', 'name');

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
      .populate('timelineEventId', 'title maxMarks deadline')
      .populate('comments.guideId', 'name');

    res.status(200).json({ success: true, data: submissions });
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
      .populate('timelineEventId', 'title maxMarks deadline')
      .populate('comments.guideId', 'name')
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
    const submission = await Submission.findById(req.params.id);

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
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Assign marks (Guide)
// @route   POST /api/submissions/:id/marks
exports.assignMarks = async (req, res) => {
  try {
    const { marks, status } = req.body;
    const submission = await Submission.findById(req.params.id)
      .populate('timelineEventId', 'maxMarks');

    if (!submission) {
      return res.status(404).json({ success: false, message: 'Submission not found' });
    }

    if (marks > submission.timelineEventId.maxMarks) {
      return res.status(400).json({ success: false, message: `Marks cannot exceed ${submission.timelineEventId.maxMarks}` });
    }

    submission.marks = marks;
    submission.marksAssignedBy = req.user._id;
    submission.marksAssignedAt = new Date();
    submission.status = status || 'accepted';
    await submission.save();

    res.status(200).json({ success: true, data: submission });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all submissions (Admin)
// @route   GET /api/submissions
exports.getAllSubmissions = async (req, res) => {
  try {
    console.log('📡 Getting all submissions...');
    
    const submissions = await Submission.find({})
      .populate('batchId')
      .populate('timelineEventId')
      .populate('comments.guideId', 'name')
      .populate('adminRemarks.adminId', 'name')
      .populate('marksAssignedBy', 'name')
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${submissions.length} submissions`);
    console.log('📋 Sample submission:', submissions[0]);
    
    res.status(200).json({ success: true, data: submissions });
  } catch (error) {
    console.error('❌ Error getting submissions:', error.message);
    console.error('❌ Stack:', error.stack);
    res.status(200).json({ success: true, data: [] });
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

    submission.adminRemarks.push({
      adminId: req.user._id,
      remark,
      createdAt: new Date()
    });
    await submission.save();

    const updated = await Submission.findById(req.params.id)
      .populate('adminRemarks.adminId', 'name')
      .populate('comments.guideId', 'name');
    
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

