require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT || 5000),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  jwtSecret: process.env.JWT_SECRET || 'atomquest-demo-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  demoMode: process.env.DEMO_MODE !== 'false',
  enforceWindows: process.env.ENFORCE_WINDOWS === 'true',
};
