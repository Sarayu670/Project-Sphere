require('dotenv').config({ path: 'c:/Users/pitta/OneDrive/Desktop/Project Sphere/Project-Sphere-1/backend/.env' });
const mongoose = require('mongoose');

async function listSarayus() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected!');
    
    const Guide = mongoose.models.Guide || mongoose.model('Guide', new mongoose.Schema({}, { strict: false }), 'guides');
    
    const sarayus = await Guide.find({ name: /Sarayu/i });
    console.log('All Sarayu Guides:', sarayus.map(g => ({ id: g._id, name: g.name, email: g.email, createdAt: g.createdAt })));
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

listSarayus();
