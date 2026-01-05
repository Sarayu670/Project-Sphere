const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Body parser
app.use(express.json());

// Enable CORS
app.use(cors());

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/coe', require('./routes/coeRoutes'));
app.use('/api/guides', require('./routes/guideRoutes'));
app.use('/api/problems', require('./routes/problemRoutes'));
app.use('/api/batches', require('./routes/batchRoutes'));
app.use('/api/team-members', require('./routes/teamMemberRoutes'));
app.use('/api/progress', require('./routes/progressRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/timeline', require('./routes/timelineRoutes'));
app.use('/api/submissions', require('./routes/submissionRoutes'));

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is running' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

