require('dotenv').config({ path: 'c:/Users/pitta/OneDrive/Desktop/Project Sphere/Project-Sphere-1/backend/.env' });
const mongoose = require('mongoose');

async function checkSarayu() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected!');
    
    const Guide = mongoose.model('Guide', new mongoose.Schema({ name: String, email: String }));
    const Batch = mongoose.model('Batch', new mongoose.Schema({ guideId: mongoose.Schema.Types.ObjectId, teamName: String }));
    
    const sarayus = await Guide.find({ name: /Sarayu/i });
    console.log('Sarayu Guides:', sarayus);
    
    for (const guide of sarayus) {
      const batches = await Batch.find({ guideId: guide._id });
      console.log(`Batches for ${guide.name} (${guide._id}):`, batches);
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkSarayu();
