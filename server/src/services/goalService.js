const { newId } = require('../utils/id');
const { httpError } = require('../utils/httpError');
const { computeProgress } = require('./progressService');
const { assertWindowOpen } = require('./windowService');
const { addAudit } = require('./auditService');

const GOAL_STATUSES = ['Not Started', 'On Track', 'Completed'];

function activeCycle(store, cycleId) {
  const cycle = cycleId
    ? store.cycles.find((candidate) => candidate.id === cycleId)
    : store.cycles.find((candidate) => candidate.status === 'active');
  if (!cycle) throw httpError(404, 'Active cycle not found');
  return cycle;
}

function getUser(store, userId) {
  return store.users.find((user) => user.id === userId);
}

function sheetTotal(goals) {
  return goals.reduce((sum, goal) => sum + Number(goal.weightage || 0), 0);
}

function validateGoals(goals) {
  if (!Array.isArray(goals) || goals.length === 0) {
    throw httpError(400, 'At least one goal is required');
  }
  if (goals.length > 8) {
    throw httpError(400, 'Maximum 8 goals are allowed');
  }

  goals.forEach((goal, index) => {
    if (!goal.title?.trim()) throw httpError(400, `Goal ${index + 1}: title is required`);
    if (!goal.thrustArea?.trim()) throw httpError(400, `Goal ${index + 1}: thrust area is required`);
    if (!['min', 'max', 'timeline', 'zero'].includes(goal.uomType)) {
      throw httpError(400, `Goal ${index + 1}: invalid UoM type`);
    }
    if (Number(goal.weightage) < 10) {
      throw httpError(400, `Goal ${index + 1}: minimum weightage is 10%`);
    }
    if (goal.uomType === 'timeline' && !goal.targetDate) {
      throw httpError(400, `Goal ${index + 1}: target date is required for timeline goals`);
    }
    if (goal.uomType !== 'timeline' && goal.uomType !== 'zero' && Number(goal.target) <= 0) {
      throw httpError(400, `Goal ${index + 1}: numeric target must be greater than 0`);
    }
  });

  const total = sheetTotal(goals);
  if (total !== 100) {
    throw httpError(400, `Total weightage must equal 100%. Current total is ${total}%.`);
  }
}

function normalizeGoal(input, existing = {}) {
  const readOnlyFields = existing.readOnlyFields || input.readOnlyFields || [];
  const goal = {
    id: existing.id || input.id || newId('goal'),
    thrustArea: input.thrustArea?.trim() || existing.thrustArea || '',
    title: input.title?.trim() || existing.title || '',
    description: input.description?.trim() || existing.description || '',
    uomType: input.uomType || existing.uomType || 'min',
    unitLabel: input.unitLabel?.trim() || existing.unitLabel || '',
    target: input.target === '' || input.target === undefined ? null : Number(input.target),
    targetDate: input.targetDate || null,
    weightage: Number(input.weightage || 0),
    sharedGoalId: existing.sharedGoalId || input.sharedGoalId || null,
    readOnlyFields,
  };

  for (const field of readOnlyFields) {
    goal[field] = existing[field];
  }

  if (goal.uomType === 'zero') goal.target = 0;
  if (goal.uomType === 'timeline') goal.target = null;

  return goal;
}

function ensureEditableSheet(sheet) {
  if (!['draft', 'returned'].includes(sheet.status)) {
    throw httpError(409, 'Goal sheet is locked for employee edits');
  }
  if (sheet.lockedAt) {
    throw httpError(409, 'Goal sheet is locked. Admin unlock is required.');
  }
}

function findOrCreateSheet(store, employee, cycleId) {
  let sheet = store.goalSheets.find((candidate) => candidate.employeeId === employee.id && candidate.cycleId === cycleId);
  if (!sheet) {
    sheet = {
      id: newId('sheet'),
      employeeId: employee.id,
      managerId: employee.managerId,
      cycleId,
      status: 'draft',
      submittedAt: null,
      approvedAt: null,
      approvedBy: null,
      lockedAt: null,
      returnReason: null,
      goals: [],
    };
    store.goalSheets.push(sheet);
  }
  return sheet;
}

