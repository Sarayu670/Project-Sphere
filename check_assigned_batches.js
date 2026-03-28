require('dotenv').config({ path: 'c:/Users/pitta/OneDrive/Desktop/Project Sphere/Project-Sphere-1/backend/.env' });
const mongoose = require('mongoose');

async function checkBatches() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected!');
    
    const Guide = mongoose.models.Guide || mongoose.model('Guide', new mongoose.Schema({}, { strict: false }), 'guides');
    const Batch = mongoose.models.Batch || mongoose.model('Batch', new mongoose.Schema({}, { strict: false }), 'batches');
    
    const guide = await Guide.findOne({ email: 'sarayupittala295@gmail.com' });
    if (guide) {
      console.log('Guide found:', guide.name, '(', guide._id, ')');
      const batches = await Batch.find({ guideId: guide._id });
      console.log('Batches assigned to this guide:', batches.map(b => b.teamName));
    } else {
      console.log('Guide not found.');
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkBatches();
