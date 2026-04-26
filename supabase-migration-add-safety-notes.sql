-- Migration: Add safety_notes to exercises
-- A dedicated field for contraindications, precautions, and safety warnings.
-- Displayed in a highlighted amber box in the therapist exercise library.
-- Never shown to clients.

ALTER TABLE exercises ADD COLUMN IF NOT EXISTS safety_notes TEXT;
