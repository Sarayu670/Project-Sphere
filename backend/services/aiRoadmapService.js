const ProjectRoadmap = require('../models/ProjectRoadmap');

// ── Multi-Domain Intelligent Roadmap Generator Engine ──────────────────────

const DOMAIN_ROADMAP_TEMPLATES = {
  'AI & Machine Learning': [
    {
      phase: 1,
      title: 'Phase 1: Problem Definition, Data Pipeline & Architecture',
      description: 'Define problem scope, collect & preprocess dataset, and establish machine learning pipeline architecture.',
      targetWeek: 2,
      estimatedDays: 14,
      tasks: [
        { title: 'Formulate core AI objectives and baseline evaluation metrics (Accuracy, F1-Score, Loss)' },
        { title: 'Source, clean, and annotate target dataset (EDA and data augmentation)' },
        { title: 'Setup Python, PyTorch/TensorFlow environment and GPU compute runtime' },
        { title: 'Design modular model architecture and feature extraction pipeline' }
      ],
      deliverables: ['Dataset Preprocessing Notebook', 'Exploratory Data Analysis Report', 'System Architecture Diagram']
    },
    {
      phase: 2,
      title: 'Phase 2: Model Training, Tuning & Baseline Benchmarking',
      description: 'Train baseline models, optimize hyper-parameters, and implement deep neural network architectures.',
      targetWeek: 5,
      estimatedDays: 21,
      tasks: [
        { title: 'Train baseline machine learning algorithms (e.g. Scikit-learn, XGBoost)' },
        { title: 'Construct and train deep learning neural network (CNN/RNN/Transformer)' },
        { title: 'Perform hyper-parameter tuning and cross-validation' },
        { title: 'Log training loss curves and evaluate confusion matrix results' }
      ],
      deliverables: ['Trained Model Checkpoint (.pt / .h5)', 'Model Evaluation & Validation Report']
    },
    {
      phase: 3,
      title: 'Phase 3: API Integration, Inference Engine & Dashboard UI',
      description: 'Wrap trained AI model in FastAPI/Flask backend service and build interactive web/mobile frontend.',
      targetWeek: 8,
      estimatedDays: 21,
      tasks: [
        { title: 'Develop REST API endpoints (FastAPI/Flask) for real-time model inference' },
        { title: 'Implement request payload validation and image/text preprocessing handlers' },
        { title: 'Build interactive frontend dashboard (React / Web UI) for user input & inference visualization' },
        { title: 'Integrate frontend with inference REST API backend' }
      ],
      deliverables: ['Inference REST API Backend', 'Interactive Frontend Web Dashboard', 'API Testing Collection']
    },
    {
      phase: 4,
      title: 'Phase 4: Optimization, Deployment & Final Documentation',
      description: 'Optimize inference latency (ONNX/TensorRT), containerize with Docker, and prepare capstone documentation.',
      targetWeek: 11,
      estimatedDays: 14,
      tasks: [
        { title: 'Optimize model size & inference speed (quantization / ONNX conversion)' },
        { title: 'Containerize application microservices using Docker' },
        { title: 'Conduct end-to-end user acceptance and stress testing' },
        { title: 'Finalize Project Report, Presentation Slides, and GitHub Repository documentation' }
      ],
      deliverables: ['Dockerized Deployment Package', 'Final Capstone Project Report', 'Presentation Slides & Demo Video']
    }
  ],

  'Web Development': [
    {
      phase: 1,
      title: 'Phase 1: Requirements Analysis, Database & UI Wireframing',
      description: 'Gather functional requirements, design database ER diagram, and create UI/UX wireframes.',
      targetWeek: 2,
      estimatedDays: 14,
      tasks: [
        { title: 'Document functional & non-functional requirements and user personas' },
        { title: 'Design relational/NoSQL database Schema and ER Diagram' },
        { title: 'Create interactive Figma/UI wireframes for core application screens' },
        { title: 'Initialize Git repository and setup project boilerplate (Vite/React + Express/Node)' }
      ],
      deliverables: ['Software Requirement Specification (SRS)', 'Database ER Diagram', 'Figma UI Mockups']
    },
    {
      phase: 2,
      title: 'Phase 2: Backend REST API & Database Implementation',
      description: 'Develop RESTful API microservices, database models, and authentication logic.',
      targetWeek: 5,
      estimatedDays: 21,
      tasks: [
        { title: 'Configure Mongoose/Sequelize models and database indices' },
        { title: 'Implement secure JWT authentication and role-based access control middleware' },
        { title: 'Build core CRUD REST API routes for business logic' },
        { title: 'Perform API testing and input validation using Postman' }
      ],
      deliverables: ['Backend Server API Codebase', 'Postman API Test Collection', 'Database Seed Scripts']
    },
    {
      phase: 3,
      title: 'Phase 3: Frontend Component Assembly & Integration',
      description: 'Build responsive React/Vue components and integrate with backend REST APIs.',
      targetWeek: 8,
      estimatedDays: 21,
      tasks: [
        { title: 'Implement responsive CSS design system and component layout' },
        { title: 'Develop dynamic frontend views (Dashboards, Forms, Data Tables)' },
        { title: 'Connect Axios API client with authentication and global state context' },
        { title: 'Implement error handling, toast notifications, and loading spinners' }
      ],
      deliverables: ['Responsive Web App Frontend', 'Integrated Full-Stack Application']
    },
    {
      phase: 4,
      title: 'Phase 4: Testing, Cloud Deployment & Documentation',
      description: 'Execute end-to-end integration tests, deploy to cloud platform, and assemble final presentation.',
      targetWeek: 11,
      estimatedDays: 14,
      tasks: [
        { title: 'Conduct cross-browser testing, responsiveness checks, and security audit' },
        { title: 'Deploy backend and frontend services to cloud hosting (Vercel/Render/AWS)' },
        { title: 'Prepare User Manual, API Documentation, and Project Logbook' },
        { title: 'Assemble final project presentation slides and live demonstration' }
      ],
      deliverables: ['Live Cloud Application URL', 'Comprehensive Project Documentation', 'Final Presentation Deck']
    }
  ],

  'Cybersecurity': [
    {
      phase: 1,
      title: 'Phase 1: Threat Modeling & Security Architecture Design',
      description: 'Establish attack vectors, threat models (STRIDE), and isolated laboratory environment.',
      targetWeek: 2,
      estimatedDays: 14,
      tasks: [
        { title: 'Perform STRIDE threat modeling and identify security boundaries' },
        { title: 'Set up isolated lab environment (Docker/VirtualBox isolated network)' },
        { title: 'Define cryptographic standards and security compliance requirements' },
        { title: 'Design detection algorithm and security gateway architecture' }
      ],
      deliverables: ['Threat Model Document', 'Isolated Testbed Architecture', 'Security Specification']
    },
    {
      phase: 2,
      title: 'Phase 2: Core Security Module & Detector Development',
      description: 'Implement packet inspection, anomaly detection algorithm, or encryption engine.',
      targetWeek: 5,
      estimatedDays: 21,
      tasks: [
        { title: 'Develop packet capture / system call monitoring daemon' },
        { title: 'Implement anomaly detection rules / cryptographic encryption routines' },
        { title: 'Build automated alert trigger and logging pipeline' },
        { title: 'Conduct initial unit testing against baseline exploit signatures' }
      ],
      deliverables: ['Core Security Daemon Codebase', 'Attack Simulation Scripts']
    },
    {
      phase: 3,
      title: 'Phase 3: Management Console & SIEM Integration',
      description: 'Develop security management dashboard for real-time monitoring and incident response.',
      targetWeek: 8,
      estimatedDays: 21,
      tasks: [
        { title: 'Build real-time security dashboard for alert feeds and incident logs' },
        { title: 'Implement automated firewall rule injection / isolation response' },
        { title: 'Integrate log forwarder (Syslog/JSON) for SIEM compatibility' },
        { title: 'Test penetration resilience against simulated cyber attacks' }
      ],
      deliverables: ['Security Monitoring Console', 'Incident Response Automation Engine']
    },
    {
      phase: 4,
      title: 'Phase 4: Vulnerability Assessment & Final Audit Report',
      description: 'Execute penetration tests, audit code, and produce comprehensive security project report.',
      targetWeek: 11,
      estimatedDays: 14,
      tasks: [
        { title: 'Run static analysis (SAST) and dynamic vulnerability assessment' },
        { title: 'Document defense effectiveness and false positive/negative rates' },
        { title: 'Produce final Security Audit Report and User Operating Guide' },
        { title: 'Deliver live attack/defense capstone demonstration' }
      ],
      deliverables: ['Security Audit Report', 'Penetration Testing Results', 'Capstone Presentation']
    }
  ]
};

