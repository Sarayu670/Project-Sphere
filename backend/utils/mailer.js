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

module.exports = {
  sendGuideSubmissionEmail,
};
