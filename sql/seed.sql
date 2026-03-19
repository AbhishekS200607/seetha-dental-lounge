-- ============================================================
-- Seetha Dental Lounge - Seed Data
-- ============================================================
-- NOTE: Run AFTER creating real auth users in Supabase Auth.
-- Replace UUIDs with actual auth.users IDs.

-- Clinic settings
INSERT INTO clinic_settings (key, value) VALUES
  ('clinic_name',    'Seetha Dental Lounge'),
  ('clinic_address', 'Junction, Paravur, Kerala 691301'),
  ('clinic_phone',   '080753 33723'),
  ('opens_at',       '09:30'),
  ('enforce_hours',  'false');

-- Holidays (examples)
INSERT INTO holidays (holiday_date, description) VALUES
  ('2025-01-26', 'Republic Day'),
  ('2025-08-15', 'Independence Day');

-- ============================================================
-- Sample profiles and doctors
-- (Replace <admin-uuid>, <doctor1-uuid>, <doctor2-uuid> with
--  real Supabase Auth user IDs after creating them)
-- ============================================================

/*
INSERT INTO profiles (id, full_name, phone, role) VALUES
  ('<admin-uuid>',   'Admin User',      '9000000001', 'admin'),
  ('<doctor1-uuid>', 'Dr. Priya Nair',  '9000000002', 'doctor'),
  ('<doctor2-uuid>', 'Dr. Arjun Menon', '9000000003', 'doctor');

INSERT INTO doctors (profile_id, display_name, specialty, consultation_start_time, consultation_end_time) VALUES
  ('<doctor1-uuid>', 'Dr. Priya Nair',  'General Dentistry',  '09:30', '17:00'),
  ('<doctor2-uuid>', 'Dr. Arjun Menon', 'Orthodontics',       '10:00', '18:00');
*/
