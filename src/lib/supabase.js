import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing REACT_APP_SUPABASE_URL or REACT_APP_SUPABASE_ANON_KEY environment variables');
}

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

export const CATEGORY_LABELS = {
  'Balance & Stability': 'Balance & Stability',
  'Hip Strength': 'Hip Strength',
  'Lower Body Strength': 'Lower Body Strength',
  'Mobility & Flexibility': 'Mobility & Flexibility',
  'Posture & Alignment': 'Posture & Alignment',
  'Shoulder & Upper Body': 'Shoulder & Upper Body',
  'Spinal Health': 'Spinal Health',
  'Weight-Bearing & Impact': 'Weight-Bearing & Impact',
};
