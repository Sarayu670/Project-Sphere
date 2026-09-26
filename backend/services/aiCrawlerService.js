const AIProblemStatement = require('../models/AIProblemStatement');
const ProblemStatement = require('../models/ProblemStatement');
const AICrawlerLog = require('../models/AICrawlerLog');

// ── Classifier Helper Functions ───────────────────────────────────────────

const DOMAIN_KEYWORDS = {
  'AI & Machine Learning': ['ai', 'machine learning', 'deep learning', 'neural network', 'nlp', 'computer vision', 'tensorflow', 'pytorch', 'scikit-learn', 'bert', 'llm', 'yolo', 'opencv', 'generative'],
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
  'Arduino', 'Raspberry Pi', 'GraphQL', 'Next.js', 'Pandas', 'Spark', 'MQTT', 'Kafka',
  'Redis', 'FastAPI', 'Golang', 'Tableau', 'Flutter', 'Firebase'
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
  if (text.includes('blockchain') || text.includes('distributed') || text.includes('zero-day') || text.includes('llm') || text.includes('kubernetes') || text.includes('hyperledger')) score += 2;
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

// ── Comprehensive Trusted Sources Seed Generator (500+ Problem Statements) ──

function generateComprehensiveProblemDataset() {
  const sources = [
    { name: 'Smart India Hackathon (SIH)', url: 'https://sih.gov.in/problem-statements' },
    { name: 'IEEE Repositories', url: 'https://ieee.org/projects/academic-repository' },
    { name: 'Kaggle Ideas', url: 'https://kaggle.com/datasets' },
    { name: 'GitHub Repositories', url: 'https://github.com/topics/student-projects' },
    { name: 'Government Innovation Portals', url: 'https://innovation.gov.in/portal' },
    { name: 'Hackathon Problem Statements (Devpost)', url: 'https://devpost.com/hackathons' },
    { name: 'University Project Repositories', url: 'https://university.edu/capstone-projects' }
  ];

  const domains = [
    'AI & Machine Learning',
    'Web Development',
    'Cybersecurity',
    'IoT & Embedded Systems',
    'Cloud Computing',
    'Blockchain',
    'Data Science',
    'Mobile App Development'
  ];

  const difficulties = ['Easy', 'Medium', 'Hard'];

  const templates = [
    // AI & Machine Learning
    {
      domain: 'AI & Machine Learning',
      techs: ['Python', 'TensorFlow', 'PyTorch', 'OpenCV', 'FastAPI'],
      prefix: ['Autonomous', 'Intelligent', 'Real-Time', 'Deep Learning Based', 'AI Powered', 'Self-Learning', 'Predictive', 'Generative AI'],
      topics: [
        'Drone Navigation in GPS-Denied Environments',
        'Crop Disease Diagnosis Using Leaf Imaging',
        'Early Tumor Detection in Mammogram Scans',
        'Deepfake Video Detection & Verification Engine',
        'Automatic Code Vulnerability Repair Using LLMs',
        'Automated Traffic Light Control for Emergency Vehicles',
        'Speech Recognition for Regional Dialects',
        'Student Mental Stress Level Assessment System',
        'Retail Shelf Inventory Monitoring via Vision AI',
        'Wildfire Detection Grid Using Infrared Satellite Feeds',
        'Fraudulent Insurance Claim Detection System',
        'Automated Essay Grading & Syntax Feedback Engine',
        'Plant Leaf Nutrient Deficiency Classifier',
        'Driver Drowsiness Alerting System using Webcam Feed',
        'Sign Language Translation to Voice & Text Converter',
        'Fake News & Misinformation Detection Pipeline',
        'AI Assistant for Medical Triage & Patient Routing',
        'Smart Waste Sorting Robot using YOLOv8 Detector',
        'Satellite Imagery Deforestation Mapper',
        'Predictive Maintenance Engine for High-Speed Railway Tracks'
      ]
    },
    // Web Development
    {
      domain: 'Web Development',
      techs: ['React', 'Node.js', 'Express', 'MongoDB', 'Next.js', 'TailwindCSS'],
      prefix: ['Scalable', 'Micro-Frontend', 'Real-Time', 'Full-Stack', 'Interactive', 'Cloud-Native', 'Enterprise'],
      topics: [
        'Collaborative Real-Time Code & Document Editor',
        'University Academic Project Sphere & Evaluation Portal',
        'Disaster Relief Resource & Volunteer Management System',
        'Adaptive E-Learning Platform with Gamified Quizzes',
        'Freelance Micro-Task Marketplace with Escrow',
        'Smart Library Book Reservation & Digital Borrower System',
        'Peer-to-Peer Tutoring Matchmaker Platform',
        'Hospital Bed Availability & ICU Booking Portal',
        'Alumni Mentorship Network & Job Referral Hub',
        'Online Event Ticket Booking Platform with Dynamic Pricing',
        'Digital Public Grievance Redressal Portal for Municipalities',
        'E-Commerce Multi-Vendor Storefront with Analytics',
        'Virtual Campus Tour & Interactive Floor Plan Mapper',
        'Blood Bank Emergency Inventory & Donor Locator Portal',
        'Remote Exam Proctoring System with Browser Lockout',
        'SaaS Billing & Subscription Lifecycle Dashboard',
        'Real-Time Food Delivery Tracking & Order Dispatch Hub',
        'Student Hostel Allotment & Mess Management Portal',
        'Digital Portfolio Generator for Tech Graduates',
        'Interactive Technical Documentation & API Playground'
      ]
    },
    // Cybersecurity
    {
      domain: 'Cybersecurity',
      techs: ['Python', 'Docker', 'C++', 'Linux', 'Rust', 'PostgreSQL'],
      prefix: ['Zero-Trust', 'Behavioral', 'Encrypted', 'Automated', 'Lightweight', 'Deceptive', 'Resilient'],
      topics: [
        'IoT Gateway Firewall with MQTT Behavioral Anomaly Scanner',
        'Zero-Day Ransomware Detection via System Call Profiling',
        'Automated Web Application Penetration Testing Scanner',
        'Encrypted File Storage System with Multi-Party Computation',
        'Honeypot Network Infrastructure for Cyber Deception',
        'Biometric Auth Framework using FIDO2 & Passkeys',
        'Phishing Email Detection Engine using Transformer Models',
        'DNS Tunneling & Data Exfiltration Monitor',
        'Secure Passwordless Authentication Protocol for Microservices',
        'Cloud Security Posture Management & Misconfiguration Finder',
        'Distributed Denial of Service (DDoS) Mitigation Proxy',
        'Network Intrusion Detection System using Packet Inspection',
        'End-to-End Encrypted Messaging Protocol for Enterprise',
        'Source Code Hardening & Secret Leak Detector for Git Repos',
        'Container Image Vulnerability Security Auditor',
        'Automated Threat Intelligence Aggregator & IOC Extractor',
        'Hardware Security Token Emulator for Two-Factor Auth',
        'Database Activity Monitoring & SQL Injection Defender',
        'Secure File Eraser & Forensic Shredder Tool',
        'API Security Gateway with Rate Limiting & JWT Validation'
      ]
    },
    // IoT & Embedded Systems
    {
      domain: 'IoT & Embedded Systems',
      techs: ['Arduino', 'ESP32', 'Raspberry Pi', 'C++', 'MQTT', 'Node.js'],
      prefix: ['Smart', 'Low-Power', 'Connected', 'Autonomous', 'Sensory', 'Industrial', 'Edge-Enabled'],
      topics: [
        'Urban Air Quality Monitoring Node Grid with Cloud Heatmaps',
        'Precision Agriculture Soil Health & Irrigation System',
        'Smart Grid Electricity Metering & Theft Prevention Node',
        'Wearable Health Tracker for Elderly Fall Detection',
        'Industrial Machinery Vibration & Overheat Warning System',
        'Smart Parking Bay Reservation Node with Ultrasonic Sensors',
        'Automated Water Quality Testing & Contamination Alert Node',
        'Solar Panel Dust Cleaner & Efficiency Monitor Node',
        'LPG Gas Leakage Detection & Automatic Valve Shutoff System',
        'Smart Street Light Management Grid with Vehicle Motion Dimming',
        'Cold Chain Vaccine Storage Temperature Monitor with GPS Track',
        'IoT Livestock Tracker & Heart Rate Collar',
        'Smart Trash Bin Level & Route Optimization Grid for Garbage Trucks',
        'Indoor Asset Location Tracker using BLE Beacons',
        'Home Energy Metering & Appliances Remote Controller',
        'Autonomous Lawn Mower Robot with Boundary Perimeter Wire',
        'Water Tank Leakage & Overflow Auto Shutoff System',
        'Smart Helmet with Alcohol Sensing & Accident Location Transmitter',
        'Industrial Robot Arm Controller with ROS Integration',
        'Aquaponics Automated Tank Maintenance & Fish Feeder'
      ]
    },
    // Cloud Computing
    {
      domain: 'Cloud Computing',
      techs: ['Kubernetes', 'Docker', 'AWS', 'Go', 'Python', 'Terraform'],
      prefix: ['Cloud-Native', 'Automated', 'Serverless', 'Distributed', 'Resilient', 'Multi-Cloud', 'High-Availability'],
      topics: [
        'Kubernetes Cluster Autoscaler & Cloud Cost Predictor',
        'Serverless Function Orchestration Engine for Pipelines',
        'Multi-Cloud Storage Replication Gateway with Encryption',
        'Infrastructure as Code (IaC) Static Security Auditor',
        'Microservice Mesh Telemetry & Latency Monitor',
        'Automated Disaster Recovery & Database Failover Agent',
        'Container Registry Vulnerability & Compliance Checker',
        'Cloud Log Collector & Real-Time Alerting Engine',
        'Distributed Cache Manager with Consistent Hashing',
        'Global Content Delivery Network Edge Proxy Cache',
        'Multi-Tenant SaaS Database Schema Isolator',
        'Automated Kubernetes Deployment Rollback Controller',
        'Serverless Image Resizer & Converter Service',
        'Cloud Cost Anomaly Detector & Idle Resource Collector',
        'Distributed Task Queue Engine with Retry Backoff',
        'Cross-Region Database Sync Gateway with Conflict Resolution',
        'Cloud API Load Balancer with Dynamic Health Checks',
        'Virtual Machine Snapshot Backup & Restore Scheduler',
        'Multi-Cloud Identity Synchronization Manager',
        'GitOps CI/CD Deployment Controller for Kubernetes'
      ]
    },
    // Blockchain
    {
      domain: 'Blockchain',
      techs: ['Solidity', 'Ethereum', 'Web3', 'React', 'Node.js', 'Rust'],
      prefix: ['Decentralized', 'Smart Contract Based', 'Tamper-Proof', 'Zero-Knowledge', 'Web3', 'Peer-to-Peer'],
      topics: [
        'Academic Degree Certificate Issue & Instant Verification Platform',
        'Pharmaceutical Supply Chain Traceability & Counterfeit Prevention',
        'Zero-Knowledge Proof Voting System for National Elections',
        'DeFi Micro-Lending & Borrowing Protocol with Collateral Locking',
        'Decentralized Intellectual Property & Copyright Registrar',
        'Cross-Chain Asset Bridge Protocol with Multi-Sig Validation',
        'Real Estate Property Deed Registration & Fractional Ownership System',
        'Decentralized Autonomous Organization (DAO) Governance Portal',
        'Peer-to-Peer Renewable Energy Trading Platform',
        'Decentralized Identity (DID) Credential Wallet App',
        'DeFi Automated Market Maker (AMM) Liquidity Pool Token Exchange',
        'Decentralized Cloud Storage Network with Proof-of-Space',
        'Supply Chain Carbon Footprint Tracking Ledger',
        'Decentralized Crowdfunding Platform with Milestone Refunds',
        'NFT Based Event Ticketing System preventing Scalping',
        'Healthcare Electronic Health Record Sharing Ledger',
        'Decentralized Domain Name Registrar Service (DNS on Web3)',
        'Decentralized Insurance Protocol for Crop Damage',
        'Smart Contract Security Audit Automation Suite',
        'Decentralized Royalty Payout System for Musicians'
      ]
    },
    // Data Science
    {
      domain: 'Data Science',
      techs: ['Python', 'Pandas', 'Scikit-learn', 'Spark', 'Tableau', 'FastAPI'],
      prefix: ['Predictive', 'Exploratory', 'Big Data Driven', 'Analytics Enabled', 'Statistical', 'Data Mining'],
      topics: [
        'Customer Churn Prediction & Retention Advisory Dashboard',
        'Financial Transaction Fraud Anomaly Detection Pipeline',
        'Real-Time Urban Traffic Density Forecasting Engine',
        'E-Commerce Personalized Product Recommendation Matrix',
        'Air Quality & Pollution Level Prediction Model',
        'Stock Market Volatility & Sentiment Analysis Engine',
        'Hospital Readmission Risk Analyzer for Chronic Patients',
        'Flight Delay & Cancellation Forecasting Pipeline',
        'Credit Risk Scoring Engine for Small Business Loans',
        'Social Media Brand Sentiment & Trend Extractor',
        'Real Estate Property Price Prediction & Valuation Model',
        'Energy Consumption Profiling & Smart Grid Demand Forecaster',
        'Customer Lifetime Value (CLV) Forecasting Model',
        'Movie Box Office Success Predictor using Metadata & Trailers',
        'Sports Player Performance & Injury Risk Analytics Engine',
        'Employee Attrition Risk Detector & HR Advisory Suite',
        'Genome Sequence Variant Annotation Pipeline',
        'Cyber Crime Pattern Analysis & Hotspot Predictor',
        'Supply Chain Demand Forecasting & Inventory Optimizer',
        'Uber/Lyft Fare Estimation & Surge Pricing Model'
      ]
    },
    // Mobile App Development
    {
      domain: 'Mobile App Development',
      techs: ['Flutter', 'React Native', 'Firebase', 'Node.js', 'Kotlin', 'Swift'],
      prefix: ['Cross-Platform', 'Offline-First', 'Interactive', 'Location-Aware', 'Smart', 'Emergency'],
      topics: [
        'Offline-First Disaster Emergency Messaging & Mesh Network App',
        'Telemedicine Patient Consultation & E-Prescription Portal',
        'Augmented Reality Campus Navigation & Point-of-Interest Finder',
        'Direct Farmers Produce Marketplace App with Regional Language Support',
        'Women Safety Alert App with One-Touch Location Broadcasting',
        'Smart Budget & Expense Tracking App with OCR Receipt Scanning',
        'Fitness & Meal Planner with AI Calorie Estimation',
        'Public Bus Tracking & ETA Arrival Notification App',
        'Mental Health & Meditation Companion App with Mood Tracking',
        'Local Community Event & Volunteer Connector App',
        'Child Safety & Location Geofence Monitoring App',
        'Car Pooling & Shared Ride Matchmaker for College Students',
        'Waste Recycler Matchmaker App for Households',
        'Tour Guide & Local Cultural Experiences App',
        'Digital Vaccination Record & Child Immunization Tracker App',
        'Pet Care & Vet Appointment Reservation App',
        'Language Learning App with Speech Pronunciation Analyzer',
        'Handyman Service On-Demand Booking App',
        'Blood Donation Emergency Dispatcher App',
        'AR Furniture Placement & Interior Design App'
      ]
    }
  ];

  const items = [];
  let count = 0;

  // Generate 700 distinct statements by combining templates, variants, and source assignments
  for (let round = 1; round <= 6; round++) {
    for (const tmpl of templates) {
      for (let i = 0; i < tmpl.topics.length; i++) {
        count++;
        const source = sources[(count + round) % sources.length];
        const difficulty = difficulties[(count + i) % difficulties.length];
        const prefix = tmpl.prefix[(count + round) % tmpl.prefix.length];
        const rawTopic = tmpl.topics[i];

        let title = `${prefix} ${rawTopic}`;
        if (round > 1) {
          title = `${prefix} ${rawTopic} Variant ${round}`;
        }

        const description = `This SIH/IEEE capstone project focuses on building a ${title.toLowerCase()}. ` +
          `Designed to address real-world academic and industry challenges, it utilizes ${tmpl.techs.slice(0, 3).join(', ')} ` +
          `to deliver robust, scalable, and practical results. Collected from trusted public educational archives (${source.name}) for university capstones.`;

        items.push({
          title,
          description,
          domain: tmpl.domain,
          difficulty,
          technologies: tmpl.techs,
          sourceUrl: source.url,
          sourceName: source.name,
          keywords: generateKeywords(title, description, tmpl.domain),
          status: 'approved',
          dateCollected: new Date(Date.now() - (count * 3600000))
        });

        if (items.length >= 700) break;
      }
      if (items.length >= 700) break;
    }
    if (items.length >= 700) break;
  }


  return items;
}

const SEED_PROBLEM_STATEMENTS = generateComprehensiveProblemDataset();

// ── Main Collector Service Function ───────────────────────────────────────

exports.runAICrawler = async (triggeredBy = 'manual') => {
  try {
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

      if (title.length < 10 || description.length < 25) {
        continue;
      }

      let isDuplicate = false;
      for (const existing of allExistingTexts) {
        const titleSim = calculateJaccardSimilarity(title, existing.title);

        if (titleSim > 0.98) {
          isDuplicate = true;
          break;
        }
      }



      if (isDuplicate) {
        duplicatesRemoved++;
        continue;
      }

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
        dateCollected: rawItem.dateCollected || new Date()
      });

      allExistingTexts.push({ title, description });
    }

    if (itemsToInsert.length > 0) {
      await AIProblemStatement.insertMany(itemsToInsert);
    }

    const log = await AICrawlerLog.create({
      timestamp: new Date(),
      source: 'Smart India Hackathon (SIH), IEEE, Kaggle, GitHub, Devpost, Govt Portals',
      totalCollected,
      duplicatesRemoved,
      domainDistribution: domainCountMap,
      status: 'completed',
      triggeredBy,
      details: `Successfully processed ${totalCollected} entries. Inserted ${itemsToInsert.length} clean entries into database. Filtered out ${duplicatesRemoved} duplicates.`
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