function updateEmployeeGoals(store, actor, cycleId, incomingGoals) {
  const cycle = activeCycle(store, cycleId);
  assertWindowOpen(cycle, 'goalSetting');

  const sheet = findOrCreateSheet(store, actor, cycle.id);
  ensureEditableSheet(sheet);

  const before = JSON.parse(JSON.stringify(sheet.goals));
  sheet.goals = incomingGoals.map((goal) => {
    const existing = sheet.goals.find((candidate) => candidate.id === goal.id) || {};
    return normalizeGoal(goal, existing);
  });
  validateGoals(sheet.goals);
  sheet.returnReason = null;

  addAudit(store, {
    actor,
    action: 'GOAL_SHEET_UPDATED',
    entityType: 'goalSheet',
    entityId: sheet.id,
    before,
    after: sheet.goals,
  });

  return sheet;
}

function submitGoalSheet(store, actor, cycleId) {
  const cycle = activeCycle(store, cycleId);
  assertWindowOpen(cycle, 'goalSetting');

  const sheet = store.goalSheets.find((candidate) => candidate.employeeId === actor.id && candidate.cycleId === cycle.id);
  if (!sheet) throw httpError(404, 'Goal sheet not found');
  ensureEditableSheet(sheet);
  validateGoals(sheet.goals);

  const before = { status: sheet.status };
  sheet.status = 'submitted';
  sheet.submittedAt = new Date().toISOString();
  sheet.returnReason = null;

  addAudit(store, {
    actor,
    action: 'GOAL_SHEET_SUBMITTED',
    entityType: 'goalSheet',
    entityId: sheet.id,
    before,
    after: { status: sheet.status, submittedAt: sheet.submittedAt },
  });

  return sheet;
}

function assertManagerCanReview(store, actor, sheet) {
  const employee = getUser(store, sheet.employeeId);
  if (!employee) throw httpError(404, 'Employee not found');
  if (actor.role !== 'admin' && employee.managerId !== actor.id) {
    throw httpError(403, 'You can only manage your direct reports');
  }
  return employee;
}

function managerEditSheet(store, actor, sheetId, incomingGoals) {
  const sheet = store.goalSheets.find((candidate) => candidate.id === sheetId);
  if (!sheet) throw httpError(404, 'Goal sheet not found');
  assertManagerCanReview(store, actor, sheet);
  if (sheet.status !== 'submitted') throw httpError(409, 'Only submitted sheets can be edited during review');
  if (incomingGoals.length !== sheet.goals.length || incomingGoals.some((goal) => !sheet.goals.some((existing) => existing.id === goal.id))) {
    throw httpError(400, 'Manager review can edit targets and weightages only');
  }

  const before = JSON.parse(JSON.stringify(sheet.goals));
  sheet.goals = incomingGoals.map((goal) => {
    const existing = sheet.goals.find((candidate) => candidate.id === goal.id) || {};
    return normalizeGoal({
      ...existing,
      target: goal.target,
      targetDate: goal.targetDate,
      weightage: goal.weightage,
    }, existing);
  });
  validateGoals(sheet.goals);

  addAudit(store, {
    actor,
    action: 'MANAGER_INLINE_EDIT',
    entityType: 'goalSheet',
    entityId: sheet.id,
    before,
    after: sheet.goals,
    reason: 'L1 inline edit during approval workflow',
  });

  return sheet;
}

function approveSheet(store, actor, sheetId) {
  const sheet = store.goalSheets.find((candidate) => candidate.id === sheetId);
  if (!sheet) throw httpError(404, 'Goal sheet not found');
  assertManagerCanReview(store, actor, sheet);
  if (sheet.status !== 'submitted') throw httpError(409, 'Only submitted sheets can be approved');
  validateGoals(sheet.goals);

  const before = { status: sheet.status };
  sheet.status = 'approved';
  sheet.approvedAt = new Date().toISOString();
  sheet.approvedBy = actor.id;
  sheet.lockedAt = sheet.approvedAt;
  sheet.returnReason = null;

  addAudit(store, {
    actor,
    action: 'GOAL_SHEET_APPROVED',
    entityType: 'goalSheet',
    entityId: sheet.id,
    before,
    after: { status: sheet.status, lockedAt: sheet.lockedAt },
  });

  return sheet;
}

