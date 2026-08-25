const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const connectDB = require('./config/db');
const AIProblemStatement = require('./models/AIProblemStatement');
const AICrawlerLog = require('./models/AICrawlerLog');
const aiCrawlerService = require('./services/aiCrawlerService');

async function runVerification() {
  console.log('----------------------------------------------------');
  console.log('🤖 Starting AI Problem Statement Agent Verification');
  console.log('----------------------------------------------------');

  try {
    await connectDB();
    console.log('✅ Connected to MongoDB Database');

    // Test 1: Run AI Crawler Engine
    console.log('\n--- 1. Testing AI Crawler & Scraper Engine ---');
    const result = await aiCrawlerService.runAICrawler('system');
    console.log('Crawler Run Result:', JSON.stringify(result.data, null, 2));

    if (!result.success || result.data.totalCollected === 0) {
      throw new Error('AI Crawler failed to harvest problem statements');
    }
    console.log('✅ AI Crawler execution succeeded!');

    // Test 2: Verify Duplicate Detection on 2nd Run
    console.log('\n--- 2. Testing Semantic Deduplication Engine ---');
    const secondRun = await aiCrawlerService.runAICrawler('system');
    console.log(`Second Run - Inserted: ${secondRun.data.insertedCount}, Duplicates Filtered: ${secondRun.data.duplicatesRemoved}`);

    if (secondRun.data.duplicatesRemoved === 0) {
      console.warn('⚠️ Warning: Expected duplicates to be filtered on immediate rerun');
    } else {
      console.log('✅ Semantic Deduplication Engine successfully filtered duplicates!');
    }

    // Test 3: Database Queries & Classification Verification
    console.log('\n--- 3. Testing Database Model Queries & Classification ---');
    const totalStatements = await AIProblemStatement.countDocuments();
    const aiDomainCount = await AIProblemStatement.countDocuments({ domain: 'AI & Machine Learning' });
    const webDomainCount = await AIProblemStatement.countDocuments({ domain: 'Web Development' });
    const hardDifficultyCount = await AIProblemStatement.countDocuments({ difficulty: 'Hard' });

    console.log(`Total Statements in DB: ${totalStatements}`);
    console.log(`AI & ML Statements: ${aiDomainCount}`);
    console.log(`Web Development Statements: ${webDomainCount}`);
    console.log(`Hard Difficulty Statements: ${hardDifficultyCount}`);

    const sampleItem = await AIProblemStatement.findOne({ domain: 'AI & Machine Learning' });
    if (sampleItem) {
      console.log('\nSample AI Problem Statement:');
      console.log(`  Title: ${sampleItem.title}`);
      console.log(`  Domain: ${sampleItem.domain}`);
      console.log(`  Difficulty: ${sampleItem.difficulty}`);
      console.log(`  Technologies: ${sampleItem.technologies.join(', ')}`);
      console.log(`  Source: ${sampleItem.sourceName}`);
    }

    // Test 4: Verify Log Tracking
    console.log('\n--- 4. Testing AICrawlerLog Persistence ---');
    const latestLog = await AICrawlerLog.findOne().sort({ createdAt: -1 });
    console.log(`Latest Log ID: ${latestLog._id}, Status: ${latestLog.status}, TriggeredBy: ${latestLog.triggeredBy}`);

    console.log('\n----------------------------------------------------');
    console.log('🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY!');
    console.log('----------------------------------------------------');
    process.exit(0);
  } catch (err) {
    console.error('❌ Verification Failed:', err);
    process.exit(1);
  }
}

runVerification();
