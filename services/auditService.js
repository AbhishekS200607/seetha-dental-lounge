const { supabaseAdmin } = require('../config/supabaseClient');

async function log({ actorId, actorRole, action, targetEntity, targetId, metadata }) {
  await supabaseAdmin.from('audit_logs').insert({
    actor_id:      actorId,
    actor_role:    actorRole,
    action,
    target_entity: targetEntity,
    target_id:     String(targetId),
    metadata:      metadata || null
  });
}

module.exports = { log };
