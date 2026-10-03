import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const FALLBACK_URL = 'https://eivguriqgzxlidwjfjqg.supabase.co';
const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpdmd1cmlxZ3p4bGlkd2pmanFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNDY1NTgsImV4cCI6MjEwNjYyMjU1OH0.qv5y-41EPEnTAzOwjgYafZ7eQIQz6QT_5pwNUPNBi1Q';

function cleanUrl(raw?: string): string {
  if (!raw) return FALLBACK_URL;
  const trimmed = raw.trim();
  // Limpia posibles enlaces markdown como [https://...](https://...) o comillas accidentales
  const match = trimmed.match(/https?:\/\/[^\s\]\)\"\'\,]+/);
  if (match && match[0].startsWith('http')) {
    return match[0];
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return FALLBACK_URL;
}

function cleanKey(raw?: string): string {
  if (!raw) return FALLBACK_ANON_KEY;
  const trimmed = raw.trim().replace(/['"]/g, '');
  return trimmed.length > 20 ? trimmed : FALLBACK_ANON_KEY;
}

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Fallback robusto con protocolo garantizado para build time (Vercel)
export const supabaseUrl = cleanUrl(rawUrl);
export const supabaseAnonKey = cleanKey(rawKey);

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);
export const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || '573183517802';
