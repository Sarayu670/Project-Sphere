require('dotenv').config({ path: 'c:/Users/pitta/OneDrive/Desktop/Project Sphere/Project-Sphere-1/backend/.env' });
const mongoose = require('mongoose');

async function checkSpecificEmail() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected!');
    
    const Guide = mongoose.models.Guide || mongoose.model('Guide', new mongoose.Schema({}, { strict: false }), 'guides');
    
    const guide = await Guide.findOne({ email: 'sarayupittal295@gmail.com' });
    console.log('Guide found for sarayupittal295@gmail.com:', guide);
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkSpecificEmail();
