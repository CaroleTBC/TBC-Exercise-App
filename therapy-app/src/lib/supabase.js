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
  'strength',
  'impact',
  'spinal',
  'balance',
];

export const CATEGORY_LABELS = {
  strength: 'Strength & Loading',
  impact: 'Impact & Bone Loading',
  spinal: 'Posture & Spinal Strength',
  balance: 'Balance & Fall Prevention',
};
