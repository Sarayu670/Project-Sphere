require('dotenv').config({ path: 'c:/Users/pitta/OneDrive/Desktop/Project Sphere/Project-Sphere-1/backend/.env' });
const mongoose = require('mongoose');
const Guide = require('./backend/models/Guide');

async function checkGuide() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const guides = await Guide.find({ name: /Sarayu/i });
    console.log('Guides found matching "Sarayu":', guides);
    
    if (guides.length === 0) {
      const allGuides = await Guide.find().limit(10);
      console.log('First 10 guides in DB:', allGuides.map(g => ({ name: g.name, email: g.email })));
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkGuide();
