// Patient dashboard logic

if (!requireAuth('patient')) { /* redirected */ }

const profile = getProfile();
const nameEl = document.getElementById('patient-name-text');
if (nameEl) nameEl.textContent = profile?.full_name || 'Patient';

let activeTokenId = null;

// Initialize form defaults
window.addEventListener('load', () => {
  const dateInp = document.getElementById('booking-date');
  if (dateInp) {
    const today = new Date().toISOString().split('T')[0];
    dateInp.value = today;
    dateInp.min = today;
  }
});

async function loadDoctors() {
  const res = await apiFetch('/patient/doctors');
  const sel = document.getElementById('doctor-select');
  if (!res.success) { sel.innerHTML = '<option>Failed to load specialists</option>'; return; }
  sel.innerHTML = res.data.length
    ? '<option value="">— Select Specialist —</option>' + res.data.map(d =>
        `<option value="${d.id}">${d.display_name}${d.specialty ? ` (${d.specialty})` : ''}</option>`).join('')
    : '<option value="">No specialists available currently</option>';
}

async function bookToken() {
  const doctorId = document.getElementById('doctor-select').value;
  const date     = document.getElementById('booking-date').value;
  const slot     = document.getElementById('slot-time').value;
  const notes    = document.getElementById('booking-notes').value;

  if (!doctorId) return showAlert('alert-box', 'Please select a specialist', 'warn');
  if (!date) return showAlert('alert-box', 'Please select a date', 'warn');

  const res = await apiFetch('/patient/book-token', { 
    method: 'POST', 
    body: JSON.stringify({ 
      doctor_id: doctorId, 
      booking_date: date,
      slot_time: slot,
      notes 
    }) 
  });

  if (!res.success) return showAlert('alert-box', res.message);

  showAlert('alert-box', `Token #${res.data.token_number} issued for ${date}.`, 'success');
  document.getElementById('booking-notes').value = '';
  loadMyTokens();
}

function formatToken(t) {
  if (!t) return '';
  const slot = t.slot_time || '';
  const prefix = slot.startsWith('Afternoon') ? 'A-' : 'M-';
  return `${prefix}${t.token_number}`;
}

async function loadMyTokens() {
  const res = await apiFetch('/patient/my-tokens');
  if (!res.success) return;

  const tokens = res.data || [];
  const active = tokens.find(t => ['waiting','called','in_progress'].includes(t.status));

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
    <tr class="hover:bg-slate-50/50 transition-colors">
      <td class="px-2 py-4 font-black text-primary text-lg">#${formatToken(t)}</td>
      <td class="px-2 py-4">
        <div class="font-bold text-slate-700">${t.doctor?.display_name || 'Lounge Specialist'}</div>
        <div class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">${t.doctor?.specialty || ''}</div>
      </td>
      <td class="px-2 py-4">
        <div class="text-sm font-medium text-slate-600">${t.booking_date}</div>
        <div class="text-[10px] text-slate-400 font-bold uppercase">${(t.slot_time || '').split('|')[1] || t.slot_time || ''}</div>
      </td>
      <td class="px-2 py-4">${badge(t.status)}</td>
      <td class="px-2 py-4 text-right">
        ${['waiting','called'].includes(t.status)
          ? `<button onclick="cancelToken('${t.id}')" class="p-2 text-error hover:bg-red-50 rounded-xl transition-all" title="Cancel Token">
               <span class="material-symbols-outlined">cancel</span>
             </button>`
          : '<span class="text-slate-300 material-symbols-outlined">lock</span>'}
      </td>
    </tr>`).join('') || '<tr><td colspan="5" class="py-12 text-center text-slate-400">No recent activity found</td></tr>';
}

async function refreshActiveToken() {
  if (!activeTokenId) return;
  const res = await apiFetch(`/patient/my-token-status/${activeTokenId}`);
  if (!res.success) return;
  const t = res.data;

  // Render Token Circle
  document.getElementById('active-token-display').innerHTML = `
    <div class="signature-gradient w-48 h-48 rounded-full flex flex-col items-center justify-center text-white shadow-2xl relative">
      <div class="absolute inset-2 border-2 border-white/20 rounded-full"></div>
      <span class="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-1">Your Token</span>
      <span class="text-7xl font-black font-headline tracking-tighter">#${formatToken(t)}</span>
      <div class="mt-2 px-3 py-1 bg-white/20 rounded-full text-[9px] font-bold uppercase tracking-widest">
        ${t.status}
      </div>
    </div>
  `;

  // Render Status Pills
  document.getElementById('active-token-details').innerHTML = `
    <div class="bg-white/60 px-5 py-2.5 rounded-full border border-white text-primary text-sm font-bold flex items-center gap-2 shadow-sm">
      <span class="material-symbols-outlined text-sm">medical_services</span>
      ${t.doctor?.display_name || 'Specialist'}
    </div>
    ${t.queue_position != null ? `
      <div class="bg-indigo-50 px-5 py-2.5 rounded-full border border-indigo-100 text-indigo-700 text-sm font-bold flex items-center gap-2 shadow-sm">
        <span class="material-symbols-outlined text-sm animate-bounce">person</span>
        Position: ${t.queue_position}
      </div>
    ` : ''}
    <div class="bg-emerald-50 px-5 py-2.5 rounded-full border border-emerald-100 text-emerald-700 text-sm font-bold flex items-center gap-2 shadow-sm">
      <span class="material-symbols-outlined text-sm">event_available</span>
      ${t.booking_date}
    </div>
  `;
}

async function cancelToken(id) {
  if (!confirm('Are you sure you want to release your spot in the queue?')) return;
  const res = await apiFetch(`/patient/tokens/${id}/cancel`, { method: 'PATCH' });
  if (!res.success) return showAlert('alert-box', res.message);
  showAlert('alert-box', 'Token released successfully.', 'success');
  loadMyTokens();
}

// Init
loadDoctors();
loadMyTokens();

// Poll status
setInterval(() => { if (activeTokenId) refreshActiveToken(); }, 15000);
