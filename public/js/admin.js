// Admin dashboard — full management logic

if (!requireAuth('admin')) { /* redirected by requireAuth */ }

// ── State ──────────────────────────────────────────────────
let editingDoctorId  = null;
let editingPatientId = null;
let doctorList       = [];
let searchTimer      = null;

// ── Section navigation ─────────────────────────────────────
function showSection(name) {
  ['dashboard','doctors','patients','tokens'].forEach(s => {
    document.getElementById(`sec-${s}`).style.display = s === name ? '' : 'none';
    document.getElementById(`nav-${s}`)?.classList.toggle('active', s === name);
  });
  if (name === 'dashboard') loadDashboard();
  if (name === 'doctors')   loadDoctors();
  if (name === 'patients')  loadPatients();
  if (name === 'tokens')    { loadDoctorFilter(); loadTokens(); }
}

// ── Dashboard ──────────────────────────────────────────────
async function loadDashboard() {
  const res = await apiFetch('/admin/dashboard');
  if (!res.success) return;
  const { summary, byDoctor } = res.data;

  document.getElementById('stat-grid').innerHTML = [
    ['Total Bookings', summary.total,       '#f5b316'],
    ['Waiting',        summary.waiting||0,  '#3182ce'],
    ['In Progress',    summary.in_progress||0,'#dd6b20'],
    ['Completed',      summary.completed||0,'#38a169'],
    ['Skipped',        summary.skipped||0,  '#e53e3e'],
    ['Cancelled',      summary.cancelled||0,'#718096']
  ].map(([l,n,c]) => `
    <div class="stat-card">
      <div class="num" style="color:${c}">${n}</div>
      <div class="lbl">${l}</div>
    </div>`).join('');

  // Doctor-wise breakdown
  if (doctorList.length && Object.keys(byDoctor).length) {
    const rows = Object.entries(byDoctor).map(([did, count]) => {
      const doc = doctorList.find(d => d.id === did);
      return `<tr><td>${doc?.display_name || did}</td><td><strong>${count}</strong></td></tr>`;
    }).join('');
    document.getElementById('doctor-stats-wrap').innerHTML = `
      <div class="card">
        <p class="card-title">Doctor-wise Bookings Today</p>
        <div class="table-wrap"><table>
          <thead><tr><th>Doctor</th><th>Tokens</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>`;
  }
}

// ── Doctors ────────────────────────────────────────────────
async function loadDoctors() {
  const res = await apiFetch('/admin/doctors');
  if (!res.success) return;
  doctorList = res.data;

  document.getElementById('doctors-tbody').innerHTML = res.data.length
    ? res.data.map(d => `
      <tr>
        <td>
          <strong>${d.display_name}</strong><br>
          <span style="font-size:.78rem;color:var(--muted)">${d.profile?.phone || '—'}</span>
        </td>
        <td>${d.specialty || '—'}</td>
        <td style="white-space:nowrap">${d.consultation_start_time || '—'} – ${d.consultation_end_time || '—'}</td>
        <td>${d.max_daily_tokens || '∞'}</td>
        <td>
          <label style="cursor:pointer;display:flex;align-items:center;gap:.35rem">
            <input type="checkbox" ${d.is_available ? 'checked' : ''} onchange="toggleAvailability('${d.id}',this.checked)">
            <span style="font-size:.82rem">${d.is_available ? 'Yes' : 'No'}</span>
          </label>
        </td>
        <td style="white-space:nowrap">
          <button class="btn btn-secondary btn-sm" onclick="openDoctorModal('${d.id}')" style="display:inline-flex;align-items:center;gap:.3rem">${ic.edit} Edit</button>
          <button class="btn btn-secondary btn-sm" onclick="viewDoctorQueue('${d.id}','${d.display_name}')" style="display:inline-flex;align-items:center;gap:.3rem">${ic.queue} Queue</button>
        </td>
      </tr>`).join('')
    : '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:2rem">No doctors found</td></tr>';
}

async function toggleAvailability(id, val) {
  const res = await apiFetch(`/admin/doctors/${id}/availability`, { method: 'PATCH', body: JSON.stringify({ is_available: val }) });
  if (!res.success) showAlert('global-alert', res.message);
  else loadDoctors();
}

async function viewDoctorQueue(doctorId, name) {
  openHistoryDrawer(`Queue — ${name}`);
  const res = await apiFetch(`/admin/tokens?doctor_id=${doctorId}`);
  renderDrawerTokens(res);
}

