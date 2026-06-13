const dayjs = require('dayjs');
const config = require('../config');

function isWithinWindow(window, now = dayjs()) {
  if (!window?.opens || !window?.closes) return false;
  const start = dayjs(window.opens).startOf('day');
  const end = dayjs(window.closes).endOf('day');
  return now.isAfter(start.subtract(1, 'millisecond')) && now.isBefore(end.add(1, 'millisecond'));
}

function assertWindowOpen(cycle, phase, quarter) {
  if (config.demoMode || !config.enforceWindows) return;

  const window = phase === 'goalSetting'
    ? cycle.goalSettingWindow
    : cycle.checkInWindows?.[quarter];

  if (!isWithinWindow(window)) {
    const label = quarter || 'goal setting';
    const error = new Error(`${label} window is not open`);
    error.status = 409;
    throw error;
  }
}

function currentWindow(cycle) {
  if (!cycle) return null;
  if (isWithinWindow(cycle.goalSettingWindow)) return { phase: 'goalSetting', label: 'Goal Setting' };
  const entry = Object.entries(cycle.checkInWindows || {}).find(([, window]) => isWithinWindow(window));
  if (!entry) return null;
  return { phase: 'checkIn', quarter: entry[0], label: entry[1].label };
}

module.exports = { assertWindowOpen, currentWindow, isWithinWindow };
