const express = require('express');
const { readStore } = require('../data/store');
const { authenticate } = require('../middleware/auth');
const { toCsv } = require('../utils/csv');
const { buildAchievementRows } = require('../services/reportService');

const router = express.Router();
router.use(authenticate);

router.get('/achievements', async (req, res, next) => {
  try {
    const store = await readStore();
    const rows = buildAchievementRows(store, {
      cycleId: req.query.cycleId,
      quarter: req.query.quarter,
      actor: req.user,
    });
    res.json({ rows });
  } catch (error) {
    next(error);
  }
});

router.get('/achievements.csv', async (req, res, next) => {
  try {
    const store = await readStore();
    const rows = buildAchievementRows(store, {
      cycleId: req.query.cycleId,
      quarter: req.query.quarter,
      actor: req.user,
    });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="achievement-report.csv"');
    res.send(toCsv(rows));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
