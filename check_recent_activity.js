require('dotenv').config({ path: 'c:/Users/pitta/OneDrive/Desktop/Project Sphere/Project-Sphere-1/backend/.env' });
const mongoose = require('mongoose');

async function checkRecent() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected!');
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const Guide = mongoose.models.Guide || mongoose.model('Guide', new mongoose.Schema({}, { strict: false }), 'guides');
    const Batch = mongoose.models.Batch || mongoose.model('Batch', new mongoose.Schema({}, { strict: false }), 'batches');
    const Submission = mongoose.models.Submission || mongoose.model('Submission', new mongoose.Schema({}, { strict: false }), 'submissions');
    
    const recentGuides = await Guide.find({ createdAt: { $gt: oneHourAgo } });
    console.log('Recent Guides:', recentGuides);
    
    const recentSubmissions = await Submission.find({ updatedAt: { $gt: oneHourAgo } });
    console.log('Recent Submissions Count:', recentSubmissions.length);
    
    if (recentSubmissions.length > 0) {
      for (const sub of recentSubmissions) {
        const batch = await Batch.findById(sub.batchId);
        console.log('Submission for batch:', batch ? batch.teamName : 'Unknown', 'at', sub.updatedAt);
      }
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkRecent();
