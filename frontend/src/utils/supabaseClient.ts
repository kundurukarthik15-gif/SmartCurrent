import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Safely initialize Supabase client to avoid crashing on startup if env variables are missing
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : {
      auth: {
        signInWithPassword: async () => ({ data: { user: null, session: null }, error: new Error("Supabase is not configured. Please check VITE_SUPABASE_URL environment variable.") }),
        signUp: async () => ({ data: { user: null, session: null }, error: new Error("Supabase is not configured. Please check VITE_SUPABASE_URL environment variable.") }),
        signOut: async () => {},
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
      }
    } as any;