function extractProjectContext(batch, problemStatement = null) {
  const title = problemStatement?.title || batch?.problemId?.title || batch?.teamName || 'Academic Project';
  const description = problemStatement?.description || batch?.problemId?.description || 'Custom academic project execution roadmap.';
  const domain = problemStatement?.domain || problemStatement?.researchArea || batch?.domain || batch?.researchArea || 'General';
  const techStack = Array.isArray(problemStatement?.technologies) && problemStatement.technologies.length
    ? problemStatement.technologies
    : Array.isArray(batch?.techStack) && batch.techStack.length
      ? batch.techStack
      : ['Node.js', 'React', 'MongoDB', 'REST API'];

  return { title, description, domain, techStack };
}

function buildRoadmapPrompt(batch, problemStatement = null) {
  const { title, description, domain, techStack } = extractProjectContext(batch, problemStatement);
  const stackText = techStack.join(', ');

  return `You are an academic project planning expert. Generate a realistic 4-phase project roadmap in valid JSON only.

Project details:
- Title: ${title}
- Domain: ${domain}
- Description: ${description}
- Tech Stack: ${stackText}
- Project type: student academic project
- Timeline: 12 weeks
- Output must contain ONLY a JSON object with this exact structure:
{
  "problemTitle": "string",
  "problemDescription": "string",
  "domain": "string",
  "techStack": ["string"],
  "aiSummary": "string",
  "milestones": [
    {
      "phase": 1,
      "title": "string",
      "description": "string",
      "targetWeek": 2,
      "estimatedDays": 14,
      "tasks": [
        { "title": "string" }
      ],
      "deliverables": ["string"],
      "status": "not_started",
      "completedAt": null
    }
  ]
}

Rules:
- Use exactly 4 milestones.
- Make each milestone specific to the project description and domain.
- The roadmap must be meaningfully different across different projects.
- Each milestone must include 3 to 5 practical tasks.
- Use a realistic academic project flow: research / design / development / testing / deployment.
- Use short, actionable task titles.
- Return valid JSON only, no markdown fences and no explanation.`;
}

