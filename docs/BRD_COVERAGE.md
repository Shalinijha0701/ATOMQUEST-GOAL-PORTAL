# BRD Coverage Matrix

| Requirement | Implementation |
| --- | --- |
| Employee goal sheet creation | `EmployeeDashboard` + `PUT /api/goals/mine` |
| Thrust area, title, description, UoM, target, weightage | `GoalSheetEditor` and server goal validation |
| Total weightage = 100% | `validateGoals()` blocks save/submit/review |
| Minimum weightage 10% | `validateGoals()` |
| Maximum 8 goals | UI disables add and API enforces |
| Manager L1 approval | `ManagerDashboard` + `/api/manager/sheets/:id/approve` |
| Inline manager edits | `/api/manager/sheets/:id` |
| Return for rework | `/api/manager/sheets/:id/return` |
| Lock after approval | `lockedAt` and status `approved`; employee edits blocked |
| Admin unlock | `/api/admin/sheets/:id/unlock` |
| Shared goals | `/api/manager/shared-goals` and `/api/admin/shared-goals` |
| Shared goal read-only title/target | `readOnlyFields` preserved by API |
| Shared achievement sync | `updateAchievement()` propagates by `sharedGoalId` |
| Quarterly actual achievement | `AchievementPanel` + `/api/goals/:sheetId/goals/:goalId/achievements/:quarter` |
| Status selection | Not Started / On Track / Completed |
| Progress formulas | `server/src/services/progressService.js` |
| Check-in windows | Cycle config + `windowService`; demo mode can be disabled |
| Manager comments | `/api/manager/checkins` |
| Achievement report | `/api/reports/achievements.csv` |
| Completion dashboard | `/api/admin/dashboard` |
| Audit trail | `server/src/services/auditService.js` |
| Escalations | `/api/admin/escalations/run` |
| Analytics | `/api/analytics/overview` |
