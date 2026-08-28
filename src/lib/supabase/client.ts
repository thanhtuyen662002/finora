import { createBrowserClient } from "@supabase/ssr";
import { getClientEnv } from "@/config/env";
import type { Database } from "@/types/database";

/**
 * Creates a browser-side Supabase client using public publishable credentials.
 */
export function createClient() {
  const { supabaseUrl, supabasePublishableKey, isConfigured } = getClientEnv();

  if (!isConfigured) {
    throw new Error(
      "Supabase client credentials missing. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  return createBrowserClient<Database>(supabaseUrl, supabasePublishableKey);
}
