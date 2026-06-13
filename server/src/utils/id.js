const { randomUUID } = require('crypto');

function newId(prefix) {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

module.exports = { newId };
