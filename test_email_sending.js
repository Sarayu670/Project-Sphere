require('dotenv').config({ path: 'c:/Users/pitta/OneDrive/Desktop/Project Sphere/Project-Sphere-1/backend/.env' });
const { sendGuideSubmissionEmail } = require('./backend/utils/mailer');

async function testMail() {
  console.log('Testing email notification...');
  console.log('SMTP Config:', {
    host: process.env.SMTP_HOST,
    user: process.env.SMTP_USER,
    from: process.env.SMTP_FROM
  });

  const mockBatch = {
    teamName: 'TEST-TEAM-01',
    guideId: {
      name: 'Test Guide',
      email: 'sarayupittala295@gmail.com' // Sending to the user's test guide email
    },
    problemId: {
      title: 'Test Project Title'
    }
  };

  const mockSubmission = {
    timelineId: {
      title: 'Test Timeline Event'
    },
    googleDriveLink: 'https://drive.google.com/test'
  };

  try {
    await sendGuideSubmissionEmail(mockBatch, mockSubmission);
    console.log('Email sent successfully (or at least no error thrown).');
  } catch (error) {
    console.error('Failed to send email:', error);
  }
}

testMail();
