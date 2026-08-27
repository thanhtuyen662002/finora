/**
 * Environment configuration for Finora.
 * Phase 0: strictly provides validated access to public Supabase client credentials.
 */

export interface ClientEnv {
  supabaseUrl: string;
  supabasePublishableKey: string;
  isConfigured: boolean;
}

/**
 * Returns public browser-safe environment configuration.
 * Safe to execute on both client and server.
 */
export function getClientEnv(): ClientEnv {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "";

  return {
    supabaseUrl,
    supabasePublishableKey,
    isConfigured: Boolean(supabaseUrl && supabasePublishableKey),
  };
}
