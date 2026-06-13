const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { readStore } = require('../data/store');
const { authenticate } = require('../middleware/auth');
const { publicUser, publicUsers } = require('../utils/sanitize');
const { httpError } = require('../utils/httpError');

const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const store = await readStore();
    const user = store.users.find((candidate) => candidate.email.toLowerCase() === String(email || '').toLowerCase());
    if (!user) throw httpError(401, 'Invalid credentials');

    const valid = await bcrypt.compare(password || '', user.passwordHash);
    if (!valid) throw httpError(401, 'Invalid credentials');

    const token = jwt.sign({ userId: user.id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
    res.json({ token, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.get('/demo-users', async (req, res, next) => {
  try {
    const store = await readStore();
    const users = store.users.filter((user) => user.isActive);
    res.json({ users: publicUsers(users) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
