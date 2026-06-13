const express = require('express');
const { readStore, withStore } = require('../data/store');
const { authenticate, requireRoles } = require('../middleware/auth');
const { newId } = require('../utils/id');
const { httpError } = require('../utils/httpError');
const {
  activeCycle,
  enrichSheet,
  managerEditSheet,
  approveSheet,
  returnSheet,
  createSharedGoal,
} = require('../services/goalService');
const { addAudit } = require('../services/auditService');

const router = express.Router();
router.use(authenticate, requireRoles('manager', 'admin'));

function teamEmployees(store, managerId) {
  return store.users.filter((user) => user.managerId === managerId && user.isActive);
}

router.get('/team', async (req, res, next) => {
  try {
    const store = await readStore();
    const cycle = activeCycle(store, req.query.cycleId);
    const employees = req.user.role === 'admin'
      ? store.users.filter((user) => user.role === 'employee')
      : teamEmployees(store, req.user.id);

    const team = employees.map((employee) => {
      const sheet = store.goalSheets.find((candidate) => candidate.employeeId === employee.id && candidate.cycleId === cycle.id);
      const checkInCount = sheet ? store.checkIns.filter((checkIn) => checkIn.goalSheetId === sheet.id).length : 0;
      return {
        employee: { id: employee.id, name: employee.name, email: employee.email, title: employee.title, department: employee.department },
        sheet: enrichSheet(store, sheet),
        checkInCount,
      };
    });

    res.json({ team, cycle });
  } catch (error) {
    next(error);
  }
});

router.get('/submissions', async (req, res, next) => {
  try {
    const store = await readStore();
    const cycle = activeCycle(store, req.query.cycleId);
    const employees = req.user.role === 'admin'
      ? store.users.filter((user) => user.role === 'employee')
      : teamEmployees(store, req.user.id);
    const employeeIds = new Set(employees.map((employee) => employee.id));
    const status = req.query.status || 'submitted';
    const sheets = store.goalSheets
      .filter((sheet) => sheet.cycleId === cycle.id && employeeIds.has(sheet.employeeId) && (!status || sheet.status === status))
      .map((sheet) => enrichSheet(store, sheet));
    res.json({ sheets });
  } catch (error) {
    next(error);
  }
});

router.put('/sheets/:sheetId', async (req, res, next) => {
  try {
    const sheet = await withStore((store) => managerEditSheet(store, req.user, req.params.sheetId, req.body.goals));
    const store = await readStore();
    res.json({ sheet: enrichSheet(store, sheet) });
  } catch (error) {
    next(error);
  }
});

router.post('/sheets/:sheetId/approve', async (req, res, next) => {
  try {
    const sheet = await withStore((store) => approveSheet(store, req.user, req.params.sheetId));
    const store = await readStore();
    res.json({ sheet: enrichSheet(store, sheet) });
  } catch (error) {
    next(error);
  }
});

router.post('/sheets/:sheetId/return', async (req, res, next) => {
  try {
    const sheet = await withStore((store) => returnSheet(store, req.user, req.params.sheetId, req.body.reason));
    const store = await readStore();
    res.json({ sheet: enrichSheet(store, sheet) });
  } catch (error) {
    next(error);
  }
});

router.post('/checkins', async (req, res, next) => {
  try {
    const checkIn = await withStore((store) => {
      const sheet = store.goalSheets.find((candidate) => candidate.id === req.body.goalSheetId);
      if (!sheet) throw httpError(404, 'Goal sheet not found');
      const employee = store.users.find((candidate) => candidate.id === sheet.employeeId);
      if (req.user.role !== 'admin' && employee?.managerId !== req.user.id) {
        throw httpError(403, 'You can only check in with direct reports');
      }
      if (sheet.status !== 'approved') throw httpError(409, 'Goal sheet must be approved before check-in');

      const existing = store.checkIns.find((candidate) => candidate.goalSheetId === sheet.id && candidate.quarter === req.body.quarter);
      const next = existing || {
        id: newId('checkin'),
        goalSheetId: sheet.id,
        employeeId: sheet.employeeId,
        managerId: req.user.id,
        quarter: req.body.quarter,
      };
      next.comment = req.body.comment || '';
      next.discussionDate = req.body.discussionDate || new Date().toISOString().slice(0, 10);
      next.completedAt = new Date().toISOString();
      if (!existing) store.checkIns.push(next);

      addAudit(store, {
        actor: req.user,
        action: 'MANAGER_CHECKIN_COMPLETED',
        entityType: 'checkIn',
        entityId: next.id,
        after: next,
      });

      return next;
    });
    res.json({ checkIn });
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

module.exports = router;
