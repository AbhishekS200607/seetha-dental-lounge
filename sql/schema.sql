-- ============================================================
-- Seetha Dental Lounge - Database Schema
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  phone       TEXT,
  role        TEXT NOT NULL DEFAULT 'patient' CHECK (role IN ('admin', 'doctor', 'patient')),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  is_banned   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DOCTORS
-- ============================================================
CREATE TABLE doctors (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id              UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  display_name            TEXT NOT NULL,
  specialty               TEXT,
  consultation_start_time TIME,
  consultation_end_time   TIME,
  is_available            BOOLEAN NOT NULL DEFAULT TRUE,
  max_daily_tokens        INTEGER,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_doctor_profile UNIQUE (profile_id)
);

-- ============================================================
-- TOKENS
-- ============================================================
CREATE TABLE tokens (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id              UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  doctor_id               UUID NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
  token_number            INTEGER NOT NULL,
  booking_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  status                  TEXT NOT NULL DEFAULT 'waiting'
                            CHECK (status IN ('waiting','called','in_progress','completed','skipped','cancelled')),
  notes                   TEXT,
  cancel_reason           TEXT,
  queue_position_snapshot INTEGER,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  called_at               TIMESTAMPTZ,
  completed_at            TIMESTAMPTZ,
  cancelled_at            TIMESTAMPTZ,
  skipped_at              TIMESTAMPTZ,

  -- Prevent duplicate token numbers per doctor per day
  CONSTRAINT uq_token_per_doctor_day UNIQUE (doctor_id, booking_date, token_number)
);

-- Partial unique index: only one non-cancelled token per patient+doctor+day.
-- Excludes cancelled rows so rebooking after cancellation works correctly.
CREATE UNIQUE INDEX uq_active_booking
  ON tokens (patient_id, doctor_id, booking_date)
  WHERE status <> 'cancelled';

-- ============================================================
-- HOLIDAYS
-- ============================================================
CREATE TABLE holidays (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  holiday_date DATE NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CLINIC SETTINGS
-- ============================================================
CREATE TABLE clinic_settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_role    TEXT,
  action        TEXT NOT NULL,
  target_entity TEXT,
  target_id     TEXT,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_tokens_doctor_date   ON tokens (doctor_id, booking_date);
CREATE INDEX idx_tokens_patient       ON tokens (patient_id);
CREATE INDEX idx_tokens_status        ON tokens (status);
CREATE INDEX idx_tokens_booking_date  ON tokens (booking_date);
CREATE INDEX idx_audit_actor          ON audit_logs (actor_id);
CREATE INDEX idx_audit_created        ON audit_logs (created_at);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_doctors_updated_at
  BEFORE UPDATE ON doctors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tokens_updated_at
  BEFORE UPDATE ON tokens
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- ATOMIC BOOKING FUNCTION
-- Acquires an advisory lock, computes the next token number,
-- and inserts the token row — all in one transaction.
-- The lock is released automatically at transaction end.
-- ============================================================
CREATE OR REPLACE FUNCTION book_token_atomic(
  p_patient_id UUID,
  p_doctor_id  UUID,
  p_date       DATE,
  p_notes      TEXT DEFAULT NULL
)
RETURNS tokens AS $$
DECLARE
  next_num  INTEGER;
  new_token tokens;
BEGIN
  -- Serialize concurrent bookings for the same doctor+date.
  PERFORM pg_advisory_xact_lock(hashtext(p_doctor_id::text || p_date::text));

  SELECT COALESCE(MAX(token_number), 0) + 1
    INTO next_num
    FROM tokens
   WHERE doctor_id = p_doctor_id
     AND booking_date = p_date;

  INSERT INTO tokens (patient_id, doctor_id, token_number, booking_date, status, notes)
  VALUES (p_patient_id, p_doctor_id, next_num, p_date, 'waiting', p_notes)
  RETURNING * INTO new_token;

  RETURN new_token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
