// Returns today's date as YYYY-MM-DD in IST (UTC+5:30).
// Always derives from UTC so the result is correct regardless of
// the server's local timezone setting.
function todayIST() {
  const nowUtcMs = Date.now(); // always UTC milliseconds
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(nowUtcMs + istOffsetMs);
  // Use UTC getters on the shifted date to extract IST wall-clock values
  const y = istDate.getUTCFullYear();
  const m = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const d = String(istDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

module.exports = { todayIST };
