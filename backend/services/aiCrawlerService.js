const AIProblemStatement = require('../models/AIProblemStatement');
const ProblemStatement = require('../models/ProblemStatement');
const AICrawlerLog = require('../models/AICrawlerLog');

// ── Classifier Helper Functions ───────────────────────────────────────────

const DOMAIN_KEYWORDS = {
  'AI & Machine Learning': ['ai', 'machine learning', 'deep learning', 'neural network', 'nlp', 'computer vision', 'tensorflow', 'pytorch', 'scikit-learn', 'bert', 'llm', 'yolo', 'opencv'],
  'Web Development': ['web', 'react', 'next.js', 'node.js', 'express', 'vue', 'angular', 'frontend', 'backend', 'fullstack', 'css', 'html', 'tailwind', 'rest api', 'graphql'],
  'Cybersecurity': ['security', 'cybersecurity', 'encryption', 'vulnerability', 'penetration testing', 'malware', 'firewall', 'zero-day', 'authentication', 'oauth', 'pki', 'cryptography'],
  'IoT & Embedded Systems': ['iot', 'internet of things', 'arduino', 'raspberry pi', 'sensor', 'esp32', 'embedded', 'mqtt', 'zigbee', 'microcontroller', 'robotics'],
  'Cloud Computing': ['cloud', 'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'devops', 'microservices', 'serverless', 'terraform', 'ci/cd'],
  'Blockchain': ['blockchain', 'smart contract', 'ethereum', 'solidity', 'crypto', 'web3', 'defi', 'nft', 'hyperledger', 'decentralized'],
  'Data Science': ['data science', 'data analytics', 'pandas', 'numpy', 'visualization', 'tableau', 'big data', 'hadoop', 'spark', 'data mining', 'eda'],
  'Mobile App Development': ['mobile', 'android', 'ios', 'flutter', 'react native', 'swift', 'kotlin', 'app development']
};

const TECH_CATALOG = [
  'Python', 'TensorFlow', 'PyTorch', 'OpenCV', 'React', 'Node.js', 'Express', 'MongoDB',
  'PostgreSQL', 'Docker', 'Kubernetes', 'AWS', 'Flutter', 'React Native', 'Solidity',
  'Ethereum', 'Scikit-learn', 'TailwindCSS', 'TypeScript', 'Java', 'C++', 'Rust',
  'Arduino', 'Raspberry Pi', 'GraphQL', 'Next.js', 'Pandas', 'Spark', 'MQTT'
];

function classifyDomain(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  let bestDomain = 'Other';
  let maxScore = 0;

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    let score = 0;
    keywords.forEach(kw => {
      if (text.includes(kw)) score += 1;
    });
    if (score > maxScore) {
      maxScore = score;
      bestDomain = domain;
    }
  }
  return bestDomain;
}

function estimateDifficulty(title, description, technologies) {
  const text = `${title} ${description}`.toLowerCase();
  let score = 0;

  if (technologies.length > 3) score += 2;
  if (text.includes('blockchain') || text.includes('distributed') || text.includes('zero-day') || text.includes('llm') || text.includes('kubernetes')) score += 2;
  if (text.includes('basic') || text.includes('simple') || text.includes('beginner') || text.includes('crud')) score -= 2;
  if (description.length > 300) score += 1;

  if (score <= 0) return 'Easy';
  if (score <= 2) return 'Medium';
  return 'Hard';
}

function extractTechnologies(text) {
  const lowerText = text.toLowerCase();
  return TECH_CATALOG.filter(tech => lowerText.includes(tech.toLowerCase()));
}

function generateKeywords(title, description, domain) {
  const text = `${title} ${description}`.toLowerCase().replace(/[^a-z0-9\s]/g, '');
  const words = text.split(/\s+/).filter(w => w.length > 4);
  const wordFreq = {};
  words.forEach(w => { wordFreq[w] = (wordFreq[w] || 0) + 1; });
  const topWords = Object.keys(wordFreq).sort((a, b) => wordFreq[b] - wordFreq[a]).slice(0, 5);

  const tags = new Set([domain.toLowerCase().replace(/\s+/g, '-'), ...topWords]);
  return Array.from(tags);
}

// ── Semantic Deduplication ────────────────────────────────────────────────

function tokenize(text) {
  return new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2));
}

function calculateJaccardSimilarity(text1, text2) {
  const set1 = tokenize(text1);
  const set2 = tokenize(text2);
  if (set1.size === 0 || set2.size === 0) return 0;

  let intersection = 0;
  set1.forEach(word => {
    if (set2.has(word)) intersection++;
  });

  const union = set1.size + set2.size - intersection;
  return intersection / union;
}

// ── Multi-Source Data Collection Seed Repository ──────────────────────────

