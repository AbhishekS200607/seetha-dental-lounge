// Patient dashboard logic

if (!requireAuth('patient')) { /* redirected */ }

const profile = getProfile();
const nameEl = document.getElementById('patient-name-text');
if (nameEl) nameEl.textContent = profile?.full_name || '';

let activeTokenId = null;

async function loadDoctors() {
  const res = await apiFetch('/patient/doctors');
  const sel = document.getElementById('doctor-select');
  if (!res.success) { sel.innerHTML = '<option>Failed to load doctors</option>'; return; }
  sel.innerHTML = res.data.length
    ? '<option value="">— Select a doctor —</option>' + res.data.map(d =>
        `<option value="${d.id}">${d.display_name}${d.specialty ? ` (${d.specialty})` : ''}</option>`).join('')
    : '<option value="">No doctors available today</option>';
}

async function bookToken() {
  const doctorId = document.getElementById('doctor-select').value;
  const notes    = document.getElementById('booking-notes').value;
  if (!doctorId) return showAlert('alert-box', 'Please select a doctor', 'warn');

  const res = await apiFetch('/patient/book-token', { method: 'POST', body: JSON.stringify({ doctor_id: doctorId, notes }) });
  if (!res.success) return showAlert('alert-box', res.message);

  showAlert('alert-box', `Token #${res.data.token_number} booked successfully!`, 'success');
  document.getElementById('booking-notes').value = '';
  loadMyTokens();
}

async function loadMyTokens() {
  const res = await apiFetch('/patient/my-tokens');
  if (!res.success) return;

  const tokens = res.data || [];
  const active = tokens.find(t => ['waiting','called','in_progress'].includes(t.status));

  // Show active token status card
  const activeSection = document.getElementById('active-token-section');
  if (active) {
    activeTokenId = active.id;
    activeSection.style.display = '';
    await refreshActiveToken();
  } else {
    activeSection.style.display = 'none';
    activeTokenId = null;
  }

  document.getElementById('tokens-tbody').innerHTML = tokens.map(t => `
    <tr>
      <td><strong>${t.token_number}</strong></td>
      <td>${t.doctor?.display_name || '—'}</td>
      <td>${t.booking_date}</td>
      <td>${badge(t.status)}</td>
      <td>${['waiting','called'].includes(t.status)
        ? `<button class="btn btn-danger btn-sm" onclick="cancelToken('${t.id}')" style="display:inline-flex;align-items:center;gap:.3rem">${ic.cancel} Cancel</button>`
        : '—'}</td>
    </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--muted)">No bookings yet</td></tr>';
}

async function refreshActiveToken() {
  if (!activeTokenId) return;
  const res = await apiFetch(`/patient/my-token-status/${activeTokenId}`);
  if (!res.success) return;
  const t = res.data;
  document.getElementById('active-token-display').innerHTML = `
    <div class="token-big">
      <div class="token-num-wrap"><div class="token-num">${t.token_number}</div></div>
      <div class="token-label">${badge(t.status)}</div>
      ${t.queue_position != null
        ? `<p style="margin-top:.6rem;font-size:1rem;font-weight:700;color:var(--dark)">You are <span style="color:var(--yellow)">#${t.queue_position}</span> in queue</p>`
        : ''}
      <p style="color:var(--muted);font-size:.85rem;margin-top:.35rem;display:flex;align-items:center;justify-content:center;gap:.3rem">${ic.doctors} ${t.doctor?.display_name || '—'}</p>
    </div>
    <div style="display:flex;justify-content:center;padding-bottom:1rem">
      ${['waiting','called'].includes(t.status)
        ? `<button class="btn btn-danger btn-sm" onclick="cancelToken('${t.id}')" style="display:inline-flex;align-items:center;gap:.3rem">${ic.cancel} Cancel Token</button>`
        : ''}
    </div>`;
}

async function cancelToken(id) {
  if (!confirm('Cancel this token?')) return;
  const res = await apiFetch(`/patient/tokens/${id}/cancel`, { method: 'PATCH' });
  if (!res.success) return showAlert('alert-box', res.message);
  showAlert('alert-box', 'Token cancelled.', 'success');
  loadMyTokens();
}

// Init
loadDoctors();
loadMyTokens();

// Poll active token status every 15s
setInterval(() => { if (activeTokenId) refreshActiveToken(); }, 15000);
