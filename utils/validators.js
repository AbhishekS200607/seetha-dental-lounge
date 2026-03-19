const PHONE_RE = /^[6-9]\d{9}$/; // Indian mobile numbers

function validatePhone(phone) {
  return PHONE_RE.test((phone || '').replace(/\s+/g, ''));
}

function validateRequired(obj, fields) {
  return fields.filter(f => !obj[f] || String(obj[f]).trim() === '');
}

module.exports = { validatePhone, validateRequired };