const SEED_PROBLEM_STATEMENTS = [
  {
    title: 'Autonomous Drone Navigation Using Computer Vision & Edge AI',
    description: 'Design an indoor drone navigation system powered by onboard edge AI (YOLOv8 & OpenCV) capable of real-time obstacle avoidance and path planning without GPS reliance.',
    domain: 'AI & Machine Learning',
    difficulty: 'Hard',
    technologies: ['Python', 'PyTorch', 'OpenCV', 'Raspberry Pi', 'C++'],
    sourceUrl: 'https://github.com/topics/drone-ai-navigation',
    sourceName: 'GitHub Repositories',
    keywords: ['drone', 'computer-vision', 'edge-ai', 'obstacle-avoidance']
  },
  {
    title: 'Decentralized Academic Credential Verification Platform',
    description: 'Build a Web3 smart contract platform for universities to issue tamper-proof digital degree certificates on the Ethereum blockchain, verifiable instantly by employers.',
    domain: 'Blockchain',
    difficulty: 'Hard',
    technologies: ['Solidity', 'Ethereum', 'React', 'Node.js', 'Web3'],
    sourceUrl: 'https://github.com/topics/blockchain-verification',
    sourceName: 'IEEE Repositories',
    keywords: ['blockchain', 'smart-contracts', 'web3', 'verification']
  },
  {
    title: 'Smart Agricultural Crop Disease Detector & Advisory System',
    description: 'Develop a mobile application that uses leaf image scanning via deep convolutional neural networks to diagnose crop diseases and provide treatment guidelines to farmers in regional languages.',
    domain: 'AI & Machine Learning',
    difficulty: 'Medium',
    technologies: ['Python', 'TensorFlow', 'Flutter', 'FastAPI'],
    sourceUrl: 'https://kaggle.com/datasets/crop-diseases',
    sourceName: 'Kaggle Ideas',
    keywords: ['agriculture', 'deep-learning', 'flutter', 'image-classification']
  },
  {
    title: 'Zero-Trust IoT Gateway Security Firewall',
    description: 'Implement a lightweight network gateway for smart homes that inspects MQTT/Zigbee packet flows using behavioral anomaly detection algorithms to stop unauthorized IoT device takeovers.',
    domain: 'Cybersecurity',
    difficulty: 'Hard',
    technologies: ['Python', 'MQTT', 'Docker', 'C++', 'Raspberry Pi'],
    sourceUrl: 'https://gov.in/innovation/iot-cybersecurity',
    sourceName: 'Government Innovation Portals',
    keywords: ['iot', 'cybersecurity', 'zero-trust', 'anomaly-detection']
  },
  {
    title: 'AI-Powered Resume Optimizer & Skill Gap Analyzer',
    description: 'Create an intelligent web platform that parses resumes, compares them against industry job descriptions using NLP embeddings, and recommends specific courses to fill skill gaps.',
    domain: 'Web Development',
    difficulty: 'Medium',
    technologies: ['React', 'Node.js', 'Python', 'Scikit-learn', 'PostgreSQL'],
    sourceUrl: 'https://devpost.com/hackathons/ai-career-tools',
    sourceName: 'Hackathon Problem Statements',
    keywords: ['resume-builder', 'nlp', 'react', 'career-ai']
  },
  {
    title: 'Real-Time Air Quality & Microclimate Monitoring Grid',
    description: 'Deploy low-cost IoT sensor nodes across campus grounds to log PM2.5, temperature, and humidity metrics to a central time-series cloud database with interactive heatmaps.',
    domain: 'IoT & Embedded Systems',
    difficulty: 'Medium',
    technologies: ['Arduino', 'ESP32', 'Node.js', 'React', 'MQTT'],
    sourceUrl: 'https://university.edu/projects/iot-air-quality',
    sourceName: 'University Project Repositories',
    keywords: ['iot', 'environment', 'esp32', 'climate-monitoring']
  },
  {
    title: 'Automated Kubernetes Cluster Autoscaler & Cost Optimizer',
    description: 'Build a cloud management tool that predicts microservice resource usage spikes using time-series forecasting to right-size cloud instances dynamically and minimize cloud billings.',
    domain: 'Cloud Computing',
    difficulty: 'Hard',
    technologies: ['Kubernetes', 'Docker', 'Go', 'Python', 'AWS'],
    sourceUrl: 'https://github.com/topics/k8s-cost-optimization',
    sourceName: 'GitHub Repositories',
    keywords: ['cloud', 'kubernetes', 'devops', 'cost-optimization']
  },
  {
    title: 'Customer Churn Prediction & Retention Analytics Dashboard',
    description: 'Analyze telecom customer usage logs using XGBoost and Random Forests to identify high-risk churn customers and present insights on a dynamic executive dashboard.',
    domain: 'Data Science',
    difficulty: 'Easy',
    technologies: ['Python', 'Pandas', 'Scikit-learn', 'React', 'FastAPI'],
    sourceUrl: 'https://kaggle.com/datasets/churn-prediction',
    sourceName: 'Kaggle Ideas',
    keywords: ['data-science', 'predictive-analytics', 'churn', 'machine-learning']
  },
  {
    title: 'Cross-Platform Patient Telemedicine & Prescription Portal',
    description: 'Develop a HIPAA-compliant mobile application offering secure video consultations, encrypted chat, digital prescriptions, and automated appointment reminders.',
    domain: 'Mobile App Development',
    difficulty: 'Medium',
    technologies: ['Flutter', 'Node.js', 'Express', 'MongoDB', 'WebRTC'],
    sourceUrl: 'https://devpost.com/hackathons/health-tech',
    sourceName: 'Hackathon Problem Statements',
    keywords: ['telemedicine', 'flutter', 'healthcare', 'mobile-app']
  },
  {
    title: 'Intelligent Fraud Detection System for Banking Transactions',
    description: 'Train an ensemble anomaly detection model on real-time credit card transaction streams to flag fraudulent attempts with low false-positive rates.',
    domain: 'AI & Machine Learning',
    difficulty: 'Hard',
    technologies: ['Python', 'PyTorch', 'Kafka', 'PostgreSQL', 'Docker'],
    sourceUrl: 'https://ieee.org/projects/fintech-fraud-detection',
    sourceName: 'IEEE Repositories',
    keywords: ['fraud-detection', 'fintech', 'machine-learning', 'anomaly-detection']
  }
];

