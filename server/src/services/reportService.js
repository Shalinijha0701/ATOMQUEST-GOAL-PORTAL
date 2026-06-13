function userName(store, userId) {
  return store.users.find((user) => user.id === userId)?.name || '';
}

function buildAchievementRows(store, { cycleId, quarter, actor }) {
  const sheets = store.goalSheets.filter((sheet) => {
    if (cycleId && sheet.cycleId !== cycleId) return false;
    if (actor.role === 'admin') return true;
    if (actor.role === 'manager') {
      const employee = store.users.find((user) => user.id === sheet.employeeId);
      return employee?.managerId === actor.id;
    }
    return sheet.employeeId === actor.id;
  });

  return sheets.flatMap((sheet) => {
    const employee = store.users.find((user) => user.id === sheet.employeeId);
    const manager = store.users.find((user) => user.id === sheet.managerId);

    return sheet.goals.map((goal) => {
      const achievement = store.achievements.find((candidate) => (
        candidate.goalSheetId === sheet.id &&
        candidate.goalId === goal.id &&
        (!quarter || candidate.quarter === quarter)
      ));
      const checkIn = store.checkIns.find((candidate) => (
        candidate.goalSheetId === sheet.id &&
        (!quarter || candidate.quarter === quarter)
      ));

      return {
        cycleId: sheet.cycleId,
        quarter: achievement?.quarter || quarter || '',
        employee: employee?.name || '',
        employeeEmail: employee?.email || '',
        manager: manager?.name || '',
        department: employee?.department || '',
        sheetStatus: sheet.status,
        thrustArea: goal.thrustArea,
        goalTitle: goal.title,
        uomType: goal.uomType,
        plannedTarget: goal.uomType === 'timeline' ? goal.targetDate : goal.target,
        weightage: goal.weightage,
        actualAchievement: achievement?.actual ?? achievement?.actualDate ?? '',
        progressStatus: achievement?.status || 'Not Started',
        progressScore: achievement?.progressScore ?? '',
        managerCheckInDone: checkIn ? 'Yes' : 'No',
        managerComment: checkIn?.comment || '',
        sharedGoal: goal.sharedGoalId ? 'Yes' : 'No',
        primaryOwner: goal.sharedGoalId
          ? userName(store, store.sharedGoals.find((shared) => shared.id === goal.sharedGoalId)?.primaryOwnerId)
          : '',
      };
    });
  });
}

module.exports = { buildAchievementRows };
