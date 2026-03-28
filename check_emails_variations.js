require('dotenv').config({ path: 'c:/Users/pitta/OneDrive/Desktop/Project Sphere/Project-Sphere-1/backend/.env' });
const mongoose = require('mongoose');

async function checkEmails() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected!');
    
    const Guide = mongoose.models.Guide || mongoose.model('Guide', new mongoose.Schema({}, { strict: false }), 'guides');
    
    const emails = ['sarayupittal295@gmail.com', 'sarayupittala295@gmail.com'];
    for (const email of emails) {
      const g = await Guide.findOne({ email });
      console.log(`Search for ${email}:`, g ? 'FOUND' : 'NOT FOUND');
      if (g) console.log('Details:', { id: g._id, name: g.name, createdAt: g.createdAt });
    }
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err);
  }
}

checkEmails();
