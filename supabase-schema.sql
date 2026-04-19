-- ============================================================
-- THERAPY BY CAROLE — SUPABASE SCHEMA
-- Run this in Supabase SQL Editor to set up your database
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────
-- PROFILES (extends Supabase auth.users)
-- ─────────────────────────────────────────────
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('client', 'therapist')),
  date_of_birth DATE,
  phone TEXT,
  gdpr_consent BOOLEAN DEFAULT false,
  gdpr_consent_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- EXERCISES MASTER LIBRARY
-- ─────────────────────────────────────────────
CREATE TABLE exercises (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  video_url TEXT,
  video_type TEXT CHECK (video_type IN ('youtube', 'vimeo', 'upload')),
  default_sets INTEGER DEFAULT 3,
  default_reps TEXT DEFAULT '10',
  default_hold_seconds INTEGER,
  default_rest_seconds INTEGER DEFAULT 60,
  therapist_notes_template TEXT,
  ai_generated BOOLEAN DEFAULT false,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- CLIENT EXERCISE PROGRAMMES
-- ─────────────────────────────────────────────
CREATE TABLE client_programmes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  therapist_id UUID REFERENCES profiles(id) NOT NULL,
  name TEXT NOT NULL DEFAULT 'My Exercise Programme',
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  start_date DATE DEFAULT CURRENT_DATE,
  review_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- PROGRAMME EXERCISES (exercises assigned to a programme)
-- ─────────────────────────────────────────────
CREATE TABLE programme_exercises (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  programme_id UUID REFERENCES client_programmes(id) ON DELETE CASCADE NOT NULL,
  exercise_id UUID REFERENCES exercises(id) NOT NULL,
  sets INTEGER,
  reps TEXT,
  hold_seconds INTEGER,
  rest_seconds INTEGER,
  client_notes TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- ADDITIONAL INFORMATION (therapist can post articles/notes)
-- ─────────────────────────────────────────────
CREATE TABLE client_information (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  therapist_id UUID REFERENCES profiles(id) NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'General',
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- COMPLIANCE LOGS (client records exercise completion)
-- ─────────────────────────────────────────────
CREATE TABLE compliance_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  programme_id UUID REFERENCES client_programmes(id) ON DELETE CASCADE NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL CHECK (status IN ('completed', 'partial', 'missed')),
  exercises_completed INTEGER DEFAULT 0,
  exercises_total INTEGER DEFAULT 0,
  notes TEXT,
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, programme_id, log_date)
);

-- ─────────────────────────────────────────────
-- EXERCISE COMPLETION (individual exercise tracking)
-- ─────────────────────────────────────────────
CREATE TABLE exercise_completions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  compliance_log_id UUID REFERENCES compliance_logs(id) ON DELETE CASCADE NOT NULL,
  programme_exercise_id UUID REFERENCES programme_exercises(id) NOT NULL,
  completed BOOLEAN DEFAULT false,
  difficulty_rating INTEGER CHECK (difficulty_rating BETWEEN 1 AND 5),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE programme_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_information ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_completions ENABLE ROW LEVEL SECURITY;

-- Profiles: users see their own, therapists see all
CREATE POLICY "Users see own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Therapists see all profiles" ON profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'therapist')
);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Therapists insert profiles" ON profiles FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'therapist')
  OR auth.uid() = id
);

-- Exercises: anyone authenticated can read, therapists can write
CREATE POLICY "Authenticated read exercises" ON exercises FOR SELECT TO authenticated USING (true);
CREATE POLICY "Therapists manage exercises" ON exercises FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'therapist')
);

-- Client programmes
CREATE POLICY "Clients see own programmes" ON client_programmes FOR SELECT USING (client_id = auth.uid());
CREATE POLICY "Therapists manage programmes" ON client_programmes FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'therapist')
);

-- Programme exercises
CREATE POLICY "Clients see own programme exercises" ON programme_exercises FOR SELECT USING (
  EXISTS (SELECT 1 FROM client_programmes WHERE id = programme_id AND client_id = auth.uid())
);
CREATE POLICY "Therapists manage programme exercises" ON programme_exercises FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'therapist')
);

-- Client information
CREATE POLICY "Clients see own info" ON client_information FOR SELECT USING (client_id = auth.uid());
CREATE POLICY "Therapists manage client info" ON client_information FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'therapist')
);

-- Compliance
CREATE POLICY "Clients manage own compliance" ON compliance_logs FOR ALL USING (client_id = auth.uid());
CREATE POLICY "Therapists see all compliance" ON compliance_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'therapist')
);

CREATE POLICY "Clients manage own completions" ON exercise_completions FOR ALL USING (
  EXISTS (SELECT 1 FROM compliance_logs WHERE id = compliance_log_id AND client_id = auth.uid())
);
CREATE POLICY "Therapists see completions" ON exercise_completions FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'therapist')
);

-- ─────────────────────────────────────────────
-- TRIGGERS: auto-update updated_at
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_exercises_updated BEFORE UPDATE ON exercises FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_programmes_updated BEFORE UPDATE ON client_programmes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_info_updated BEFORE UPDATE ON client_information FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─────────────────────────────────────────────
-- SEED: Create initial therapist account
-- Note: Create the user via Supabase Auth first, then run:
-- INSERT INTO profiles (id, full_name, email, role, gdpr_consent, gdpr_consent_date)
-- VALUES ('<your-auth-user-id>', 'Carole Andrews', 'info@therapybycarole.co.uk', 'therapist', true, NOW());
-- ─────────────────────────────────────────────
