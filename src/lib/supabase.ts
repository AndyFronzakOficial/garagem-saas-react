import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'https://ncsviopwakjjchbvtioi.supabase.co',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jc3Zpb3B3YWtqamNoYnZ0aW9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3MTk2MjQsImV4cCI6MjA5NjI5NTYyNH0.RRoPnyj96WppBEr_aSguOFRG-Qgjmog1HEo0GyXl_O0'
)
