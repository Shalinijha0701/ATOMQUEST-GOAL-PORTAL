const express = require('express');
const config = require('../config');
const { readStore } = require('../data/store');
const { authenticate } = require('../middleware/auth');
const { currentWindow } = require('../services/windowService');

const router = express.Router();

router.get('/bootstrap', authenticate, async (req, res, next) => {
  try {
    const store = await readStore();
    const activeCycle = store.cycles.find((cycle) => cycle.status === 'active');
    res.json({
      cycles: store.cycles,
      activeCycle,
      thrustAreas: store.thrustAreas,
      statuses: ['Not Started', 'On Track', 'Completed'],
      uomTypes: [
        { value: 'min', label: 'Min (higher is better)' },
        { value: 'max', label: 'Max (lower is better)' },
        { value: 'timeline', label: 'Timeline' },
        { value: 'zero', label: 'Zero-based' },
      ],
      currentWindow: currentWindow(activeCycle),
      demoMode: config.demoMode,
      enforceWindows: config.enforceWindows,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
