const svc = require('./backend/services/aiRoadmapService');
if (typeof svc.buildRoadmapPrompt !== 'function') throw new Error('buildRoadmapPrompt missing');
if (typeof svc.generatePromptBasedRoadmap !== 'function') throw new Error('generatePromptBasedRoadmap missing');
const prompt = svc.buildRoadmapPrompt(
  { teamName: 'Team A', problemId: { title: 'Smart Attendance System', description: 'Track attendance with AI classification.', domain: 'AI & Machine Learning' } },
  { title: 'Smart Attendance System', description: 'Track attendance with AI classification.', domain: 'AI & Machine Learning', technologies: ['Python', 'OpenCV', 'React'] }
);
if (!prompt.includes('Project details:')) throw new Error('Prompt missing project details');
console.log('prompt_ok');
console.log(prompt.slice(0, 180));
