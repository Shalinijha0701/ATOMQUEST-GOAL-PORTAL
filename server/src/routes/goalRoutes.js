const express = require('express');
const { readStore, withStore } = require('../data/store');
const { authenticate } = require('../middleware/auth');
const { httpError } = require('../utils/httpError');
const {
  activeCycle,
  updateEmployeeGoals,
  submitGoalSheet,
  updateAchievement,
  enrichSheet,
} = require('../services/goalService');

const router = express.Router();
router.use(authenticate);

function canAccessSheet(user, sheet, store) {
  if (user.role === 'admin') return true;
  if (sheet.employeeId === user.id) return true;
  const employee = store.users.find((candidate) => candidate.id === sheet.employeeId);
  return user.role === 'manager' && employee?.managerId === user.id;
}

router.get('/mine', async (req, res, next) => {
  try {
    const store = await readStore();
    const cycle = activeCycle(store, req.query.cycleId);
    const sheet = store.goalSheets.find((candidate) => candidate.employeeId === req.user.id && candidate.cycleId === cycle.id);
    res.json({ sheet: enrichSheet(store, sheet), cycle });
  } catch (error) {
    next(error);
  }
});

router.put('/mine', async (req, res, next) => {
  try {
    const sheet = await withStore((store) => updateEmployeeGoals(store, req.user, req.body.cycleId, req.body.goals));
    const store = await readStore();
    res.json({ sheet: enrichSheet(store, sheet) });
  } catch (error) {
    next(error);
  }
});

router.post('/mine/submit', async (req, res, next) => {
  try {
    const sheet = await withStore((store) => submitGoalSheet(store, req.user, req.body.cycleId));
    const store = await readStore();
    res.json({ sheet: enrichSheet(store, sheet) });
  } catch (error) {
    next(error);
  }
});

router.get('/:sheetId', async (req, res, next) => {
  try {
    const store = await readStore();
    const sheet = store.goalSheets.find((candidate) => candidate.id === req.params.sheetId);
    if (!sheet) throw httpError(404, 'Goal sheet not found');
    if (!canAccessSheet(req.user, sheet, store)) throw httpError(403, 'Access denied');
    res.json({ sheet: enrichSheet(store, sheet) });
  } catch (error) {
    next(error);
  }
});

router.post('/:sheetId/goals/:goalId/achievements/:quarter', async (req, res, next) => {
  try {
    const achievements = await withStore((store) => (
      updateAchievement(store, req.user, req.params.sheetId, req.params.goalId, req.params.quarter, req.body)
    ));
    res.json({ achievements });
  } catch (error) {
    next(error);
  }
});

router.get('/:sheetId/audit', async (req, res, next) => {
  try {
    const store = await readStore();
    const sheet = store.goalSheets.find((candidate) => candidate.id === req.params.sheetId);
    if (!sheet) throw httpError(404, 'Goal sheet not found');
    if (!canAccessSheet(req.user, sheet, store)) throw httpError(403, 'Access denied');

    const logs = store.auditLogs.filter((log) => log.entityId === sheet.id || log.after?.goalSheetId === sheet.id);
    res.json({ logs });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
