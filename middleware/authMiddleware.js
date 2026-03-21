const { supabaseAdmin, supabaseAnon } = require('../config/supabaseClient');

// Verifies Bearer JWT and attaches req.user (profile row)
async function authenticate(req, res, next) {
  // 1. Try to get token from httpOnly cookie or Authorization header
  const token = req.cookies?.sdl_token || req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Missing session' });
  }

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

  req.user = { ...profile, email: user.email };
  next();
}

module.exports = { authenticate };
