const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');

dotenv.config();

// Import models
const Admin = require('./models/Admin');
const Guide = require('./models/Guide');
const COE = require('./models/COE');

const seedData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB Connected');

    // Create or repair Admin
    const existingAdmin = await Admin.findOne({ email: { $in: ['admin@gmail.com', 'admin@example.com'] } });
    if (!existingAdmin) {
      await Admin.create({
        name: 'System Admin',
        email: 'admin@gmail.com',
        password: 'Admin@123',
        department: 'Computer Science'
      });
      console.log('Admin created: admin@gmail.com / Admin@123');
    } else {
      if (existingAdmin.email !== 'admin@gmail.com') {
        existingAdmin.email = 'admin@gmail.com';
      }
      const matchesDefault = await existingAdmin.matchPassword('Admin@123');
      if (!matchesDefault) {
        existingAdmin.password = 'Admin@123';
        await existingAdmin.save();
        console.log('Admin password repaired: admin@gmail.com / Admin@123');
      } else {
        console.log('Admin already exists');
      }
      if (existingAdmin.email === 'admin@gmail.com') {
        await existingAdmin.save();
      }
    }

    // Create or repair a sample Guide
    const existingGuide = await Guide.findOne({ email: 'guide@example.com' });
    if (!existingGuide) {
      await Guide.create({
        name: 'Sample Guide',
        email: 'guide@example.com',
        password: 'guide123',
        department: 'Computer Science',
        specialization: 'Web Development'
      });
      console.log('Guide created: guide@example.com / guide123');
    } else {
      const matchesDefault = await existingGuide.matchPassword('guide123');
      if (!matchesDefault) {
        existingGuide.password = 'guide123';
        await existingGuide.save();
        console.log('Guide password repaired: guide@example.com / guide123');
      } else {
        console.log('Guide already exists');
      }
    }

    // Clear existing COEs first
    await COE.deleteMany({});
    console.log('Cleared existing COEs');

    // Create sample COEs
    const coes = [
      { name: 'Deep Learning', description: 'Deep neural networks and advanced ML models' },
      { name: 'Data Analytics', description: 'Data analysis, visualization and insights' },
      { name: 'Assistive Technology', description: 'Technology for accessibility and assistance' },
      { name: 'AR-VR', description: 'Augmented Reality and Virtual Reality projects' },
      { name: 'IoT', description: 'Internet of Things and connected devices' },
      { name: 'Advanced AI', description: 'Cutting-edge artificial intelligence applications' },
      { name: 'Cloud Computing', description: 'Cloud infrastructure and distributed systems' }
    ];

    for (const coe of coes) {
      const existing = await COE.findOne({ name: coe.name });
      if (!existing) {
        await COE.create(coe);
        console.log(`COE created: ${coe.name}`);
      }
    }

    console.log('\nSeed completed successfully!');
    console.log('\nLogin Credentials:');
    console.log('Admin: admin@example.com / admin123');
    console.log('Guide: guide@example.com / guide123');
    
    process.exit(0);
  } catch (error) {
    console.error('Error seeding data:', error.message);
    process.exit(1);
  }
};

seedData();

