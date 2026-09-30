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

// Enable CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Root Route (IMPORTANT FIX)
app.get('/', (req, res) => {
  res.status(200).send('Project Sphere Backend Running 🚀');
});

// Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, filePath, stat) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

    if (filePath.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
    }
  }
}));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/coe', require('./routes/coeRoutes'));
app.use('/api/rc', require('./routes/rcRoutes'));
app.use('/api/guides', require('./routes/guideRoutes'));
app.use('/api/problems', require('./routes/problemRoutes'));
app.use('/api/batches', require('./routes/batchRoutes'));
app.use('/api/team-members', require('./routes/teamMemberRoutes'));
app.use('/api/progress', require('./routes/progressRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/timeline', require('./routes/timelineRoutes'));
app.use('/api/meetings', require('./routes/meetingRoutes'));
app.use('/api/submissions', require('./routes/submissionRoutes'));
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/projects', require('./routes/projectRoutes'));
app.use('/api/ai-problems', require('./routes/aiProblemRoutes'));
app.use('/api/ai-mentor', require('./routes/aiMentorRoutes'));



// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is running' });
});

// SPA catch-all: serve React's index.html for any non-API route
// This fixes page refresh on /coordinator, /dashboard, etc. in production
const distPath = path.join(__dirname, '../frontend/dist');
const fs = require('fs');
if (fs.existsSync(distPath)) {
  // Serve built frontend static files
  app.use(express.static(distPath));
  // Catch-all: return index.html for any route not matched above
  app.use((req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // Development: just return 404 for unknown API routes
  app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
  });
}

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});