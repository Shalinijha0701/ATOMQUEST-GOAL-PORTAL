const dayjs = require('dayjs');

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clampScore(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(200, Math.round(value)));
}

function computeProgress(goal, achievement) {
  const actual = numeric(achievement.actual);
  const target = numeric(goal.target);

  if (goal.uomType === 'min') {
    if (!target || actual === null) return 0;
    return clampScore((actual / target) * 100);
  }

  if (goal.uomType === 'max') {
    if (!target || actual === null) return 0;
    if (actual === 0) return 200;
    return clampScore((target / actual) * 100);
  }

  if (goal.uomType === 'timeline') {
    if (!achievement.actualDate || !goal.targetDate) return achievement.status === 'Completed' ? 100 : 0;
    return dayjs(achievement.actualDate).isSame(dayjs(goal.targetDate)) ||
      dayjs(achievement.actualDate).isBefore(dayjs(goal.targetDate))
      ? 100
      : 0;
  }

  if (goal.uomType === 'zero') {
    return actual === 0 ? 100 : 0;
  }

  return 0;
}

module.exports = { computeProgress };
