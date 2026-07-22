const AIProblemStatement = require('../models/AIProblemStatement');
const AICrawlerLog = require('../models/AICrawlerLog');
const ProblemStatement = require('../models/ProblemStatement');
const Batch = require('../models/Batch');
const COE = require('../models/COE');
const aiCrawlerService = require('../services/aiCrawlerService');

// @desc    Get all AI problem statements with filters
// @route   GET /api/ai-problems
exports.getAIProblems = async (req, res) => {
  try {
    const { search, domain, difficulty, technology, status, onlyOffered } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    } else {
      query.status = 'approved'; // default to approved
    }

    // If user is a student or explicitly requested only offered, return ONLY statements selected/offered by Guides
    if ((req.user && req.user.role === 'student') || onlyOffered === 'true') {
      query.isSelectedByGuide = true;
    }


    if (domain && domain !== 'All') {
      query.domain = domain;
    }

    if (difficulty && difficulty !== 'All') {
      query.difficulty = difficulty;
    }

    if (technology && technology !== 'All') {
      query.technologies = { $in: [new RegExp(technology, 'i')] };
    }

    if (search && search.trim() !== '') {
      const searchPattern = new RegExp(search.trim(), 'i');
      query.$or = [
        { title: searchPattern },
        { description: searchPattern },
        { keywords: searchPattern },
        { technologies: searchPattern }
      ];
    }

    const problems = await AIProblemStatement.find(query)
      .populate('offeredByGuides.guideId', 'name email')
      .populate('offeredByGuides.coeId', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: problems.length,
      data: problems
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single AI problem statement
// @route   GET /api/ai-problems/:id
exports.getAIProblem = async (req, res) => {
  try {
    const problem = await AIProblemStatement.findById(req.params.id)
      .populate('offeredByGuides.guideId', 'name email')
      .populate('offeredByGuides.coeId', 'name');
    if (!problem) {
      return res.status(404).json({ success: false, message: 'AI Problem Statement not found' });
    }
    res.status(200).json({ success: true, data: problem });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Guide selects/adopts an AI problem statement to offer to students
// @route   POST /api/ai-problems/:id/adopt
exports.adoptAIProblemByGuide = async (req, res) => {
  try {
    const { coeId, targetYear } = req.body;

    if (!coeId) {
      return res.status(400).json({ success: false, message: 'COE / RC selection is required' });
    }

    const aiProblem = await AIProblemStatement.findById(req.params.id);
    if (!aiProblem) {
      return res.status(404).json({ success: false, message: 'AI Problem Statement not found' });
    }

    const guideId = req.user._id;

    // Check if this guide already offered this problem
    const existingOffer = aiProblem.offeredByGuides.find(
      o => String(o.guideId) === String(guideId)
    );

    if (!existingOffer) {
      aiProblem.offeredByGuides.push({
        guideId,
        coeId,
        targetYear: targetYear || '3rd',
        offeredAt: new Date()
      });
    }

    aiProblem.isSelectedByGuide = true;
    await aiProblem.save();

    // Check if standard ProblemStatement already exists for this guide and title
    let standardProblem = await ProblemStatement.findOne({
      title: aiProblem.title,
      guideId
    });

    if (!standardProblem) {
      standardProblem = await ProblemStatement.create({
        coeId,
        title: aiProblem.title,
        description: `${aiProblem.description}\n\n[Source: ${aiProblem.sourceName} - ${aiProblem.sourceUrl || ''}]`,
        researchArea: aiProblem.domain,
        targetYear: targetYear || '3rd',
        guideId
      });
    }

    const updatedProblem = await AIProblemStatement.findById(aiProblem._id)
      .populate('offeredByGuides.guideId', 'name email')
      .populate('offeredByGuides.coeId', 'name');

    res.status(200).json({
      success: true,
      message: 'AI Problem Statement successfully selected and offered to students!',
      data: {
        aiProblem: updatedProblem,
        standardProblem
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Student requests an AI problem statement
// @route   POST /api/ai-problems/:id/request
exports.requestAIProblem = async (req, res) => {
  try {
    const aiProblem = await AIProblemStatement.findById(req.params.id)
      .populate('offeredByGuides.guideId', 'name email')
      .populate('offeredByGuides.coeId', 'name');

    if (!aiProblem) {
      return res.status(404).json({ success: false, message: 'AI Problem Statement not found' });
    }

    // Find student's batch
    const batch = await Batch.findOne({ leaderStudentId: req.user._id });
    if (!batch) {
      return res.status(400).json({ success: false, message: 'Only team leader can opt for problem statements' });
    }

    if (batch.allotmentStatus === 'allotted') {
      return res.status(400).json({ success: false, message: 'Team already has an allotted project' });
    }

    // Check target guide offering
    let targetGuideId = null;
    let targetCoeId = null;

    if (aiProblem.offeredByGuides && aiProblem.offeredByGuides.length > 0) {
      targetGuideId = aiProblem.offeredByGuides[0].guideId?._id || aiProblem.offeredByGuides[0].guideId;
      targetCoeId = aiProblem.offeredByGuides[0].coeId?._id || aiProblem.offeredByGuides[0].coeId;
    }

    // Find or create standard ProblemStatement for this AI problem statement
    let standardProblem = await ProblemStatement.findOne({ title: aiProblem.title });
    if (!standardProblem) {
      let defaultCoe = targetCoeId ? await COE.findById(targetCoeId) : await COE.findOne();

      standardProblem = await ProblemStatement.create({
        coeId: defaultCoe ? defaultCoe._id : null,
        title: aiProblem.title,
        description: `${aiProblem.description}\n\n[Source: ${aiProblem.sourceName} - ${aiProblem.sourceUrl || ''}]`,
        researchArea: aiProblem.domain,
        targetYear: batch.year || '3rd',
        guideId: targetGuideId || req.user._id
      });
    }

    const problemToOptId = standardProblem._id;

    // Update batch opted problems
    batch.optedProblemId = problemToOptId;
    batch.optedProblems = batch.optedProblems || [];

    const existingOpt = batch.optedProblems.find(o => String(o.problemId) === String(problemToOptId));
    if (!existingOpt) {
      batch.optedProblems.push({
        problemId: problemToOptId,
        coeId: standardProblem.coeId,
        status: 'pending',
        optedAt: new Date()
      });
    } else {
      existingOpt.status = 'pending';
    }

    batch.allotmentStatus = 'pending';
    await batch.save();

    // Increment request count on AI Problem
    aiProblem.requestsCount = (aiProblem.requestsCount || 0) + 1;
    await aiProblem.save();

    const updatedBatch = await Batch.findById(batch._id)
      .populate({
        path: 'optedProblems.problemId',
        select: 'title description guideId coeId researchArea'
      });

    res.status(200).json({
      success: true,
      message: 'Successfully requested AI Problem Statement. Waiting for Guide approval.',
      data: updatedBatch
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Trigger AI Crawler manually (Admin)
// @route   POST /api/ai-problems/crawl
exports.triggerAICrawl = async (req, res) => {
  try {
    const result = await aiCrawlerService.runAICrawler('manual');
    res.status(200).json({
      success: true,
      message: 'AI Crawler completed successfully',
      data: result.data
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get AI Collection Statistics & Logs (Admin)
// @route   GET /api/ai-problems/stats
exports.getAICrawlerStats = async (req, res) => {
  try {
    const totalAIProblems = await AIProblemStatement.countDocuments();
    const approvedCount = await AIProblemStatement.countDocuments({ status: 'approved' });
    const selectedByGuidesCount = await AIProblemStatement.countDocuments({ isSelectedByGuide: true });

    const domainStats = await AIProblemStatement.aggregate([
      { $group: { _id: '$domain', count: { $sum: 1 } } }
    ]);

    const domainDistribution = {};
    domainStats.forEach(d => {
      domainDistribution[d._id || 'Other'] = d.count;
    });

    const sourceStats = await AIProblemStatement.aggregate([
      { $group: { _id: '$sourceName', count: { $sum: 1 } } }
    ]);

    const sourceDistribution = {};
    sourceStats.forEach(s => {
      sourceDistribution[s._id || 'Public'] = s.count;
    });

    const logs = await AICrawlerLog.find().sort({ createdAt: -1 }).limit(10);

    const duplicatesAgg = await AICrawlerLog.aggregate([
      { $group: { _id: null, totalDuplicates: { $sum: '$duplicatesRemoved' } } }
    ]);
    const totalDuplicatesRemoved = duplicatesAgg.length > 0 ? duplicatesAgg[0].totalDuplicates : 0;

    res.status(200).json({
      success: true,
      data: {
        totalAIProblems,
        approvedCount,
        selectedByGuidesCount,
        totalDuplicatesRemoved,
        domainDistribution,
        sourceDistribution,
        recentLogs: logs
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create AI Problem Statement (Admin manual addition)
// @route   POST /api/ai-problems
exports.createAIProblem = async (req, res) => {
  try {
    const { title, description, domain, difficulty, technologies, sourceUrl, sourceName, keywords } = req.body;

    if (!title || !description) {
      return res.status(400).json({ success: false, message: 'Title and description are required' });
    }

    const problem = await AIProblemStatement.create({
      title,
      description,
      domain: domain || 'Other',
      difficulty: difficulty || 'Medium',
      technologies: Array.isArray(technologies) ? technologies : (technologies ? technologies.split(',') : []),
      sourceUrl: sourceUrl || '',
      sourceName: sourceName || 'Admin Entry',
      keywords: Array.isArray(keywords) ? keywords : (keywords ? keywords.split(',') : []),
      status: 'approved'
    });

    res.status(201).json({ success: true, data: problem });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update AI Problem Statement (Admin)
// @route   PUT /api/ai-problems/:id
exports.updateAIProblem = async (req, res) => {
  try {
    const problem = await AIProblemStatement.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!problem) {
      return res.status(404).json({ success: false, message: 'AI Problem Statement not found' });
    }

    res.status(200).json({ success: true, data: problem });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete AI Problem Statement (Admin)
// @route   DELETE /api/ai-problems/:id
exports.deleteAIProblem = async (req, res) => {
  try {
    const problem = await AIProblemStatement.findByIdAndDelete(req.params.id);
    if (!problem) {
      return res.status(404).json({ success: false, message: 'AI Problem Statement not found' });
    }

    res.status(200).json({ success: true, message: 'AI Problem Statement deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
