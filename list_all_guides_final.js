require('dotenv').config({ path: 'c:/Users/pitta/OneDrive/Desktop/Project Sphere/Project-Sphere-1/backend/.env' });
const mongoose = require('mongoose');

async function listAllGuides() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected!');
    
    const Guide = mongoose.models.Guide || mongoose.model('Guide', new mongoose.Schema({}, { strict: false }), 'guides');
    
    const guides = await Guide.find();
    console.log('All Guides in DB:', guides.map(g => ({ name: g.name, email: g.email })));
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

listAllGuides();