function stripMarkdownCodeFence(content) {
  if (!content || typeof content !== 'string') return content;
  return content.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
}

function normalizeMilestones(milestones) {
  if (!Array.isArray(milestones)) return [];

  return milestones.map((milestone, index) => ({
    phase: Number(milestone?.phase ?? index + 1),
    title: String(milestone?.title || `Phase ${index + 1}`),
    description: String(milestone?.description || 'Project milestone.'),
    targetWeek: Number(milestone?.targetWeek ?? (index + 1) * 2),
    estimatedDays: Number(milestone?.estimatedDays ?? 14),
    tasks: Array.isArray(milestone?.tasks)
      ? milestone.tasks.map(task => ({
          title: String(task?.title || 'Task'),
          completed: false,
          completedAt: null
        }))
      : [],
    deliverables: Array.isArray(milestone?.deliverables)
      ? milestone.deliverables.map(item => String(item || 'Deliverable'))
      : [],
    status: milestone?.status || (index === 0 ? 'in_progress' : 'not_started'),
    completedAt: null
  }));
}

function normalizeGeneratedRoadmap(rawData, fallbackProject) {
  if (!rawData || typeof rawData !== 'object') return null;

  const problemTitle = String(rawData.problemTitle || fallbackProject.title || 'Academic Project');
  const problemDescription = String(rawData.problemDescription || fallbackProject.description || 'Roadmap generated for this project.');
  const domain = String(rawData.domain || fallbackProject.domain || 'General');
  const techStack = Array.isArray(rawData.techStack) && rawData.techStack.length
    ? rawData.techStack.map(item => String(item)).slice(0, 10)
    : fallbackProject.techStack;

  const milestones = normalizeMilestones(rawData.milestones);
  if (milestones.length === 0) return null;

  return {
    problemTitle,
    problemDescription,
    domain,
    techStack,
    aiSummary: String(rawData.aiSummary || `AI-generated roadmap for ${problemTitle} in ${domain}.`),
    milestones
  };
}

