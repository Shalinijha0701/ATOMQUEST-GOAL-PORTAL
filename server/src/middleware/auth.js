const jwt = require('jsonwebtoken');
const config = require('../config');
const { readStore } = require('../data/store');
const { httpError } = require('../utils/httpError');

async function authenticate(req, res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw httpError(401, 'Authentication required');

    const decoded = jwt.verify(token, config.jwtSecret);
    const store = await readStore();
    const user = store.users.find((candidate) => candidate.id === decoded.userId);
    if (!user || !user.isActive) throw httpError(401, 'User not found or inactive');

    req.user = user;
    next();
  } catch (error) {
    next(error.status ? error : httpError(401, 'Invalid or expired token'));
  }
}

function requireRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(httpError(403, `${roles.join('/')} access required`));
    }
    next();
  };
}

function canManage(manager, employee) {
  return manager.role === 'admin' || employee.managerId === manager.id;
}

module.exports = { authenticate, requireRoles, canManage };
