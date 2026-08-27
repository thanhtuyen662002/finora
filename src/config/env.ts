/**
 * Environment configuration for Finora.
 * Strictly separates browser-safe public variables from server-only secrets.
 */

export interface ClientEnv {
  supabaseUrl: string;
  supabasePublishableKey: string;
  isConfigured: boolean;
}

export interface ServerEnv extends ClientEnv {
  supabaseSecretKey?: string;
  fxApiKey?: string;
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

/**
 * Returns server-only environment variables.
 * MUST only be invoked in server contexts (Server Components, Route Handlers, Server Actions).
 */
export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error(
      "SECURITY VIOLATION: getServerEnv() must not be called from client-side code."
    );
  }

  const clientEnv = getClientEnv();
  const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const fxApiKey = process.env.FX_API_KEY;

  return {
    ...clientEnv,
    supabaseSecretKey,
    fxApiKey,
  };
}
