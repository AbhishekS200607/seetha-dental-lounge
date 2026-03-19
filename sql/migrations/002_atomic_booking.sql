-- ============================================================
-- Migration 002 — Atomic booking & rebooking support
-- Partial unique index + book_token_atomic function.
-- Safe to re-run: DROP IF EXISTS before CREATE.
-- ============================================================

-- Partial unique index: one non-cancelled token per patient+doctor+day.
-- Allows rebooking after cancellation.
DROP INDEX IF EXISTS uq_active_booking;
CREATE UNIQUE INDEX uq_active_booking
  ON tokens (patient_id, doctor_id, booking_date)
  WHERE status <> 'cancelled';

-- Atomic booking: advisory lock + token number + insert in one transaction.
-- Replaces the old get_next_token_number() two-step approach.
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
