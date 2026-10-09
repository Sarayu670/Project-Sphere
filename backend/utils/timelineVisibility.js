const Batch = require('../models/Batch');

// Timeline events are scoped by year (targetYear) and branch (department).
// 'all' / 'ALL' mean "every year" / "every branch".
//
// Visibility rules:
// - Admin:   sees every event (no branch lock).
// - Student: sees events for their own year AND branch.
// - Guide:   sees events for the (year, branch) of the teams they guide, plus the
//            section they coordinate (if any).
const yearMatch = (year) => ({ targetYear: { $in: year ? [year, 'all'] : ['all'] } });
const branchMatch = (branch) => ({
  $or: [
    { department: { $in: branch ? [branch, 'ALL'] : ['ALL'] } },
    { department: { $exists: false } },
    { department: null }
  ]
});

const pairCondition = (year, branch) => ({ $and: [yearMatch(year), branchMatch(branch)] });

async function getUserYearBranchPairs(user) {
  if (!user) return [];
  const role = user.role;

  if (role === 'student') {
    return [{ year: user.year || null, branch: user.branch || null }];
  }

  if (role === 'guide') {
    const batches = await Batch.find({ guideId: user._id }).select('year branch').lean();
    const pairs = new Map();
    batches.forEach(batch => {
      const key = `${batch.year || ''}::${batch.branch || ''}`;
      if (!pairs.has(key)) pairs.set(key, { year: batch.year || null, branch: batch.branch || null });
    });
    const scope = user.isCoordinator ? user.coordinatorSection : null;
    if (scope?.year || scope?.branch) {
      const key = `${scope.year || ''}::${scope.branch || ''}`;
      if (!pairs.has(key)) pairs.set(key, { year: scope.year || null, branch: scope.branch || null });
    }
    return Array.from(pairs.values());
  }

  return [];
}

// Returns a Mongo filter restricting TimelineEvent documents to those the user may see,
// or null when no restriction applies (admins).
async function buildTimelineVisibilityFilter(user) {
  if (!user || user.role === 'admin') return null;

  const pairs = await getUserYearBranchPairs(user);
  if (pairs.length === 0) {
    // Only institution-wide events (all years, all branches)
    return pairCondition(null, null);
  }
  return { $or: pairs.map(pair => pairCondition(pair.year, pair.branch)) };
}

// Checks whether a single event is visible for the given year/branch pair.
function isEventVisibleFor(event, year, branch) {
  if (!event) return false;
  const targetYear = event.targetYear || 'all';
  const department = event.department || 'ALL';
  const yearOk = targetYear === 'all' || (year && targetYear === year);
  const branchOk = department === 'ALL' || (branch && department === branch);
  return Boolean(yearOk && branchOk);
}

module.exports = {
  buildTimelineVisibilityFilter,
  getUserYearBranchPairs,
  isEventVisibleFor
};
