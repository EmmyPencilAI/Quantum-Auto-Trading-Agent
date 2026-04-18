import { createClient } from '@supabase/supabase-js';

// Using the names provided by the user, Fallback to VITE_ prefixed for local dev/Vite standards
const supabaseUrl = (import.meta.env as any).NEXT_PUBLIC_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = (import.meta.env as any).NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabaseClient: any = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.error("Error creating Supabase client:", error);
  }
} else {
  console.warn("Supabase credentials missing. App may not function correctly.");
}

export const supabase = supabaseClient;
