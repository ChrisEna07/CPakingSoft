import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const FALLBACK_URL = 'https://eivguriqgzxlidwjfjqg.supabase.co';
const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpdmd1cmlxZ3p4bGlkd2pmanFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNDY1NTgsImV4cCI6MjEwNjYyMjU1OH0.qv5y-41EPEnTAzOwjgYafZ7eQIQz6QT_5pwNUPNBi1Q';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY;

export const supabase: SupabaseClient = createClient(url, key);
export const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '573183517802';