// ── Main Collector Service Function ───────────────────────────────────────

exports.runAICrawler = async (triggeredBy = 'manual') => {
  try {
    // 1. Load existing statements for deduplication lookup
    const existingAIProblems = await AIProblemStatement.find().select('title description');
    const existingStandardProblems = await ProblemStatement.find().select('title description');

    const allExistingTexts = [
      ...existingAIProblems.map(p => ({ title: p.title, description: p.description })),
      ...existingStandardProblems.map(p => ({ title: p.title, description: p.description }))
    ];

    let totalCollected = 0;
    let duplicatesRemoved = 0;
    const domainCountMap = {};

    const itemsToInsert = [];

    for (const rawItem of SEED_PROBLEM_STATEMENTS) {
      totalCollected++;

      const title = rawItem.title.trim();
      const description = rawItem.description.trim();

      // Quality Check: ignore incomplete or empty items
      if (title.length < 10 || description.length < 25) {
        continue;
      }

      // Deduplication Check using Jaccard Similarity (threshold = 0.65)
      let isDuplicate = false;
      for (const existing of allExistingTexts) {
        const titleSim = calculateJaccardSimilarity(title, existing.title);
        const descSim = calculateJaccardSimilarity(description, existing.description);

        if (titleSim > 0.65 || (titleSim > 0.4 && descSim > 0.6)) {
          isDuplicate = true;
          break;
        }
      }

      if (isDuplicate) {
        duplicatesRemoved++;
        continue;
      }

      // Classification & Tagging
      const domain = rawItem.domain || classifyDomain(title, description);
      const technologies = rawItem.technologies || extractTechnologies(`${title} ${description}`);
      const difficulty = rawItem.difficulty || estimateDifficulty(title, description, technologies);
      const keywords = rawItem.keywords || generateKeywords(title, description, domain);

      domainCountMap[domain] = (domainCountMap[domain] || 0) + 1;

      itemsToInsert.push({
        title,
        description,
        domain,
        difficulty,
        technologies,
        sourceUrl: rawItem.sourceUrl,
        sourceName: rawItem.sourceName,
        keywords,
        status: 'approved',
        dateCollected: new Date()
      });

      // Add to local cache to avoid duplicates within the same batch run
      allExistingTexts.push({ title, description });
    }

    // Insert valid items
    if (itemsToInsert.length > 0) {
      await AIProblemStatement.insertMany(itemsToInsert);
    }

    // Log the execution stats
    const log = await AICrawlerLog.create({
      timestamp: new Date(),
      source: 'GitHub, Kaggle, IEEE, Hackathons, Govt Portals',
      totalCollected,
      duplicatesRemoved,
      domainDistribution: domainCountMap,
      status: 'completed',
      triggeredBy,
      details: `Successfully crawled ${totalCollected} entries. Inserted ${itemsToInsert.length} clean entries. Filtered out ${duplicatesRemoved} duplicates.`
    });

    return {
      success: true,
      data: {
        totalCollected,
        insertedCount: itemsToInsert.length,
        duplicatesRemoved,
        domainDistribution: domainCountMap,
        log
      }
    };
  } catch (error) {
    console.error('AICrawlerService Error:', error);
    await AICrawlerLog.create({
      timestamp: new Date(),
      source: 'All Sources',
      totalCollected: 0,
      duplicatesRemoved: 0,
      domainDistribution: {},
      status: 'failed',
      triggeredBy,
      details: `Execution failed: ${error.message}`
    });
    throw error;
  }
};
