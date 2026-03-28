require('dotenv').config({ path: 'c:/Users/pitta/OneDrive/Desktop/Project Sphere/Project-Sphere-1/backend/.env' });
const mongoose = require('mongoose');

async function checkDetails() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected!');
    
    const Guide = mongoose.models.Guide || mongoose.model('Guide', new mongoose.Schema({ name: String, email: String }, { timestamps: true }));
    const Batch = mongoose.models.Batch || mongoose.model('Batch', new mongoose.Schema({ guideId: mongoose.Schema.Types.ObjectId, teamName: String }, { timestamps: true }));
    
    const sarayu = await Guide.findOne({ name: /Sarayu/i });
    if (sarayu) {
      console.log('Sarayu Guide:', { id: sarayu._id, email: sarayu.email, createdAt: sarayu.createdAt });
      
      const batch = await Batch.findOne({ teamName: 'S11' });
      if (batch) {
        console.log('Batch S11 Details:', { id: batch._id, teamName: batch.teamName, guideId: batch.guideId, createdAt: batch.createdAt, updatedAt: batch.updatedAt });
      }
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkDetails();
