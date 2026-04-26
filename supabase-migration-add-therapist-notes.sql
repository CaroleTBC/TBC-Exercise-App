-- Migration: Add therapist_notes to programme_exercises
-- Therapist-only private notes per exercise assignment.
-- These are never shown to clients. Use client_notes for anything the client should see.

ALTER TABLE programme_exercises
  ADD COLUMN IF NOT EXISTS therapist_notes TEXT;
