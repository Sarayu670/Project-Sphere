const TimelineEvent = require('../models/TimelineEvent');
const Submission = require('../models/Submission');
const Batch = require('../models/Batch');

// @desc    Create timeline event (Admin only)
// @route   POST /api/timeline
exports.createEvent = async (req, res) => {
  try {
    console.log('Creating timeline event...');
    console.log('Request body:', req.body);
    console.log('User:', req.user);

    const { title, description, deadline, maxMarks, submissionRequirements, targetYear, order } = req.body;

    const event = await TimelineEvent.create({
      title,
      description,
      deadline,
      maxMarks,
      submissionRequirements,
      targetYear: targetYear || 'all',
      order: order || 0,
      createdBy: req.user._id
    });

    console.log('Event created:', event);
    res.status(201).json({ success: true, data: event });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all timeline events
// @route   GET /api/timeline
exports.getAllEvents = async (req, res) => {
  try {
    console.log('Getting all timeline events...');
    console.log('Query params:', req.query);
    console.log('User:', req.user);

    const { year } = req.query;
    let query = { $or: [{ isActive: true }, { isActive: { $exists: false } }] };

    if (year && year !== 'all') {
      query.$and = [
        { $or: [{ isActive: true }, { isActive: { $exists: false } }] },
        { $or: [{ targetYear: year }, { targetYear: 'all' }] }
      ];
    }

    const events = await TimelineEvent.find(query)
      .sort({ order: 1, deadline: 1 })
      .populate('createdBy', 'name');

    console.log('Found events:', events.length);
    console.log('Returning events:', JSON.stringify(events, null, 2));
    
    res.status(200).json({ 
      success: true, 
      data: events 
    });
  } catch (error) {
    console.error('Error getting events:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update timeline event
// @route   PUT /api/timeline/:id
exports.updateEvent = async (req, res) => {
  try {
    const { title, description, deadline, maxMarks, submissionRequirements, targetYear, order, isActive } = req.body;

    const event = await TimelineEvent.findByIdAndUpdate(
      req.params.id,
      { title, description, deadline, maxMarks, submissionRequirements, targetYear, order, isActive },
      { new: true, runValidators: true }
    );

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    res.status(200).json({ success: true, data: event });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete timeline event
// @route   DELETE /api/timeline/:id
exports.deleteEvent = async (req, res) => {
  try {
    const event = await TimelineEvent.findByIdAndDelete(req.params.id);

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }

    // Also delete related submissions
    await Submission.deleteMany({ timelineEventId: req.params.id });

    res.status(200).json({ success: true, message: 'Event deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get timeline with submission status for a batch
// @route   GET /api/timeline/batch/:batchId
exports.getTimelineForBatch = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ success: false, message: 'Batch not found' });
    }

    const query = { isActive: true };
    if (batch.year) {
      query.$or = [{ targetYear: batch.year }, { targetYear: 'all' }];
    }

    const events = await TimelineEvent.find(query).sort({ order: 1, deadline: 1 });
    const submissions = await Submission.find({ batchId: req.params.batchId });

    const timelineWithStatus = events.map(event => {
      const submission = submissions.find(s => s.timelineEventId.toString() === event._id.toString());
      return {
        ...event.toObject(),
        submission: submission || null,
        submissionStatus: submission?.status || 'not_started',
        marks: submission?.marks,
        currentVersion: submission?.currentVersion || 0
      };
    });

    res.status(200).json({ success: true, data: timelineWithStatus });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

