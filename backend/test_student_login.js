require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const Student = require('./models/Student');
    const s = await Student.findOne({ email: '22251a05e9@gnits.ac.in' }).select('+password');
    if (!s) {
      console.log('Student not found');
      process.exit(0);
    }
    console.log('Student found:', s.email);
    console.log('Password hash:', s.password);
    
    // Check if it matches C2@123
    const matchC2 = await bcrypt.compare('C2@123', s.password);
    console.log('Matches C2@123:', matchC2);

    // Check if it matches C1@123
    const matchC1 = await bcrypt.compare('C1@123', s.password);
    console.log('Matches C1@123:', matchC1);

    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
