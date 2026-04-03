const TimelineEvent = require('../models/TimelineEvent');
const Submission = require('../models/Submission');
const Batch = require('../models/Batch');
const Guide = require('../models/Guide');
const Student = require('../models/Student');
const ProjectEntry = require('../models/ProjectEntry');
const { sendTimelineNotificationEmail, sendNewEventEmail } = require('../utils/mailer');

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

    const event = await TimelineEvent.create({
      title,
      description,
      deadline,
      maxMarks: parseBool(isMarksEnabled) ? Number(maxMarks) : 0,
      submissionRequirements,
      targetYear: targetYear || 'all',
      order: Number(order) || 0,
      isMandatoryFormat: parseBool(isMandatoryFormat),
      isMarksEnabled: parseBool(isMarksEnabled),
      referenceFile: referenceFileData,
      createdBy: req.user._id
    });

    console.log('Event created:', event);

    // ================= EMAIL NOTIFICATION - METHOD 1: Direct from Guide & Student models =================
    try {
      console.log('Sending email notifications (Method 1: Direct DB query)...');
      
      // Fetch all guides
      const guides = await Guide.find({}).select('name email').lean();
      console.log(`Found ${guides.length} guides`);
      
      // Fetch all students (excluding 2nd year as they typically don't participate)
      const students = await Student.find({ year: { $in: ['3rd', '4th'] } }).select('name email').lean();
      console.log(`Found ${students.length} eligible students (3rd & 4th year)`);
      
      // Combine recipients
      const recipients = [
        ...guides.map(g => ({ name: g.name, email: g.email })),
        ...students.map(s => ({ name: s.name, email: s.email }))
      ];
      
      console.log(`Total recipients: ${recipients.length}`);
      
      if (recipients.length > 0) {
        // Send emails asynchronously without blocking the response
        sendTimelineNotificationEmail(recipients, event)
          .then(result => {
            if (result) {
              console.log('Email notification results:', result);
            }
          })
          .catch(error => {
            console.error('Error in timeline email notification:', error);
          });
      } else {
        console.log('No recipients found for email notification');
      }
    } catch (emailError) {
      // Log the error but don't fail the request
      console.error('Failed to send email notifications (Method 1):', emailError.message);
    }

    // ================= EMAIL NOTIFICATION - METHOD 2: From ProjectEntry =================
    try {
      console.log('Sending email notifications (Method 2: ProjectEntry)...');
      const projectEntries = await ProjectEntry.find({});
      let allEmails = [];

      projectEntries.forEach(entry => {
        // STUDENTS
        if (entry.students && entry.students.length > 0) {
          // CASE 1: [{ rollNumber }]
          if (typeof entry.students[0] === 'object') {
            entry.students.forEach(student => {
              if (student.rollNumber) {
                const rollno = student.rollNumber.trim().toLowerCase();
                allEmails.push(`${rollno}@gnits.ac.in`);
              }
            });
          }
          // CASE 2: ["rollno"]
          else {
            entry.students.forEach(roll => {
              const rollno = roll.trim().toLowerCase();
              allEmails.push(`${rollno}@gnits.ac.in`);
            });
          }
        }

        // GUIDE EMAIL
        if (entry.internalGuide && entry.internalGuide.email) {
          allEmails.push(entry.internalGuide.email.trim().toLowerCase());
        }
      });

      // REMOVE DUPLICATES
      allEmails = [...new Set(allEmails)].filter(email => email);

      console.log("📧 Emails from ProjectEntry:", allEmails);

      if (allEmails.length > 0) {
        // Send emails asynchronously
        sendNewEventEmail(allEmails, event)
          .then(result => {
            if (result) {
              console.log("✅ ProjectEntry emails sent successfully");
            }
          })
          .catch(error => {
            console.error("❌ Error sending ProjectEntry emails:", error);
          });
      } else {
        console.log("⚠️ No emails found in ProjectEntry");
      }
    } catch (emailError) {
      console.error("❌ Email sending error (Method 2):", emailError);
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
    const { year } = req.query;

    let query = {
      $or: [{ isActive: true }, { isActive: { $exists: false } }]
    };

    if (year && year !== 'all') {
      query.$and = [
        { $or: [{ isActive: true }, { isActive: { $exists: false } }] },
        { $or: [{ targetYear: year }, { targetYear: 'all' }] }
      ];
    }

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

    if (req.file) {
      updateData.referenceFile = {
        url: `/uploads/reference/${req.file.filename}`,
        name: req.file.originalname
      };
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

    const query = { isActive: true };

    if (batch.year) {
      query.$or = [
        { targetYear: batch.year },
        { targetYear: 'all' }
      ];
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

      return {
        ...event.toObject(),
        submission: submission || null,
        submissionStatus: submission?.status || 'not_started',
        marks: submission?.marks,
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
