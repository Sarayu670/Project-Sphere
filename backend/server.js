const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Enable CORS with proper headers for file downloads
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Serve static files for uploads with proper headers
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, path, stat) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    
    // Set proper content type for PDFs
    if (path.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
    }
  }
}));

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
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/projects', require('./routes/projectRoutes'));

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is running' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

