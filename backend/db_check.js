require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    const Guide = require('./models/Guide');
    const guide = await Guide.findOne({ email: 'bhagya.ratkal@gnits.ac.in' }).select('+password');
    console.log(JSON.stringify(guide, null, 2));

    const allGuides = await Guide.find().select('name email');
    console.log("All Guides:", allGuides);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
