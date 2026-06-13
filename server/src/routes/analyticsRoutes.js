const express = require('express');
const { readStore } = require('../data/store');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

function visibleSheets(store, actor, cycleId) {
  return store.goalSheets.filter((sheet) => {
    if (cycleId && sheet.cycleId !== cycleId) return false;
    if (actor.role === 'admin') return true;
    if (actor.role === 'manager') {
      const employee = store.users.find((user) => user.id === sheet.employeeId);
      return employee?.managerId === actor.id;
    }
    return sheet.employeeId === actor.id;
  });
}

function countBy(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item) || 'Unassigned';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

router.get('/overview', async (req, res, next) => {
  try {
    const store = await readStore();
    const activeCycle = store.cycles.find((cycle) => cycle.status === 'active');
    const sheets = visibleSheets(store, req.user, req.query.cycleId || activeCycle?.id);
    const sheetIds = new Set(sheets.map((sheet) => sheet.id));
    const goals = sheets.flatMap((sheet) => sheet.goals.map((goal) => ({ ...goal, sheetId: sheet.id, sheetStatus: sheet.status })));
    const achievements = store.achievements.filter((achievement) => sheetIds.has(achievement.goalSheetId));

    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const trend = quarters.map((quarter) => {
      const quarterAchievements = achievements.filter((achievement) => achievement.quarter === quarter);
      const average = quarterAchievements.length
        ? Math.round(quarterAchievements.reduce((sum, item) => sum + Number(item.progressScore || 0), 0) / quarterAchievements.length)
        : 0;
      return { quarter, averageProgress: average, updates: quarterAchievements.length };
    });

    const managerEffectiveness = store.users
      .filter((user) => user.role === 'manager')
      .map((manager) => {
        const team = store.users.filter((employee) => employee.managerId === manager.id);
        const teamSheetIds = new Set(store.goalSheets.filter((sheet) => team.some((employee) => employee.id === sheet.employeeId)).map((sheet) => sheet.id));
        const completed = store.checkIns.filter((checkIn) => teamSheetIds.has(checkIn.goalSheetId)).length;
        return {
          manager: manager.name,
          teamSize: team.length,
          checkInsCompleted: completed,
          completionRate: team.length ? Math.round((completed / (team.length * 4)) * 100) : 0,
        };
      });

    res.json({
      trend,
      distribution: {
        thrustArea: countBy(goals, (goal) => goal.thrustArea),
        uomType: countBy(goals, (goal) => goal.uomType),
        status: countBy(sheets, (sheet) => sheet.status),
      },
      managerEffectiveness,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
