const { supabaseAdmin } = require('../config/supabaseClient');

// Resolves the doctor record for the authenticated doctor user
async function getDoctorByProfileId(profileId) {
  const { data, error } = await supabaseAdmin
    .from('doctors')
    .select('*')
    .eq('profile_id', profileId)
    .single();
  if (error || !data) throw Object.assign(new Error('Doctor record not found'), { status: 404 });
  return data;
}

module.exports = { getDoctorByProfileId };
