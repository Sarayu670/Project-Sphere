const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Verify connection configuration
transporter.verify((error, success) => {
  if (error) {
    console.error('[SMTP] Connection error:', error);
  } else {
    console.log('[SMTP] Server is ready to take our messages');
  }
});

/**
 * Send email to guide when a student makes a submission
 */
const sendGuideSubmissionEmail = async (guideEmail, guideName, studentNames, submissionType, projectTitle, description, driveLink, teamName) => {
  try {
    console.log(`[Mailer] Preparing email to: ${guideEmail}, subject: New Submission: ${submissionType} - ${teamName}`);
    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: guideEmail,
      subject: `New Submission: ${submissionType} - ${teamName}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #2c3e50;">New Project Submission</h2>
          <p>Dear <strong>${guideName}</strong>,</p>
          <p>A new submission has been made for the project: <strong>${projectTitle || 'N/A'}</strong>.</p>
          
          <div style="background-color: #f9f9f9; padding: 15px; border-left: 5px solid #3498db; margin: 20px 0;">
            <p><strong>Team Name:</strong> ${teamName}</p>
            <p><strong>Student(s):</strong> ${studentNames.join(', ')}</p>
            <p><strong>Submission Type:</strong> ${submissionType}</p>
            <p><strong>Description:</strong> ${description || 'No description provided.'}</p>
          </div>
          
          <p>You can view the submission here:</p>
          <p><a href="${driveLink}" style="display: inline-block; padding: 10px 20px; background-color: #3498db; color: #fff; text-decoration: none; border-radius: 5px;">View on Google Drive</a></p>
          
          <p>Please review the submission at your earliest convenience.</p>
          
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 0.8em; color: #888;">This is an automated message from Project Sphere. Please do not reply to this email.</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    // We don't throw the error so that the submission itself doesn't fail if the email fails
    return null;
  }
};

/**
 * Send email notification when a new timeline event is created
 */
const sendTimelineNotificationEmail = async (recipients, event) => {
  try {
    if (!recipients || recipients.length === 0) {
      console.log('[Mailer] No recipients provided for timeline notification');
      return null;
    }

    const websiteLink = process.env.FRONTEND_URL || 'http://localhost:5173';
    const deadlineDate = new Date(event.deadline);
    const formattedDeadline = deadlineDate.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    console.log(`[Mailer] Preparing timeline notification email to ${recipients.length} recipients`);
    
    // Send individual emails to each recipient
    const emailPromises = recipients.map(async (recipient) => {
      try {
        const mailOptions = {
          from: process.env.SMTP_FROM,
          to: recipient.email,
          subject: `New Timeline Event: ${event.title}`,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <h2 style="color: #2c3e50;">New Timeline Event Added</h2>
              <p>Dear ${recipient.name},</p>
              <p>The admin has added a new timeline event to the Project Sphere portal.</p>
              
              <div style="background-color: #f9f9f9; padding: 15px; border-left: 5px solid #3498db; margin: 20px 0;">
                <h3 style="margin-top: 0; color: #2c3e50;">${event.title}</h3>
                <p><strong>Description:</strong></p>
                <p>${event.description || 'No description provided.'}</p>
                <p><strong>Deadline:</strong> ${formattedDeadline}</p>
                ${event.maxMarks > 0 ? `<p><strong>Maximum Marks:</strong> ${event.maxMarks}</p>` : ''}
                ${event.submissionRequirements ? `<p><strong>Submission Requirements:</strong> ${event.submissionRequirements}</p>` : ''}
              </div>
              
              <p>Please log in to the portal to view more details and make your submission.</p>
              <p>
                <a href="${websiteLink}" style="display: inline-block; padding: 10px 20px; background-color: #3498db; color: #fff; text-decoration: none; border-radius: 5px;">View on Project Sphere</a>
              </p>
              
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="font-size: 0.8em; color: #888;">This is an automated message from Project Sphere. Please do not reply to this email.</p>
            </div>
          `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[Mailer] Timeline notification sent to: ${recipient.email}, Message ID: ${info.messageId}`);
        return { success: true, email: recipient.email, messageId: info.messageId };
      } catch (error) {
        console.error(`[Mailer] Failed to send email to ${recipient.email}:`, error.message);
        return { success: false, email: recipient.email, error: error.message };
      }
    });

    const results = await Promise.allSettled(emailPromises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

    console.log(`[Mailer] Timeline notification summary: ${successful} successful, ${failed} failed out of ${recipients.length} recipients`);
    
    return {
      totalRecipients: recipients.length,
      successful,
      failed,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: 'Promise rejected' })
    };
  } catch (error) {
    console.error('[Mailer] Error sending timeline notification emails:', error);
    throw error;
  }
};

/**
 * Send email notification to all students and guides when a new event is added (alternative method using BCC)
 */
const sendNewEventEmail = async (recipients, eventDetails) => {
  try {
    if (!recipients || recipients.length === 0) {
      console.log('[Mailer] No recipients found for new event email.');
      return null;
    }

    console.log(`[Mailer] Sending new event email to ${recipients.length} recipients...`);
    
    const mailOptions = {
      from: process.env.SMTP_FROM,
      bcc: recipients, // Use BCC to hide email addresses from each other
      subject: `New Event Scheduled: ${eventDetails.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2c3e50;">New Project Event Scheduled</h2>
          <p>Hello,</p>
          <p>A new event has been added to the project timeline. Please find the details below:</p>
          
          <div style="background-color: #f9f9f9; padding: 20px; border-left: 5px solid #3498db; margin: 20px 0; border-radius: 4px;">
            <h3 style="margin-top: 0; color: #2980b9;">${eventDetails.title}</h3>
            <p><strong>Description:</strong> ${eventDetails.description || 'No description provided.'}</p>
            <p><strong>Deadline:</strong> ${eventDetails.deadline ? new Date(eventDetails.deadline).toLocaleString() : 'Not specified'}</p>
            ${eventDetails.isMarksEnabled ? `<p><strong>Maximum Marks:</strong> ${eventDetails.maxMarks}</p>` : ''}
          </div>
          
          <p>Please log in to the ProjectSphere dashboard to view more details and submit your work before the deadline.</p>
          
          <hr style="border: 0; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="font-size: 0.8em; color: #888; text-align: center;">This is an automated message from ProjectSphere. Please do not reply to this email.</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[Mailer] New event email sent: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('[Mailer] Error sending new event email:', error);
    return null;
  }
};

/**
 * Send email notification to students when guide adds feedback or assigns marks
 */
const sendGuideFeedbackNotificationEmail = async (students, guideName, submissionDetails) => {
  try {
    if (!students || students.length === 0) {
      console.log('[Mailer] No students provided for feedback notification');
      return null;
    }

    const websiteLink = process.env.FRONTEND_URL || 'http://localhost:5173';
    const { teamName, timelineTitle, submissionType, feedback, marks, status, driveLink } = submissionDetails;

    console.log(`[Mailer] Preparing feedback notification email to ${students.length} students from team: ${teamName}`);
    
    // Send individual emails to each student
    const emailPromises = students.map(async (student) => {
      try {
        const mailOptions = {
          from: process.env.SMTP_FROM,
          to: student.email,
          subject: `Submission Update: ${submissionType} - ${teamName}`,
          html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <h2 style="color: #2c3e50;">Submission Update</h2>
              <p>Dear <strong>${student.name}</strong>,</p>
              <p>Your guide has provided feedback on your team's submission.</p>
              
              <div style="background-color: #f9f9f9; padding: 15px; border-left: 5px solid #3498db; margin: 20px 0;">
                <p><strong>Team Name:</strong> ${teamName}</p>
                <p><strong>Submission Type:</strong> ${timelineTitle}</p>
                <p><strong>Guide:</strong> ${guideName}</p>
                
                ${status ? `<p><strong>Status:</strong> <span style="color: ${getStatusColor(status)}; font-weight: bold;">${formatStatusText(status)}</span></p>` : ''}
                
                ${marks !== undefined && marks !== null ? `
                  <p><strong>Marks Awarded:</strong> <span style="color: #27ae60; font-weight: bold; font-size: 1.2em;">${marks}</span></p>
                ` : ''}
                
                ${feedback ? `
                  <div style="margin-top: 15px; padding: 10px; background-color: #fff3cd; border-left: 4px solid #f39c12;">
                    <p style="margin: 0; font-weight: bold;">Feedback/Comments:</p>
                    <p style="margin: 5px 0 0 0;">${escapeHtml(feedback)}</p>
                  </div>
                ` : ''}
              </div>
              
              ${driveLink ? `
                <p>You can view your submission here:</p>
                <p>
                  <a href="${driveLink}" style="display: inline-block; padding: 10px 20px; background-color: #3498db; color: #fff; text-decoration: none; border-radius: 5px;">View Submission</a>
                </p>
              ` : ''}
              
              <p>Please log in to the Project Sphere portal for more details.</p>
              <p>
                <a href="${websiteLink}" style="display: inline-block; padding: 10px 20px; background-color: #27ae60; color: #fff; text-decoration: none; border-radius: 5px;">Go to Project Sphere</a>
              </p>
              
              <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
              <p style="font-size: 0.8em; color: #888;">This is an automated message from Project Sphere. Please do not reply to this email.</p>
            </div>
          `,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[Mailer] Feedback notification sent to: ${student.email}, Message ID: ${info.messageId}`);
        return { success: true, email: student.email, messageId: info.messageId };
      } catch (error) {
        console.error(`[Mailer] Failed to send email to ${student.email}:`, error.message);
        return { success: false, email: student.email, error: error.message };
      }
    });

    const results = await Promise.allSettled(emailPromises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)).length;

    console.log(`[Mailer] Feedback notification summary: ${successful} successful, ${failed} failed out of ${students.length} students`);
    
    return {
      totalRecipients: students.length,
      successful,
      failed,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: 'Promise rejected' })
    };
  } catch (error) {
    console.error('[Mailer] Error sending feedback notification emails:', error);
    throw error;
  }
};

// Helper function to format status text
const formatStatusText = (status) => {
  return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Helper function to get status color
const getStatusColor = (status) => {
  const colors = {
    'accepted': '#27ae60',
    'rejected': '#e74c3c',
    'needs_revision': '#f39c12',
    'submitted': '#3498db',
    'under_review': '#9b59b6'
  };
  return colors[status] || '#333';
};

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
  return text.replace(/[&<>"']/g, m => map[m]);
};

module.exports = {
  sendGuideSubmissionEmail,
  sendTimelineNotificationEmail,
  sendNewEventEmail,
  sendGuideFeedbackNotificationEmail,
};
