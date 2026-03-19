// Shared auth utilities used across all pages

const API = '/api';

function getToken()   { return localStorage.getItem('sdl_token'); }
function getProfile() { return JSON.parse(localStorage.getItem('sdl_profile') || 'null'); }

function authHeaders() {
  return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` };
}

async function apiFetch(path, options = {}) {
  const res = await fetch(API + path, {
    headers: authHeaders(),
    ...options
  });
  const json = await res.json().catch(() => ({ success: false, message: 'Invalid response' }));
  return { ok: res.ok, status: res.status, ...json };
}

function logout() {
  localStorage.removeItem('sdl_token');
  localStorage.removeItem('sdl_profile');
  location.href = '/login.html';
}

function showAlert(containerId, message, type = 'error') {
  const el = document.getElementById(containerId);
  if (!el) return;
  const icons = {
    error:   `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    success: `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    info:    `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    warn:    `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
  };
  const cls = type === 'error' ? 'error' : type === 'success' ? 'success' : type === 'warn' ? 'warn' : 'info';
  el.innerHTML = `<div class="alert alert-${cls}" style="display:flex;align-items:center;gap:.5rem">${icons[cls] || icons.info}${message}</div>`;
  setTimeout(() => { if (el) el.innerHTML = ''; }, 5000);
}

function badge(status) {
  return `<span class="badge badge-${status}">${status.replace('_', ' ')}</span>`;
}

// Redirect if not authenticated or wrong role
function requireAuth(expectedRole) {
  const profile = getProfile();
  const token   = getToken();
  if (!token || !profile) { location.href = '/login.html'; return false; }
  if (expectedRole && profile.role !== expectedRole) {
    location.href = `/${profile.role}.html`;
    return false;
  }
  return true;
}

// ---- LOGIN / REGISTER (login.html only) ----
function switchTab(tab) {
  document.getElementById('login-form').style.display    = tab === 'login'    ? '' : 'none';
  document.getElementById('register-form').style.display = tab === 'register' ? '' : 'none';
  document.getElementById('tab-login').classList.toggle('active',    tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';

  const res = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: document.getElementById('login-email').value, password: document.getElementById('login-password').value })
  });

  btn.disabled = false;
  btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg> Sign In`;

  if (!res.success) return showAlert('alert-box', res.message);

  localStorage.setItem('sdl_token',   res.data.token);
  localStorage.setItem('sdl_profile', JSON.stringify(res.data.profile));

  const role = res.data.profile.role;
  location.href = role === 'admin' ? '/admin.html' : role === 'doctor' ? '/doctor.html' : '/patient.html';
}

async function handleRegister(e) {
  e.preventDefault();

  // Client-side validation
  const name     = document.getElementById('reg-name').value.trim();
  const phone    = document.getElementById('reg-phone').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-confirm')?.value;

  let valid = true;
  if (typeof fieldErr === 'function') {
    fieldErr('reg-name',     !name);
    fieldErr('reg-phone',    !/^[6-9]\d{9}$/.test(phone));
    fieldErr('reg-email',    !email || !email.includes('@'));
    fieldErr('reg-password', password.length < 6);
    if (confirm !== undefined) fieldErr('reg-confirm', password !== confirm);
    valid = name && /^[6-9]\d{9}$/.test(phone) && email.includes('@') && password.length >= 6 && (confirm === undefined || password === confirm);
  } else {
    if (confirm !== undefined && password !== confirm) {
      return showAlert('alert-box', 'Passwords do not match');
    }
  }
  if (!valid) return;

  const btn = document.getElementById('reg-btn');
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span>';

  const res = await apiFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ full_name: name, phone, email, password })
  });

  btn.disabled = false;
  btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg> Create Patient Account`;

  if (!res.success) return showAlert('alert-box', res.message);
  showAlert('alert-box', 'Account created! Please sign in.', 'success');
  switchTab('login');
}
