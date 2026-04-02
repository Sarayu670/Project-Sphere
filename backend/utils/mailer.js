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
 * Send email notification to all students and guides when a new event is added
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

module.exports = {
  sendGuideSubmissionEmail,
  sendNewEventEmail,
};
