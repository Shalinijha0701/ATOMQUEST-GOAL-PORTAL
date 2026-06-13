const fs = require('fs/promises');
const path = require('path');
const { createSeedData } = require('./seedData');

const dataDir = path.resolve(
  process.env.DATA_DIR || (process.env.VERCEL ? path.join('/tmp', 'atomquest-data') : path.join(__dirname, '..', '..', 'data'))
);
const dataFile = path.join(dataDir, 'atomquest-store.json');

async function ensureStore() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch (error) {
    const seed = await createSeedData();
    await writeStore(seed);
  }
}

async function readStore() {
  await ensureStore();
  const raw = await fs.readFile(dataFile, 'utf8');
  return JSON.parse(raw);
}

async function writeStore(store) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(store, null, 2));
}

async function withStore(mutator) {
  const store = await readStore();
  const result = await mutator(store);
  await writeStore(store);
  return result;
}

module.exports = {
  ensureStore,
  readStore,
  writeStore,
  withStore,
  dataFile,
};
