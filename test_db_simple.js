require('dotenv').config({ path: 'c:/Users/pitta/OneDrive/Desktop/Project Sphere/Project-Sphere-1/backend/.env' });
const mongoose = require('mongoose');

async function testConn() {
  try {
    console.log('Connecting to:', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected!');
    
    const Guide = mongoose.model('Guide', new mongoose.Schema({ name: String, email: String }));
    const count = await Guide.countDocuments();
    console.log('Total Guides:', count);
    
    const sarayus = await Guide.find({ name: /Sarayu/i });
    console.log('Sarayus:', sarayus);
    
    await mongoose.disconnect();
  } catch (err) {
    console.error('Connection Error:', err);
  }
}

testConn();
