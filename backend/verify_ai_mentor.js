const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const connectDB = require('./config/db');
const Batch = require('./models/Batch');
const ProblemStatement = require('./models/ProblemStatement');
const AIProblemStatement = require('./models/AIProblemStatement');
const ProjectRoadmap = require('./models/ProjectRoadmap');
const AIProgressAnalysis = require('./models/AIProgressAnalysis');

const aiRoadmapService = require('./services/aiRoadmapService');
const aiProgressMonitorService = require('./services/aiProgressMonitorService');

async function runVerification() {
  console.log('----------------------------------------------------');
  console.log('🤖 Starting AI Project Mentor & Progress Suite Verification');
  console.log('----------------------------------------------------');

  try {
    await connectDB();
    console.log('✅ Connected to MongoDB Database');

    // Fetch a sample batch or create a temporary mock batch
    let batch = await Batch.findOne().populate('problemId');
    if (!batch) {
      console.log('Creating sample batch for test...');
      batch = await Batch.create({
        teamName: 'Test AI Team Alpha',
        year: '3rd',
        branch: 'CSE',
        section: 'A',
        domain: 'AI & Machine Learning',
        allotmentStatus: 'allotted'
      });
    }

    console.log(`Using Test Batch: "${batch.teamName}" (ID: ${batch._id})`);

    // 1. Test AI Roadmap Generation
    console.log('\n--- 1. Testing AI Roadmap Generator ---');
    const sampleProblem = await AIProblemStatement.findOne({ domain: 'AI & Machine Learning' });
    const roadmap = await aiRoadmapService.generateRoadmapForBatch(batch, sampleProblem);

    console.log(`✅ Roadmap Generated Successfully!`);
    console.log(`  Title: ${roadmap.problemTitle}`);
    console.log(`  Domain: ${roadmap.domain}`);
    console.log(`  Milestone Phases: ${roadmap.milestones.length}`);
    console.log(`  Tech Stack: ${roadmap.techStack.join(', ')}`);
    console.log(`  Phase 1 Tasks: ${roadmap.milestones[0].tasks.length}`);

    if (!roadmap.milestones || roadmap.milestones.length !== 4) {
      throw new Error('Roadmap should contain 4 phases');
    }

    // 2. Test Task Completion Update
    console.log('\n--- 2. Testing Task Completion Update ---');
    roadmap.milestones[0].tasks[0].completed = true;
    roadmap.milestones[0].tasks[0].completedAt = new Date();
    await roadmap.save();
    console.log(`✅ Task completion updated! Task 1 status: ${roadmap.milestones[0].tasks[0].completed}`);

    // 3. Test AI Progress Monitor & Health Score Engine
    console.log('\n--- 3. Testing AI Progress Monitor & Health Score Engine ---');
    const analysis = await aiProgressMonitorService.analyzeBatchProgress(batch._id);

    console.log(`✅ Progress Analysis Completed Successfully!`);
    console.log(`  Health Score: ${analysis.healthScore}%`);
    console.log(`  Health Status: ${analysis.healthStatus}`);
    console.log(`  Completed Activities: ${analysis.completedActivities.length}`);
    console.log(`  Pending Activities: ${analysis.pendingActivities.length}`);
    console.log(`  Delayed Activities: ${analysis.delayedActivities.length}`);
    console.log(`  Adaptive Recommendations Generated: ${analysis.adaptiveRecommendations.length}`);

    if (analysis.adaptiveRecommendations.length > 0) {
      console.log('\nSample Adaptive Recommendation:');
      console.log(`  Title: ${analysis.adaptiveRecommendations[0].title}`);
      console.log(`  Message: ${analysis.adaptiveRecommendations[0].message}`);
      console.log(`  Action: ${analysis.adaptiveRecommendations[0].suggestedAction}`);
    }

    console.log('\n----------------------------------------------------');
    console.log('🎉 ALL AI MENTOR SUITE TESTS PASSED SUCCESSFULLY!');
    console.log('----------------------------------------------------');
    process.exit(0);
  } catch (err) {
    console.error('❌ Verification Failed:', err);
    process.exit(1);
  }
}

runVerification();
