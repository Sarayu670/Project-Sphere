require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('./models/Student');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const byBranch = await Student.aggregate([{ $group: { _id: '$branch', count: { $sum: 1 } } }]);
  console.log('Students by branch:');
  byBranch.forEach(b => console.log(` - ${b._id || 'null/empty'}: ${b.count}`));

  const noBranch = await Student.countDocuments({ $or: [{ branch: { $exists: false } }, { branch: null }, { branch: '' }] });
  console.log(`\nStudents with NO branch set: ${noBranch}`);

  await mongoose.disconnect();
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
