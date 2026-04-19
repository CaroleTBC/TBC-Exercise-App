import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

export const EXERCISE_CATEGORIES = [
  'Balance & Stability',
  'Hip Strength',
  'Lower Body Strength',
  'Mobility & Flexibility',
  'Posture & Alignment',
  'Shoulder & Upper Body',
  'Spinal Health',
  'Weight-Bearing & Impact',
];
