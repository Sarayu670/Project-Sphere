require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('./models/Student');
const Batch = require('./models/Batch');

async function fixDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const students = await Student.find({}).populate('batchId');
    let updated = 0;

    for (const student of students) {
      const correctEmail = `${student.rollNumber.toLowerCase()}@gnits.ac.in`;
      
      let passToSet = student.rollNumber; // fallback
      if (student.batchId && student.batchId.teamName) {
        passToSet = `${student.batchId.teamName}@123`;
      } else {
         // Maybe team leader has some standard password?
         passToSet = `teamNo@123`; // generic fallback if no team
      }

      student.email = correctEmail;
      student.password = passToSet;
      await student.save();
      
      console.log(`Updated ${student.rollNumber} -> Email: ${student.email}`);
      updated++;
    }

    console.log(`Done processing. Total updated: ${updated}`);
    process.exit(0);
  } catch (error) {
    console.error('Error fixing DB', error);
    process.exit(1);
  }
}

fixDB();