// Doctor modal
function openDoctorModal(id = null) {
  editingDoctorId = id;
  const isEdit = !!id;
  document.getElementById('doctor-modal-title').textContent = isEdit ? 'Edit Doctor' : 'Add Doctor';
  document.getElementById('doctor-modal-alert').innerHTML = '';
  document.getElementById('dm-password-group').style.display = isEdit ? 'none' : '';

  if (!isEdit) {
    document.getElementById('doctor-form').reset();
    document.getElementById('dm-available').checked = true;
  } else {
    // Pre-fill from doctorList
    const d = doctorList.find(x => x.id === id);
    if (d) {
      document.getElementById('dm-name').value      = d.display_name || '';
      document.getElementById('dm-email').value     = '';  // can't read back email
      document.getElementById('dm-phone').value     = d.profile?.phone || '';
      document.getElementById('dm-specialty').value = d.specialty || '';
      document.getElementById('dm-start').value     = d.consultation_start_time || '';
      document.getElementById('dm-end').value       = d.consultation_end_time || '';
      document.getElementById('dm-max').value       = d.max_daily_tokens || '';
      document.getElementById('dm-available').checked = d.is_available;
    }
  }
  document.getElementById('doctor-modal').style.display = 'flex';
}

function closeDoctorModal() {
  document.getElementById('doctor-modal').style.display = 'none';
  editingDoctorId = null;
}

async function saveDoctorForm(e) {
  e.preventDefault();
  const alertEl = document.getElementById('doctor-modal-alert');
  alertEl.innerHTML = '';

  const name     = document.getElementById('dm-name').value.trim();
  const email    = document.getElementById('dm-email').value.trim();
  const password = document.getElementById('dm-password').value;
  const phone    = document.getElementById('dm-phone').value.trim();

  if (!name) { alertEl.innerHTML = alertHtml('Name is required'); return; }
  if (!editingDoctorId && !email) { alertEl.innerHTML = alertHtml('Email is required'); return; }
  if (!editingDoctorId && password.length < 6) { alertEl.innerHTML = alertHtml('Password must be at least 6 characters'); return; }

  const btn = document.getElementById('doctor-save-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';

  const body = {
    display_name:             name,
    email,
    phone:                    phone || undefined,
    password:                 password || undefined,
    specialty:                document.getElementById('dm-specialty').value || undefined,
    consultation_start_time:  document.getElementById('dm-start').value || null,
    consultation_end_time:    document.getElementById('dm-end').value || null,
    max_daily_tokens:         document.getElementById('dm-max').value ? parseInt(document.getElementById('dm-max').value) : null,
    is_available:             document.getElementById('dm-available').checked
  };

  const res = editingDoctorId
    ? await apiFetch(`/admin/doctors/${editingDoctorId}`, { method: 'PUT', body: JSON.stringify(body) })
    : await apiFetch('/admin/doctors', { method: 'POST', body: JSON.stringify(body) });

  btn.disabled = false; btn.textContent = 'Save Doctor';

  if (!res.success) { alertEl.innerHTML = alertHtml(res.message); return; }
  closeDoctorModal();
  loadDoctors();
  showAlert('global-alert', editingDoctorId ? 'Doctor updated.' : 'Doctor account created.', 'success');
}

// ── Patients ───────────────────────────────────────────────
async function loadPatients() {
  const search = document.getElementById('patient-search')?.value.trim() || '';
  const url = `/admin/users?role=patient${search ? `&search=${encodeURIComponent(search)}` : ''}`;
  const res = await apiFetch(url);
  if (!res.success) return;

  document.getElementById('patients-tbody').innerHTML = res.data.length
    ? res.data.map(u => `
      <tr>
        <td><strong>${u.full_name}</strong></td>
        <td>${u.phone || '—'}</td>
        <td>${statusBadge(u)}</td>
        <td style="font-size:.8rem;color:var(--muted)">${new Date(u.created_at).toLocaleDateString('en-IN')}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-secondary btn-sm" onclick="openPatientModal('${u.id}','${escHtml(u.full_name)}','${u.phone||''}')" style="display:inline-flex;align-items:center;gap:.3rem">${ic.edit} Edit</button>
          <button class="btn btn-secondary btn-sm" onclick="viewPatientHistory('${u.id}','${escHtml(u.full_name)}')" style="display:inline-flex;align-items:center;gap:.3rem">${ic.history} History</button>
          ${u.is_banned
            ? `<button class="btn btn-success btn-sm" onclick="setUserStatus('${u.id}',{is_banned:false})" style="display:inline-flex;align-items:center;gap:.3rem">${ic.unlock} Unban</button>`
            : `<button class="btn btn-danger btn-sm" onclick="setUserStatus('${u.id}',{is_banned:true})" style="display:inline-flex;align-items:center;gap:.3rem">${ic.ban} Ban</button>`}
          ${u.is_active
            ? `<button class="btn btn-secondary btn-sm" onclick="setUserStatus('${u.id}',{is_active:false})" style="display:inline-flex;align-items:center;gap:.3rem">${ic.cancel} Deactivate</button>`
            : `<button class="btn btn-success btn-sm" onclick="setUserStatus('${u.id}',{is_active:true})" style="display:inline-flex;align-items:center;gap:.3rem">${ic.check} Activate</button>`}
        </td>
      </tr>`).join('')
    : '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:2rem">No patients found</td></tr>';
}

function debounceSearch() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadPatients, 350);
}

