-- ============================================================
-- Seetha Dental Lounge - Row Level Security Policies
-- ============================================================

ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tokens         ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays       ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs     ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper: check caller role
-- ============================================================
CREATE OR REPLACE FUNCTION auth_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- PROFILES policies
-- ============================================================
-- Users read their own profile; admins read all
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (id = auth.uid() OR auth_role() = 'admin');

-- Users update their own profile; admins update any
CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (id = auth.uid() OR auth_role() = 'admin');

-- Insert handled by backend service role on registration
CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  WITH CHECK (id = auth.uid() OR auth_role() = 'admin');

-- Only admins delete profiles
CREATE POLICY "profiles_delete" ON profiles FOR DELETE
  USING (auth_role() = 'admin');

-- ============================================================
-- DOCTORS policies
-- ============================================================
-- Patients and doctors can read active doctors; admins read all
CREATE POLICY "doctors_select" ON doctors FOR SELECT
  USING (is_available = TRUE OR auth_role() IN ('admin', 'doctor'));

-- Only admins insert/update/delete doctors
CREATE POLICY "doctors_insert" ON doctors FOR INSERT
  WITH CHECK (auth_role() = 'admin');

CREATE POLICY "doctors_update" ON doctors FOR UPDATE
  USING (auth_role() = 'admin');

CREATE POLICY "doctors_delete" ON doctors FOR DELETE
  USING (auth_role() = 'admin');

-- ============================================================
-- TOKENS policies
-- ============================================================
-- Patients see their own tokens
CREATE POLICY "tokens_patient_select" ON tokens FOR SELECT
  USING (
    patient_id = auth.uid()
    OR auth_role() = 'admin'
    OR (
      auth_role() = 'doctor'
      AND doctor_id IN (SELECT id FROM doctors WHERE profile_id = auth.uid())
    )
  );

-- Patients insert their own tokens
CREATE POLICY "tokens_patient_insert" ON tokens FOR INSERT
  WITH CHECK (patient_id = auth.uid() OR auth_role() = 'admin');

-- Updates: patient cancels own, doctor updates own queue, admin updates any
CREATE POLICY "tokens_update" ON tokens FOR UPDATE
  USING (
    patient_id = auth.uid()
    OR auth_role() = 'admin'
    OR (
      auth_role() = 'doctor'
      AND doctor_id IN (SELECT id FROM doctors WHERE profile_id = auth.uid())
    )
  );

-- ============================================================
-- HOLIDAYS policies
-- ============================================================
CREATE POLICY "holidays_select" ON holidays FOR SELECT USING (TRUE);
CREATE POLICY "holidays_admin_write" ON holidays FOR ALL USING (auth_role() = 'admin');

-- ============================================================
-- CLINIC SETTINGS policies
-- ============================================================
CREATE POLICY "settings_select" ON clinic_settings FOR SELECT USING (TRUE);
CREATE POLICY "settings_admin_write" ON clinic_settings FOR ALL USING (auth_role() = 'admin');

-- ============================================================
-- AUDIT LOGS policies
-- ============================================================
CREATE POLICY "audit_admin_select" ON audit_logs FOR SELECT USING (auth_role() = 'admin');
-- Inserts done via service role only (backend)
