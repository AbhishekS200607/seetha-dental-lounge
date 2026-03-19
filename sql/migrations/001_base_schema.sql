-- ============================================================
-- Migration 001 — Base schema
-- Tables, indexes, triggers.
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  phone       TEXT,
  role        TEXT NOT NULL DEFAULT 'patient' CHECK (role IN ('admin', 'doctor', 'patient')),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  is_banned   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS doctors (
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

CREATE TABLE IF NOT EXISTS tokens (
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
  CONSTRAINT uq_token_per_doctor_day UNIQUE (doctor_id, booking_date, token_number)
);

CREATE TABLE IF NOT EXISTS holidays (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  holiday_date DATE NOT NULL UNIQUE,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clinic_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_role    TEXT,
  action        TEXT NOT NULL,
  target_entity TEXT,
  target_id     TEXT,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes (IF NOT EXISTS requires Postgres 9.5+, always true on Supabase)
CREATE INDEX IF NOT EXISTS idx_tokens_doctor_date  ON tokens (doctor_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_tokens_patient      ON tokens (patient_id);
CREATE INDEX IF NOT EXISTS idx_tokens_status       ON tokens (status);
CREATE INDEX IF NOT EXISTS idx_tokens_booking_date ON tokens (booking_date);
CREATE INDEX IF NOT EXISTS idx_audit_actor         ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_created       ON audit_logs (created_at);

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profiles_updated_at') THEN
    CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_doctors_updated_at') THEN
    CREATE TRIGGER trg_doctors_updated_at  BEFORE UPDATE ON doctors  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tokens_updated_at') THEN
    CREATE TRIGGER trg_tokens_updated_at   BEFORE UPDATE ON tokens   FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;