function returnSheet(store, actor, sheetId, reason) {
  const sheet = store.goalSheets.find((candidate) => candidate.id === sheetId);
  if (!sheet) throw httpError(404, 'Goal sheet not found');
  assertManagerCanReview(store, actor, sheet);
  if (sheet.status !== 'submitted') throw httpError(409, 'Only submitted sheets can be returned');

  const before = { status: sheet.status };
  sheet.status = 'returned';
  sheet.returnReason = reason || 'Returned for rework';

  addAudit(store, {
    actor,
    action: 'GOAL_SHEET_RETURNED',
    entityType: 'goalSheet',
    entityId: sheet.id,
    before,
    after: { status: sheet.status, returnReason: sheet.returnReason },
    reason: sheet.returnReason,
  });

  return sheet;
}

function unlockSheet(store, actor, sheetId, reason) {
  const sheet = store.goalSheets.find((candidate) => candidate.id === sheetId);
  if (!sheet) throw httpError(404, 'Goal sheet not found');

  const before = { status: sheet.status, lockedAt: sheet.lockedAt };
  sheet.status = 'returned';
  sheet.lockedAt = null;
  sheet.returnReason = reason || 'Unlocked by Admin/HR';

  addAudit(store, {
    actor,
    action: 'ADMIN_UNLOCKED_GOAL_SHEET',
    entityType: 'goalSheet',
    entityId: sheet.id,
    before,
    after: { status: sheet.status, lockedAt: sheet.lockedAt },
    reason: sheet.returnReason,
  });

  return sheet;
}

function upsertAchievement(store, sheet, goal, actor, quarter, payload) {
  const achievement = store.achievements.find((candidate) => (
    candidate.goalSheetId === sheet.id && candidate.goalId === goal.id && candidate.quarter === quarter
  ));
  const next = achievement || {
    id: newId('ach'),
    goalSheetId: sheet.id,
    goalId: goal.id,
    employeeId: sheet.employeeId,
    quarter,
  };

  next.actual = payload.actual === '' || payload.actual === undefined ? null : Number(payload.actual);
  next.actualDate = payload.actualDate || null;
  next.status = GOAL_STATUSES.includes(payload.status) ? payload.status : 'Not Started';
  next.notes = payload.notes || '';
  next.updatedBy = actor.id;
  next.updatedAt = new Date().toISOString();
  next.progressScore = computeProgress(goal, next);

  if (!achievement) store.achievements.push(next);
  return next;
}

function updateAchievement(store, actor, sheetId, goalId, quarter, payload) {
  const sheet = store.goalSheets.find((candidate) => candidate.id === sheetId);
  if (!sheet) throw httpError(404, 'Goal sheet not found');
  const employee = getUser(store, sheet.employeeId);
  if (!employee) throw httpError(404, 'Employee not found');
  if (actor.role !== 'admin' && actor.id !== employee.id && employee.managerId !== actor.id) {
    throw httpError(403, 'Access denied for this goal sheet');
  }
  if (sheet.status !== 'approved') throw httpError(409, 'Achievements can be updated after goal approval');

  const cycle = activeCycle(store, sheet.cycleId);
  assertWindowOpen(cycle, 'checkIn', quarter);

  const goal = sheet.goals.find((candidate) => candidate.id === goalId);
  if (!goal) throw httpError(404, 'Goal not found');

  const before = store.achievements.filter((candidate) => candidate.quarter === quarter && candidate.goalId === goalId);

  let updated;
  if (goal.sharedGoalId) {
    const sharedGoal = store.sharedGoals.find((candidate) => candidate.id === goal.sharedGoalId);
    if (sharedGoal?.primaryOwnerId && actor.id !== sharedGoal.primaryOwnerId && actor.role !== 'admin') {
      throw httpError(403, 'Only the primary owner can update shared KPI achievements');
    }

    updated = store.goalSheets.flatMap((candidateSheet) => (
      candidateSheet.goals
        .filter((candidateGoal) => candidateGoal.sharedGoalId === goal.sharedGoalId)
        .map((candidateGoal) => upsertAchievement(store, candidateSheet, candidateGoal, actor, quarter, payload))
    ));
  } else {
    updated = [upsertAchievement(store, sheet, goal, actor, quarter, payload)];
  }

  addAudit(store, {
    actor,
    action: goal.sharedGoalId ? 'SHARED_ACHIEVEMENT_SYNCED' : 'ACHIEVEMENT_UPDATED',
    entityType: 'achievement',
    entityId: goal.sharedGoalId || goalId,
    before,
    after: updated,
  });

  return updated;
}