async function callRoadmapModel(prompt) {
    const geminiApiKey = process.env.SPHERE_GEMINI_API_KEY;

    if (!geminiApiKey) {
        console.error('AI Roadmap Generation Failed: SPHERE_GEMINI_API_KEY is not configured in the .env file.');
        throw new Error('AI service is not configured. Please contact the administrator.');
    }

    const model = 'gemini-3.5-flash-lite';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 1800,
                    responseMimeType: 'application/json'
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            // This will now throw the actual error from Gemini, e.g., API not enabled.
            throw new Error(`Gemini API request failed: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        return content || null;
    } catch (error) {
        console.error('Gemini API call failed:', error.message);
        // Re-throw the error to be caught by the calling function, preventing fallback.
        throw error;
    }
}

async function generatePromptBasedRoadmap(batch, problemStatement = null) {
  const projectContext = extractProjectContext(batch, problemStatement);
  const prompt = buildRoadmapPrompt(batch, problemStatement);

  try {
    const responseText = await callRoadmapModel(prompt);
    if (!responseText) return null;

    const cleanedText = stripMarkdownCodeFence(responseText);
    const parsed = JSON.parse(cleanedText);
    const normalized = normalizeGeneratedRoadmap(parsed, projectContext);

    if (!normalized) return null;
    return normalized;
  } catch (error) {
    console.warn('Prompt-based roadmap generation failed, falling back to template generator:', error.message);
    return null;
  }
}

function getGenericTemplate(domain, problemTitle) {
  return [
    {
      phase: 1,
      title: 'Phase 1: Feasibility Study, Domain Research & System Design',
      description: `Analyze requirements for "${problemTitle}", review literature, and architect system components.`,
      targetWeek: 2,
      estimatedDays: 14,
      tasks: [
        { title: 'Conduct domain background literature survey and feasibility analysis' },
        { title: 'Formulate core project objectives, technical scope, and KPIs' },
        { title: 'Design high-level block diagrams and component interactions' },
        { title: 'Establish repository structure and initial development environment' }
      ],
      deliverables: ['Feasibility & Domain Survey Report', 'High-Level System Design Diagram']
    },
    {
      phase: 2,
      title: 'Phase 2: Core Algorithm Development & Prototype Engineering',
      description: 'Implement core modules, algorithms, and primary data processing workflows.',
      targetWeek: 5,
      estimatedDays: 21,
      tasks: [
        { title: 'Build core software/hardware functional modules' },
        { title: 'Implement primary data structures and algorithmic logic' },
        { title: 'Execute modular unit tests to verify algorithmic correctness' },
        { title: 'Refine data pipelines and error handling' }
      ],
      deliverables: ['Core Subsystem Source Code', 'Unit Test Results Log']
    },
    {
      phase: 3,
      title: 'Phase 3: Integration, User Interface & System Assembly',
      description: 'Integrate hardware/software subsystems into unified functional prototype.',
      targetWeek: 8,
      estimatedDays: 21,
      tasks: [
        { title: 'Assemble frontend/UI interface with backend core engine' },
        { title: 'Conduct end-to-end integration testing and data flow verification' },
        { title: 'Refine user feedback mechanisms and edge case handling' },
        { title: 'Optimize system response time and memory footprint' }
      ],
      deliverables: ['Fully Integrated Prototype System', 'Integration Test Log']
    },
    {
      phase: 4,
      title: 'Phase 4: Evaluation, Capstone Report & Presentation',
      description: 'Validate performance metrics, author final capstone thesis report, and present findings.',
      targetWeek: 11,
      estimatedDays: 14,
      tasks: [
        { title: 'Run final evaluation benchmarks against defined KPIs' },
        { title: 'Author comprehensive Capstone Project Documentation' },
        { title: 'Prepare project demonstration video and presentation slides' },
        { title: 'Conduct final project viva presentation' }
      ],
      deliverables: ['Final Project Thesis Report', 'Live Working Demonstration', 'Presentation Slide Deck']
    }
  ];
}

function buildTemplateRoadmap(batch, problemStatement = null) {
  const { title, description, domain, techStack } = extractProjectContext(batch, problemStatement);

  let selectedTemplate = DOMAIN_ROADMAP_TEMPLATES[domain];
  if (!selectedTemplate) {
    const domainKey = Object.keys(DOMAIN_ROADMAP_TEMPLATES).find(k => domain.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(domain.toLowerCase()));
    selectedTemplate = domainKey ? DOMAIN_ROADMAP_TEMPLATES[domainKey] : getGenericTemplate(domain, title);
  }

  const milestones = selectedTemplate.map((m, index) => ({
    phase: m.phase,
    title: m.title.replace('{problemTitle}', title),
    description: m.description,
    targetWeek: m.targetWeek,
    estimatedDays: m.estimatedDays,
    tasks: m.tasks.map(t => ({ title: t.title, completed: false, completedAt: null })),
    deliverables: m.deliverables,
    status: index === 0 ? 'in_progress' : 'not_started',
    completedAt: null
  }));

  return {
    problemTitle: title,
    problemDescription: description,
    domain,
    techStack,
    aiSummary: `Personalized AI roadmap generated for "${title}" (${domain} domain). Structured across ${milestones.length} milestone phases targeting completion over 12 weeks.`,
    milestones
  };
}

async function generateRoadmapForBatch(batch, problemStatement = null) {
  try {
    const projectContext = extractProjectContext(batch, problemStatement);

    const promptGenerated = await generatePromptBasedRoadmap(batch, problemStatement);
    const generatedRoadmap = promptGenerated || buildTemplateRoadmap(batch, problemStatement);

    let roadmap = await ProjectRoadmap.findOne({ batchId: batch._id });
    const payload = {
      batchId: batch._id,
      problemTitle: generatedRoadmap.problemTitle || projectContext.title,
      problemDescription: generatedRoadmap.problemDescription || projectContext.description,
      domain: generatedRoadmap.domain || projectContext.domain,
      techStack: generatedRoadmap.techStack || projectContext.techStack,
      aiSummary: generatedRoadmap.aiSummary || `AI roadmap generated for ${projectContext.title}.`,
      milestones: generatedRoadmap.milestones,
      generatedBy: 'ai',
      lastUpdated: new Date()
    };

    if (roadmap) {
      roadmap.problemTitle = payload.problemTitle;
      roadmap.problemDescription = payload.problemDescription;
      roadmap.domain = payload.domain;
      roadmap.techStack = payload.techStack;
      roadmap.aiSummary = payload.aiSummary;
      roadmap.milestones = payload.milestones;
      roadmap.lastUpdated = new Date();
      await roadmap.save();
      return roadmap;
    }

    roadmap = await ProjectRoadmap.create(payload);
    return roadmap;
  } catch (error) {
    console.error('aiRoadmapService Error:', error);
    throw error;
  }
}

module.exports = {
  buildRoadmapPrompt,
  generatePromptBasedRoadmap,
  generateRoadmapForBatch,
  buildTemplateRoadmap,
  normalizeGeneratedRoadmap
};
