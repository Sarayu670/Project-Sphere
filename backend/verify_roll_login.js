require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const Student = require('./models/Student');
    const loginTerm = '22251a05e9'; // example roll number
    
    // Test the logic I added to authController
    const user = await Student.findOne({
      $or: [
        { email: loginTerm.toLowerCase() },
        { rollNumber: { $regex: new RegExp(`^${loginTerm}$`, 'i') } }
      ]
    });
    
    if (user) {
      console.log('Found user by roll number:', user.email);
    } else {
      console.log('User not found by roll number');
    }
    
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
