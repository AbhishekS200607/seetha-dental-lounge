// Doctor queue management

if (!requireAuth('doctor')) { /* redirected */ }

const profile = getProfile();
const nameEl = document.getElementById('doctor-name-text');
if (nameEl) nameEl.textContent = profile?.full_name || '';

async function loadCurrent() {
  const res = await apiFetch('/doctor/current');
  const el = document.getElementById('current-token-display');
  if (!res.success || !res.data) {
    el.innerHTML = '<p style="color:var(--muted);text-align:center;padding:1rem">No patient currently being served.</p>';
    return;
  }
  const t = res.data;
  // Build action buttons based on current status.
  // called:      Start (→in_progress) | Complete (→completed) | Skip | Cancel
  // in_progress: Complete | Cancel
  const startBtn = t.status === 'called'
    ? `<button class="btn btn-primary" onclick="doAction('${t.id}','start')" style="display:inline-flex;align-items:center;gap:.4rem">${ic.play} Start</button>`
    : '';
  el.innerHTML = `
    <div class="token-big">
      <div class="token-num-wrap"><div class="token-num">${t.token_number}</div></div>
      <div class="token-label">${t.patient?.full_name || 'Patient'} &nbsp; ${badge(t.status)}</div>
      ${t.patient?.phone ? `<div style="color:var(--muted);font-size:.85rem;margin-top:.25rem;display:flex;align-items:center;justify-content:center;gap:.3rem">${ic.phone} ${t.patient.phone}</div>` : ''}
    </div>
    <div style="display:flex;gap:.5rem;justify-content:center;flex-wrap:wrap;padding-bottom:1rem">
      ${startBtn}
      <button class="btn btn-success" onclick="doAction('${t.id}','complete')" style="display:inline-flex;align-items:center;gap:.4rem">${ic.check} Complete</button>
      <button class="btn btn-secondary" onclick="doAction('${t.id}','skip')" style="display:inline-flex;align-items:center;gap:.4rem">${ic.skip} Skip</button>
      <button class="btn btn-danger" onclick="doAction('${t.id}','cancel')" style="display:inline-flex;align-items:center;gap:.4rem">${ic.cancel} Cancel</button>
    </div>`;
}

async function loadQueue() {
  await loadCurrent();
  const res = await apiFetch('/doctor/queue');
  const el = document.getElementById('queue-list');
  if (!res.success) { el.innerHTML = `<div class="alert alert-error">${res.message}</div>`; return; }

  const waiting = (res.data || []).filter(t => t.status === 'waiting');
  const skipped = (res.data || []).filter(t => t.status === 'skipped');

  if (!waiting.length && !skipped.length) {
    el.innerHTML = '<p style="color:var(--muted);text-align:center;padding:1rem">Queue is empty.</p>';
    return;
  }

  el.innerHTML = waiting.map(t => `
    <div class="queue-item">
      <div class="q-num">${t.token_number}</div>
      <div class="q-info">
        <div class="q-name">${t.patient?.full_name || 'Patient'}</div>
        ${t.patient?.phone ? `<div style="font-size:.8rem;color:var(--muted);display:flex;align-items:center;gap:.25rem">${ic.phone} ${t.patient.phone}</div>` : ''}
        ${t.notes ? `<div style="font-size:.8rem;color:var(--muted);display:flex;align-items:center;gap:.25rem">${ic.note} ${t.notes}</div>` : ''}
      </div>
      <div class="q-actions">
        <button class="btn btn-secondary btn-sm" onclick="doAction('${t.id}','skip')" style="display:inline-flex;align-items:center;gap:.3rem">${ic.skip} Skip</button>
        <button class="btn btn-danger btn-sm" onclick="doAction('${t.id}','cancel')" style="display:inline-flex;align-items:center;gap:.3rem">${ic.cancel} Cancel</button>
      </div>
    </div>`).join('') +
    (skipped.length ? `<p style="font-size:.8rem;color:var(--muted);margin:.75rem 0 .25rem">Skipped</p>` +
      skipped.map(t => `
        <div class="queue-item" style="opacity:.7">
          <div class="q-num">${t.token_number}</div>
          <div class="q-info"><div class="q-name">${t.patient?.full_name || 'Patient'}</div></div>
          <div class="q-actions">
            <button class="btn btn-secondary btn-sm" onclick="recallSkipped('${t.id}')" style="display:inline-flex;align-items:center;gap:.3rem">${ic.refresh} Recall</button>
          </div>
        </div>`).join('') : '');
}

async function callNext() {
  const btn = event.target;
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Calling…';
  const res = await apiFetch('/doctor/tokens/_/next', { method: 'POST' });
  btn.disabled = false; btn.innerHTML = `${ic.play} Call Next Patient`;
  if (!res.success) showAlert('alert-box', res.message);
  else loadQueue();
}

async function doAction(id, action) {
  const map = { start: 'start', complete: 'complete', skip: 'skip', cancel: 'cancel' };
  const res = await apiFetch(`/doctor/tokens/${id}/${map[action]}`, { method: 'PATCH' });
  if (!res.success) showAlert('alert-box', res.message);
  else loadQueue();
}

async function recallSkipped(id) {
  const res = await apiFetch(`/doctor/tokens/${id}/recall`, { method: 'PATCH' });
  if (!res.success) showAlert('alert-box', res.message);
  else loadQueue();
}

// Initial load + polling every 15s
loadQueue();
setInterval(loadQueue, 15000);
