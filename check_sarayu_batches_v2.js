require('dotenv').config({ path: 'c:/Users/pitta/OneDrive/Desktop/Project Sphere/Project-Sphere-1/backend/.env' });
const mongoose = require('mongoose');

async function checkSarayu() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected!');
    
    // Explicitly define schemas to avoid Mongoose errors
    const GuideSchema = new mongoose.Schema({ name: String, email: String }, { collection: 'guides' });
    const Guide = mongoose.models.Guide || mongoose.model('Guide', GuideSchema);
    
    const BatchSchema = new mongoose.Schema({ guideId: mongoose.Schema.Types.ObjectId, teamName: String }, { collection: 'batches' });
    const Batch = mongoose.models.Batch || mongoose.model('Batch', BatchSchema);
    
    const sarayus = await Guide.find({ name: /Sarayu/i });
    console.log('Guide details:', sarayus.map(g => ({ id: g._id, name: g.name, email: g.email })));
    
    for (const guide of sarayus) {
      const batches = await Batch.find({ guideId: guide._id });
      console.log(`Batches for ${guide.name} (${guide._id}):`, batches.map(b => ({ id: b._id, teamName: b.teamName })));
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkSarayu();
