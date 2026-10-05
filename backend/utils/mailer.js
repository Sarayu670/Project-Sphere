const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify connection configuration on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('[SMTP] Connection warning/error:', error.message);
  } else {
    console.log('[SMTP] Server is ready to take our messages');
  }
});

// Helper function to escape HTML
const escapeHtml = (text) => {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
};

// Helper function to format status text
const formatStatusText = (status) => {
  if (!status) return '';
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Helper function to get status color
const getStatusColor = (status) => {
  const colors = {
    'accepted': '#16a34a',
    'rejected': '#dc2626',
    'needs_revision': '#d97706',
    'submitted': '#2563eb',
    'under_review': '#7c3aed'
  };
  return colors[status] || '#334155';
};

/**
 * 1. Send email to Guide when students make a submission (or resubmission)
 */
const sendGuideSubmissionEmail = async (guideEmail, guideName, studentNames, submissionType, projectTitle, description, driveLink, teamName, isResubmission = false) => {
  try {
    if (!guideEmail) {
      console.log('[Mailer] No guide email provided for submission notification');
      return null;
    }

    const subjectPrefix = isResubmission ? 'Resubmitted Milestone' : 'New Milestone Submission';
    const studentsFormatted = Array.isArray(studentNames) && studentNames.length > 0
      ? studentNames.join(', ')
      : 'Team Members';

    console.log(`[Mailer] Preparing submission email to guide: ${guideEmail} for team: ${teamName}`);

    const mailOptions = {
      from: process.env.SMTP_FROM || `"Project Sphere" <${process.env.SMTP_USER}>`,
      to: guideEmail,
      subject: `[Project Sphere] ${subjectPrefix}: ${submissionType} - ${teamName}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #1e3a8a; padding: 20px; color: #ffffff;">
            <h2 style="margin: 0; font-size: 1.3rem;">🎓 Project Sphere Notification</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 0.95rem;">${isResubmission ? 'Milestone Resubmission Received' : 'New Milestone Submission Received'}</p>
          </div>
          
          <div style="padding: 24px;">
            <p>Dear <strong>${escapeHtml(guideName || 'Guide')}</strong>,</p>
            <p>${isResubmission ? 'A new revised version has been submitted' : 'A new submission has been submitted'} by your assigned team for <strong>${escapeHtml(projectTitle || 'Academic Project')}</strong>.</p>
            
            <div style="background-color: #f8fafc; padding: 18px; border-left: 4px solid #2563eb; margin: 20px 0; border-radius: 6px; border: 1px solid #e2e8f0;">
              <p style="margin: 4px 0;"><strong>👥 Team Name:</strong> ${escapeHtml(teamName)}</p>
              <p style="margin: 4px 0;"><strong>👤 Student(s):</strong> ${escapeHtml(studentsFormatted)}</p>
              <p style="margin: 4px 0;"><strong>📌 Milestone:</strong> ${escapeHtml(submissionType)}</p>
              <p style="margin: 4px 0;"><strong>📝 Description:</strong> ${escapeHtml(description || 'No description provided.')}</p>
            </div>
            
            ${driveLink ? `
              <p style="margin: 20px 0;">
                <a href="${driveLink}" target="_blank" style="display: inline-block; padding: 10px 22px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">📁 View Submission on Google Drive</a>
              </p>
            ` : ''}
            
            <p style="font-size: 0.9rem; color: #64748b;">Please log in to the portal to review this submission, submit your feedback, and award marks.</p>
          </div>
          
          <div style="background-color: #f1f5f9; padding: 14px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 0.8rem; color: #64748b;">
            This is an automated notification from Project Sphere • GNITS. Please do not reply directly to this email.
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Mailer] Submission email sent to guide ${guideEmail}: Message ID ${info.messageId}`);
    return info;
  } catch (error) {
    console.error(`[Mailer] Failed to send submission email to ${guideEmail}:`, error.message);
    return null;
  }
};

/**
 * 2. Send email notification when Admin creates a Timeline Event (Targeted by Year & Branch)
 * Uses BCC batching (chunks of 40) to stay well within Gmail sending and connection limits.
 */
const sendTimelineNotificationEmail = async (recipients, event) => {
  try {
    if (!recipients || recipients.length === 0) {
      console.log('[Mailer] No recipients provided for timeline notification');
      return null;
    }

    // Extract and deduplicate valid emails
    const emailList = [...new Set(
      recipients
        .map(r => (typeof r === 'string' ? r : r.email)?.toLowerCase().trim())
        .filter(email => email && email.includes('@'))
    )];

    if (emailList.length === 0) {
      console.log('[Mailer] No valid recipient email addresses found');
      return null;
    }

    const websiteLink = process.env.FRONTEND_URL || 'http://localhost:5173';
    const deadlineDate = new Date(event.deadline);
    const formattedDeadline = deadlineDate.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    const targetScopeText = [
      event.targetYear && event.targetYear !== 'all' ? `${event.targetYear} Year` : 'All Years',
      event.department && event.department !== 'ALL' ? event.department : 'All Departments'
    ].join(' • ');

    console.log(`[Mailer] Preparing timeline notification for ${emailList.length} recipients (${targetScopeText})`);

    // Chunk into BCC batches of 40 to avoid Gmail's recipient limits and preserve quota
    const BATCH_SIZE = 40;
    const chunks = [];
    for (let i = 0; i < emailList.length; i += BATCH_SIZE) {
      chunks.push(emailList.slice(i, i + BATCH_SIZE));
    }

    console.log(`[Mailer] Dispatching ${chunks.length} BCC email batches...`);

    let successful = 0;
    let failed = 0;

    for (let i = 0; i < chunks.length; i++) {
      const bccBatch = chunks[i];
      try {
        const mailOptions = {
          from: process.env.SMTP_FROM || `"Project Sphere" <${process.env.SMTP_USER}>`,
          to: process.env.SMTP_USER || 'projectsphere18@gmail.com', // Primary sender to self
          bcc: bccBatch, // Blind carbon copy to keep student/guide emails private
          subject: `[Project Sphere] New Timeline Event: ${event.title} (${targetScopeText})`,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
              <div style="background-color: #1e3a8a; padding: 20px; color: #ffffff;">
                <h2 style="margin: 0; font-size: 1.3rem;">📅 Project Sphere Timeline Announcement</h2>
                <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 0.95rem;">New Milestone Published for ${escapeHtml(targetScopeText)}</p>
              </div>
              
              <div style="padding: 24px;">
                <p>Hello,</p>
                <p>A new project milestone has been scheduled on the Project Sphere portal for <strong>${escapeHtml(targetScopeText)}</strong>.</p>
                
                <div style="background-color: #f8fafc; padding: 18px; border-left: 4px solid #1e3a8a; margin: 20px 0; border-radius: 6px; border: 1px solid #e2e8f0;">
                  <h3 style="margin-top: 0; color: #1e3a8a; font-size: 1.15rem;">${escapeHtml(event.title)}</h3>
                  <p style="margin: 4px 0; color: #475569;"><strong>Description:</strong> ${escapeHtml(event.description || 'No description provided.')}</p>
                  <p style="margin: 6px 0;"><strong>📅 Deadline:</strong> <span style="color: #dc2626; font-weight: bold;">${formattedDeadline}</span></p>
                  ${event.maxMarks > 0 ? `<p style="margin: 4px 0;"><strong>🎯 Maximum Marks:</strong> ${event.maxMarks}</p>` : ''}
                  ${event.submissionRequirements ? `<p style="margin: 4px 0;"><strong>📋 Requirements:</strong> ${escapeHtml(event.submissionRequirements)}</p>` : ''}
                  <p style="margin: 4px 0;"><strong>👥 Applicable Scope:</strong> ${escapeHtml(targetScopeText)}</p>
                </div>
                
                <p>Please log in to the Project Sphere portal to view milestone requirements and upload your team submission before the deadline.</p>
                
                <p style="margin: 25px 0; text-align: center;">
                  <a href="${websiteLink}" target="_blank" style="display: inline-block; padding: 12px 26px; background-color: #1e3a8a; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">Go to Project Sphere Portal</a>
                </p>
              </div>
              
              <div style="background-color: #f1f5f9; padding: 14px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 0.8rem; color: #64748b;">
                This is an automated notification from Project Sphere • GNITS. Please do not reply directly to this email.
              </div>
            </div>
          `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[Mailer] Batch ${i + 1}/${chunks.length} delivered (${bccBatch.length} recipients): Message ID ${info.messageId}`);
        successful += bccBatch.length;
      } catch (chunkError) {
        console.error(`[Mailer] Error sending batch ${i + 1}:`, chunkError.message);
        failed += bccBatch.length;
      }
    }

    console.log(`[Mailer] Timeline broadcast complete: ${successful} recipients notified, ${failed} failed.`);
    return { total: emailList.length, successful, failed };
  } catch (error) {
    console.error('[Mailer] Error in sendTimelineNotificationEmail:', error.message);
    return null;
  }
};

/**
 * 3. Send email notification to students when Guide gives feedback or marks
 */
const sendGuideFeedbackNotificationEmail = async (students, guideName, submissionDetails) => {
  try {
    if (!students || students.length === 0) {
      console.log('[Mailer] No students provided for feedback notification');
      return null;
    }

    const websiteLink = process.env.FRONTEND_URL || 'http://localhost:5173';
    const { teamName, timelineTitle, submissionType, feedback, marks, status, driveLink } = submissionDetails;

    // Collect valid student emails
    const validEmails = [...new Set(
      students
        .map(s => (typeof s === 'string' ? s : s.email)?.toLowerCase().trim())
        .filter(email => email && email.includes('@'))
    )];

    if (validEmails.length === 0) {
      console.log('[Mailer] No valid student emails found for feedback notification');
      return null;
    }

    console.log(`[Mailer] Sending feedback notification to ${validEmails.length} students for team: ${teamName}`);

    const mailOptions = {
      from: process.env.SMTP_FROM || `"Project Sphere" <${process.env.SMTP_USER}>`,
      to: validEmails, // Sends to all team members on a single thread
      subject: `[Project Sphere] Guide Feedback: ${submissionType || timelineTitle} - ${teamName}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <div style="background-color: #047857; padding: 20px; color: #ffffff;">
            <h2 style="margin: 0; font-size: 1.3rem;">💬 Guide Feedback & Decision Update</h2>
            <p style="margin: 5px 0 0 0; opacity: 0.9; font-size: 0.95rem;">Team ${escapeHtml(teamName)} • ${escapeHtml(timelineTitle || submissionType)}</p>
          </div>
          
          <div style="padding: 24px;">
            <p>Dear Students,</p>
            <p>Your project guide, <strong>${escapeHtml(guideName || 'Guide')}</strong>, has reviewed your submission and provided an update.</p>
            
            <div style="background-color: #f8fafc; padding: 18px; border-left: 4px solid #047857; margin: 20px 0; border-radius: 6px; border: 1px solid #e2e8f0;">
              <p style="margin: 4px 0;"><strong>👥 Team:</strong> ${escapeHtml(teamName)}</p>
              <p style="margin: 4px 0;"><strong>📌 Milestone:</strong> ${escapeHtml(timelineTitle || submissionType)}</p>
              <p style="margin: 4px 0;"><strong>👨‍🏫 Guide:</strong> ${escapeHtml(guideName)}</p>
              ${status ? `<p style="margin: 6px 0;"><strong>📊 Status:</strong> <span style="color: ${getStatusColor(status)}; font-weight: bold; font-size: 1.05rem;">${formatStatusText(status)}</span></p>` : ''}
              ${marks !== undefined && marks !== null ? `<p style="margin: 6px 0;"><strong>🎯 Marks:</strong> <span style="color: #047857; font-weight: bold; font-size: 1.15rem;">${marks}</span></p>` : ''}
              
              ${feedback ? `
                <div style="margin-top: 15px; padding: 12px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
                  <strong style="color: #92400e;">Guide Comments:</strong>
                  <p style="margin: 6px 0 0 0; color: #78350f; white-space: pre-wrap;">${escapeHtml(feedback)}</p>
                </div>
              ` : ''}
            </div>
            
            ${driveLink ? `
              <p style="margin: 15px 0;">
                <a href="${driveLink}" target="_blank" style="display: inline-block; padding: 10px 20px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">📁 View Submitted Drive File</a>
              </p>
            ` : ''}
            
            <p style="margin: 20px 0; text-align: center;">
              <a href="${websiteLink}" target="_blank" style="display: inline-block; padding: 12px 26px; background-color: #047857; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold;">Open Project Sphere</a>
            </p>
          </div>
          
          <div style="background-color: #f1f5f9; padding: 14px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 0.8rem; color: #64748b;">
            This is an automated notification from Project Sphere • GNITS. Please do not reply directly to this email.
          </div>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`[Mailer] Feedback notification delivered to ${validEmails.length} students: Message ID ${info.messageId}`);
    return { success: true, count: validEmails.length, messageId: info.messageId };
  } catch (error) {
    console.error('[Mailer] Error sending feedback notification email:', error.message);
    return null;
  }
};

module.exports = {
  transporter,
  sendGuideSubmissionEmail,
  sendTimelineNotificationEmail,
  sendGuideFeedbackNotificationEmail,
};
