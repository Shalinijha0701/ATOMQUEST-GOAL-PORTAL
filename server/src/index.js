const app = require('./app');
const config = require('./config');
const { ensureStore } = require('./data/store');

async function start() {
  await ensureStore();

  app.listen(config.port, () => {
    console.log(`AtomQuest Goal Portal API running on http://localhost:${config.port}`);
    console.log(`Demo mode: ${config.demoMode ? 'enabled' : 'disabled'}`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
