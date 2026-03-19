const { supabaseAdmin, supabaseAnon } = require('../config/supabaseClient');

// Verifies Bearer JWT and attaches req.user (profile row)
async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Missing token' });
  }

  const token = authHeader.split(' ')[1];

  // Verify JWT with Supabase
  const { data: { user }, error } = await supabaseAnon.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }

  // Fetch profile (role, ban status, active status)
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, role, is_active, is_banned')
    .eq('id', user.id)
    .single();

  if (profileErr || !profile) {
    return res.status(401).json({ success: false, message: 'Profile not found' });
  }

  if (!profile.is_active || profile.is_banned) {
    return res.status(403).json({ success: false, message: 'Account suspended or banned' });
  }

  req.user = profile;
  next();
}

module.exports = { authenticate };