function createSharedGoal(store, actor, payload) {
  const cycle = activeCycle(store, payload.cycleId);
  const primaryOwner = getUser(store, payload.primaryOwnerId);
  if (!primaryOwner) throw httpError(400, 'Primary owner is required');

  const recipientIds = Array.from(new Set([payload.primaryOwnerId, ...(payload.recipientIds || [])]));
  const sharedGoal = {
    id: newId('sg'),
    cycleId: cycle.id,
    thrustArea: payload.thrustArea,
    title: payload.title,
    description: payload.description || '',
    uomType: payload.uomType || 'min',
    target: payload.uomType === 'timeline' ? null : Number(payload.target || 0),
    targetDate: payload.targetDate || null,
    primaryOwnerId: payload.primaryOwnerId,
    createdBy: actor.id,
    recipientIds,
    createdAt: new Date().toISOString(),
  };

  if (!sharedGoal.title || !sharedGoal.thrustArea) {
    throw httpError(400, 'Shared goal title and thrust area are required');
  }

  store.sharedGoals.push(sharedGoal);
  const warnings = [];

  for (const employeeId of recipientIds) {
    const employee = getUser(store, employeeId);
    if (!employee) {
      warnings.push(`User ${employeeId} not found`);
      continue;
    }

    const sheet = findOrCreateSheet(store, employee, cycle.id);
    if (sheet.lockedAt && actor.role !== 'admin') {
      warnings.push(`${employee.name}: sheet is locked, skipped`);
      continue;
    }

    if (sheet.goals.some((goal) => goal.sharedGoalId === sharedGoal.id)) continue;
    sheet.goals.push({
      id: newId('goal'),
      thrustArea: sharedGoal.thrustArea,
      title: sharedGoal.title,
      description: sharedGoal.description,
      uomType: sharedGoal.uomType,
      unitLabel: sharedGoal.uomType === 'zero' ? 'incidents' : '',
      target: sharedGoal.uomType === 'zero' ? 0 : sharedGoal.target,
      targetDate: sharedGoal.targetDate,
      weightage: Number(payload.defaultWeightage || 10),
      sharedGoalId: sharedGoal.id,
      readOnlyFields: ['thrustArea', 'title', 'description', 'uomType', 'target', 'targetDate'],
    });

    const total = sheetTotal(sheet.goals);
    if (total !== 100) {
      warnings.push(`${employee.name}: weightage total is now ${total}%; recipient must adjust before submission`);
    }
  }

  addAudit(store, {
    actor,
    action: 'SHARED_GOAL_CREATED',
    entityType: 'sharedGoal',
    entityId: sharedGoal.id,
    after: sharedGoal,
    reason: `Pushed to ${recipientIds.length} employee(s)`,
  });

  return { sharedGoal, warnings };
}

function enrichSheet(store, sheet) {
  if (!sheet) return null;
  const employee = getUser(store, sheet.employeeId);
  const manager = getUser(store, sheet.managerId);
  const achievements = store.achievements.filter((achievement) => achievement.goalSheetId === sheet.id);
  const checkIns = store.checkIns.filter((checkIn) => checkIn.goalSheetId === sheet.id);
  return {
    ...sheet,
    employee: employee ? { id: employee.id, name: employee.name, email: employee.email, department: employee.department, title: employee.title } : null,
    manager: manager ? { id: manager.id, name: manager.name, email: manager.email } : null,
    totalWeightage: sheetTotal(sheet.goals),
    achievements,
    checkIns,
  };
}

module.exports = {
  GOAL_STATUSES,
  activeCycle,
  validateGoals,
  updateEmployeeGoals,
  submitGoalSheet,
  managerEditSheet,
  approveSheet,
  returnSheet,
  unlockSheet,
  updateAchievement,
  createSharedGoal,
  enrichSheet,
  sheetTotal,
};
