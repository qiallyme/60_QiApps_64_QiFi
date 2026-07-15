/**
 * Shared Supabase client instance for QiFi web app.
 * Import this singleton anywhere you need Supabase access.
 */
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://emnskvvajdlqixwzjfsm.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtbnNrdnZhamRscWl4d3pqZnNtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNjEyMTAsImV4cCI6MjA5NjkzNzIxMH0.7v_iGqu1BtAWYnwzk0x_tjcd4q3-yNxoHfrJW1bW2Sc',
);
