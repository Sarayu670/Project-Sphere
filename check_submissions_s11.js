require('dotenv').config({ path: 'c:/Users/pitta/OneDrive/Desktop/Project Sphere/Project-Sphere-1/backend/.env' });
const mongoose = require('mongoose');

async function checkSubmissions() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected!');
    
    const Batch = mongoose.model('Batch', new mongoose.Schema({ teamName: String }), 'batches');
    const Submission = mongoose.model('Submission', new mongoose.Schema({ batchId: mongoose.Schema.Types.ObjectId, status: String, updatedAt: Date }), 'submissions');
    
    const batch = await Batch.findOne({ teamName: 'S11' });
    if (batch) {
      const submissions = await Submission.find({ batchId: batch._id }).sort({ updatedAt: -1 });
      console.log(`Submissions for batch S11 (${batch._id}):`, submissions);
    } else {
      console.log('Batch S11 not found.');
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkSubmissions();
