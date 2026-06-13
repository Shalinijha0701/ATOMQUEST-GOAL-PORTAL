const { newId } = require('../utils/id');

function addAudit(store, { actor, action, entityType, entityId, before, after, reason }) {
  store.auditLogs.unshift({
    id: newId('audit'),
    actorId: actor.id,
    action,
    entityType,
    entityId,
    before: before || null,
    after: after || null,
    reason: reason || null,
    createdAt: new Date().toISOString(),
  });
}

module.exports = { addAudit };