async function setUserStatus(id, update) {
  const res = await apiFetch(`/admin/users/${id}/status`, { method: 'PATCH', body: JSON.stringify(update) });
  if (res.success) loadPatients();
  else showAlert('global-alert', res.message);
}

async function viewPatientHistory(id, name) {
  openHistoryDrawer(`Token History — ${name}`);
  const res = await apiFetch(`/admin/users/${id}/tokens`);
  renderDrawerTokens(res);
}

// Patient modal
function openPatientModal(id = null, name = '', phone = '') {
  editingPatientId = id;
  const isEdit = !!id;
  document.getElementById('patient-modal-title').textContent = isEdit ? 'Edit Patient' : 'Add Patient';
  document.getElementById('patient-modal-alert').innerHTML = '';
  document.getElementById('pm-password-group').style.display = isEdit ? 'none' : '';

  document.getElementById('pm-name').value  = name;
  document.getElementById('pm-phone').value = phone;
  if (!isEdit) {
    document.getElementById('pm-email').value    = '';
    document.getElementById('pm-password').value = '';
    document.getElementById('pm-status').value   = 'active';
  }
  document.getElementById('patient-modal').style.display = 'flex';
}

function closePatientModal() {
  document.getElementById('patient-modal').style.display = 'none';
  editingPatientId = null;
}

async function savePatientForm(e) {
  e.preventDefault();
  const alertEl = document.getElementById('patient-modal-alert');
  alertEl.innerHTML = '';

  const name     = document.getElementById('pm-name').value.trim();
  const phone    = document.getElementById('pm-phone').value.trim();
  const email    = document.getElementById('pm-email').value.trim();
  const password = document.getElementById('pm-password').value;
  const status   = document.getElementById('pm-status').value;

  if (!name)  { alertEl.innerHTML = alertHtml('Full name is required'); return; }
  if (!phone) { alertEl.innerHTML = alertHtml('Phone number is required'); return; }
  if (!editingPatientId && !email)    { alertEl.innerHTML = alertHtml('Email is required'); return; }
  if (!editingPatientId && password.length < 6) { alertEl.innerHTML = alertHtml('Password must be at least 6 characters'); return; }

  const btn = document.getElementById('patient-save-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';

  let res;
  if (editingPatientId) {
    res = await apiFetch(`/admin/users/${editingPatientId}`, { method: 'PUT', body: JSON.stringify({ full_name: name, phone }) });
  } else {
    res = await apiFetch('/admin/users', {
      method: 'POST',
      body: JSON.stringify({ full_name: name, phone, email, password, role: 'patient', is_active: status === 'active' })
    });
  }

  btn.disabled = false; btn.textContent = 'Save Patient';

  if (!res.success) { alertEl.innerHTML = alertHtml(res.message); return; }
  closePatientModal();
  loadPatients();
  showAlert('global-alert', editingPatientId ? 'Patient updated.' : 'Patient account created.', 'success');
}

// ── Tokens ─────────────────────────────────────────────────
async function loadDoctorFilter() {
  if (doctorList.length) return; // already loaded
  const res = await apiFetch('/admin/doctors');
  if (!res.success) return;
  doctorList = res.data;
  const sel = document.getElementById('token-doctor-filter');
  res.data.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id; opt.textContent = d.display_name;
    sel.appendChild(opt);
  });
}

async function loadTokens() {
  const date     = document.getElementById('token-date-filter')?.value || '';
  const doctorId = document.getElementById('token-doctor-filter')?.value || '';
  let url = '/admin/tokens?';
  if (date)     url += `date=${date}&`;
  if (doctorId) url += `doctor_id=${doctorId}`;

  const res = await apiFetch(url);
  if (!res.success) return;

  document.getElementById('tokens-tbody').innerHTML = res.data.length
    ? res.data.map(t => `
      <tr>
        <td><strong>${t.token_number}</strong></td>
        <td>${t.patient?.full_name || '—'}<br><span style="font-size:.75rem;color:var(--muted)">${t.patient?.phone||''}</span></td>
        <td>${t.doctor?.display_name || '—'}</td>
        <td>${badge(t.status)}</td>
        <td style="font-size:.82rem">${t.booking_date}</td>
        <td style="font-size:.82rem;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.notes||'—'}</td>
        <td>${!['completed','cancelled'].includes(t.status)
          ? `<button class="btn btn-danger btn-sm" onclick="adminCancel('${t.id}')" style="display:inline-flex;align-items:center;gap:.3rem">${ic.cancel} Cancel</button>`
          : '—'}</td>
      </tr>`).join('')
    : '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:2rem">No tokens found</td></tr>';
}

