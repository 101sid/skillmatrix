import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://mrsvqdhdbpspzdmgsuqu.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1yc3ZxZGhkYnBzcHpkbWdzdXF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MTQxNjksImV4cCI6MjA5MDI5MDE2OX0.r1r0QxVn3WxAxO0VUIVAqSEuooVepqapv7Fr9URSy3M";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);