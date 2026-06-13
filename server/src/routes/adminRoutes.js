const express = require('express');
const { readStore, withStore } = require('../data/store');
const { authenticate, requireRoles } = require('../middleware/auth');
const { publicUsers } = require('../utils/sanitize');
const { httpError } = require('../utils/httpError');
const { unlockSheet, enrichSheet, createSharedGoal } = require('../services/goalService');
const { addAudit } = require('../services/auditService');

const router = express.Router();
router.use(authenticate, requireRoles('admin'));

router.get('/dashboard', async (req, res, next) => {
  try {
    const store = await readStore();
    const activeCycle = store.cycles.find((cycle) => cycle.status === 'active');
    const sheets = store.goalSheets.filter((sheet) => sheet.cycleId === activeCycle?.id);
    const approved = sheets.filter((sheet) => sheet.status === 'approved').length;
    const submitted = sheets.filter((sheet) => sheet.status === 'submitted').length;
    const draft = sheets.filter((sheet) => ['draft', 'returned'].includes(sheet.status)).length;
    const q1Completed = store.checkIns.filter((checkIn) => checkIn.quarter === 'Q1').length;

    res.json({
      stats: {
        employees: store.users.filter((user) => user.role === 'employee' && user.isActive).length,
        managers: store.users.filter((user) => user.role === 'manager' && user.isActive).length,
        goalSheets: sheets.length,
        approved,
        submitted,
        draft,
        sharedGoals: store.sharedGoals.length,
        q1Completed,
      },
      recentAudit: store.auditLogs.slice(0, 8),
      cycles: store.cycles,
      completion: sheets.map((sheet) => enrichSheet(store, sheet)),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const store = await readStore();
    res.json({ users: publicUsers(store.users) });
  } catch (error) {
    next(error);
  }
});

router.get('/audit', async (req, res, next) => {
  try {
    const store = await readStore();
    const limit = Number(req.query.limit || 100);
    res.json({ logs: store.auditLogs.slice(0, limit) });
  } catch (error) {
    next(error);
  }
});

router.patch('/cycles/:cycleId', async (req, res, next) => {
  try {
    const cycle = await withStore((store) => {
      const target = store.cycles.find((candidate) => candidate.id === req.params.cycleId);
      if (!target) throw httpError(404, 'Cycle not found');
      const before = JSON.parse(JSON.stringify(target));
      if (req.body.status) target.status = req.body.status;
      if (req.body.goalSettingWindow) target.goalSettingWindow = req.body.goalSettingWindow;
      if (req.body.checkInWindows) target.checkInWindows = req.body.checkInWindows;
      addAudit(store, {
        actor: req.user,
        action: 'CYCLE_UPDATED',
        entityType: 'cycle',
        entityId: target.id,
        before,
        after: target,
      });
      return target;
    });
    res.json({ cycle });
  } catch (error) {
    next(error);
  }
});

router.post('/sheets/:sheetId/unlock', async (req, res, next) => {
  try {
    const sheet = await withStore((store) => unlockSheet(store, req.user, req.params.sheetId, req.body.reason));
    const store = await readStore();
    res.json({ sheet: enrichSheet(store, sheet) });
  } catch (error) {
    next(error);
  }
});

router.post('/shared-goals', async (req, res, next) => {
  try {
    const result = await withStore((store) => createSharedGoal(store, req.user, req.body));
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/escalations/run', async (req, res, next) => {
  try {
    const result = await withStore((store) => {
      const activeCycle = store.cycles.find((cycle) => cycle.status === 'active');
      const escalations = [];
      const employees = store.users.filter((user) => user.role === 'employee' && user.isActive);

      for (const employee of employees) {
        const sheet = store.goalSheets.find((candidate) => candidate.employeeId === employee.id && candidate.cycleId === activeCycle?.id);
        if (!sheet || ['draft', 'returned'].includes(sheet.status)) {
          escalations.push({
            id: `esc_${Date.now()}_${employee.id}`,
            employeeId: employee.id,
            managerId: employee.managerId,
            type: 'GOAL_NOT_SUBMITTED',
            severity: 'employee',
            message: `${employee.name} has not submitted goals for ${activeCycle?.name}.`,
            createdAt: new Date().toISOString(),
          });
        }
        if (sheet?.status === 'submitted') {
          escalations.push({
            id: `esc_${Date.now()}_${employee.id}_manager`,
            employeeId: employee.id,
            managerId: employee.managerId,
            type: 'APPROVAL_PENDING',
            severity: 'manager',
            message: `${employee.name}'s goal sheet is pending L1 approval.`,
            createdAt: new Date().toISOString(),
          });
        }
      }

      store.escalations.unshift(...escalations);
      addAudit(store, {
        actor: req.user,
        action: 'ESCALATION_RUN',
        entityType: 'escalation',
        entityId: 'batch',
        after: { count: escalations.length },
      });
      return { escalations, total: escalations.length };
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/escalations', async (req, res, next) => {
  try {
    const store = await readStore();
    res.json({ escalations: store.escalations.slice(0, 50) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
