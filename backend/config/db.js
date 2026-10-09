const mongoose = require('mongoose');

const connectDB = async () => {
  const maxRetries = 5;
  let retries = 0;

  const connect = async () => {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 10000,
      });
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      
      // Auto-repair any imported guide default passwords
      setTimeout(async () => {
        try {
          const Guide = require('../models/Guide');
          const bcrypt = require('bcryptjs');
          const guides = await Guide.find({}).select('+password');
          for (const guide of guides) {
            const matchesDefault = await bcrypt.compare('defaultPassword123', guide.password);
            const isSwetha = guide.email === 'swetha@gnits.ac.in';
            const isGnits = await bcrypt.compare('gnits@123', guide.password);
            
            if (matchesDefault || (isSwetha && !isGnits)) {
              guide.password = 'gnits@123';
              await guide.save();
              console.log(`[DB-REPAIR] Fixed default password for guide: ${guide.email} -> gnits@123`);
            }
          }
        } catch (repairErr) {
          console.error('[DB-REPAIR] Guide password check error:', repairErr.message);
        }
      }, 1000);

      return true;
    } catch (error) {
      console.error(`Error: ${error.message}`);
      return false;
    }
  };

  const connected = await connect();

  if (!connected) {
    console.log('Initial connection failed. Server will continue running.');
    console.log('Please whitelist your IP in MongoDB Atlas: https://www.mongodb.com/docs/atlas/security-whitelist/');

    // Retry in background
    const retryConnection = async () => {
      while (retries < maxRetries) {
        retries++;
        console.log(`Retrying MongoDB connection (${retries}/${maxRetries})...`);
        await new Promise(resolve => setTimeout(resolve, 10000));
        const success = await connect();
        if (success) return;
      }
      console.log('Max retries reached. Please check your MongoDB connection.');
    };

    retryConnection();
  }
};

module.exports = connectDB;