async function adminCancel(id) {
  if (!confirm('Cancel this token?')) return;
  const res = await apiFetch(`/admin/tokens/${id}/cancel`, { method: 'PATCH', body: JSON.stringify({ cancel_reason: 'Cancelled by admin' }) });
  if (res.success) { loadTokens(); showAlert('global-alert', 'Token cancelled.', 'success'); }
  else showAlert('global-alert', res.message);
}

// ── Drawer (token history) ─────────────────────────────────
function openHistoryDrawer(title) {
  document.getElementById('drawer-title').textContent = title;
  document.getElementById('drawer-body').innerHTML = '<div class="loading-overlay"><span class="spinner"></span></div>';
  document.getElementById('history-backdrop').classList.add('open');
  document.getElementById('history-drawer').classList.add('open');
}

function closeHistoryDrawer() {
  document.getElementById('history-backdrop').classList.remove('open');
  document.getElementById('history-drawer').classList.remove('open');
}

function renderDrawerTokens(res) {
  if (!res.success) {
    document.getElementById('drawer-body').innerHTML = `<div class="alert alert-error">${res.message}</div>`;
    return;
  }
  if (!res.data.length) {
    document.getElementById('drawer-body').innerHTML = '<p style="color:var(--muted);text-align:center;padding:2rem">No tokens found.</p>';
    return;
  }
  document.getElementById('drawer-body').innerHTML = res.data.map(t => `
    <div class="card" style="margin-bottom:.75rem;padding:1rem">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.4rem">
        <span style="font-size:1.3rem;font-weight:800;color:var(--yellow)">#${t.token_number}</span>
        ${badge(t.status)}
      </div>
      <div style="font-size:.85rem;color:var(--muted);display:flex;flex-wrap:wrap;gap:.5rem">
        ${t.doctor?.display_name  ? `<span style="display:inline-flex;align-items:center;gap:.25rem">${ic.tooth} ${t.doctor.display_name}</span>` : ''}
        ${t.patient?.full_name    ? `<span style="display:inline-flex;align-items:center;gap:.25rem">${ic.user} ${t.patient.full_name}</span>` : ''}
      </div>
      <div style="font-size:.8rem;color:var(--muted);margin-top:.25rem;display:flex;align-items:center;gap:.25rem">${ic.calendar} ${t.booking_date}</div>
      ${t.notes ? `<div style="font-size:.8rem;margin-top:.25rem;display:flex;align-items:center;gap:.25rem">${ic.note} ${t.notes}</div>` : ''}
      ${t.cancel_reason ? `<div style="font-size:.8rem;color:#e53e3e;margin-top:.25rem;display:flex;align-items:center;gap:.25rem">${ic.cancel} ${t.cancel_reason}</div>` : ''}
    </div>`).join('');
}

// ── Helpers ────────────────────────────────────────────────
function alertHtml(msg) {
  return `<div class="alert alert-error">${msg}</div>`;
}

function statusBadge(u) {
  if (u.is_banned)  return '<span class="badge badge-cancelled">Banned</span>';
  if (!u.is_active) return '<span class="badge badge-skipped">Inactive</span>';
  return '<span class="badge badge-completed">Active</span>';
}

function escHtml(str) {
  return (str || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function handleBackdropClick(e, modalId) {
  if (e.target.id === modalId) {
    if (modalId === 'doctor-modal')  closeDoctorModal();
    if (modalId === 'patient-modal') closePatientModal();
  }
}

function togglePwModal(id, btn) {
  const inp = document.getElementById(id);
  const isText = inp.type === 'password';
  inp.type = isText ? 'text' : 'password';
  btn.innerHTML = isText ? ic.eyeOff : ic.eye;
}

// ── Init ───────────────────────────────────────────────────
loadDashboard();
// Pre-load doctor list for dashboard breakdown
apiFetch('/admin/doctors').then(r => { if (r.success) doctorList = r.data; });

// Auto-refresh dashboard every 20s when visible
setInterval(() => {
  if (document.getElementById('sec-dashboard').style.display !== 'none') loadDashboard();
}, 20000);
