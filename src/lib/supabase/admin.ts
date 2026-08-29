import "server-only";
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Server-only Supabase admin client with service_role key.
 * 
 * CRITICAL SECURITY RULES:
 * - Must never be imported into a Client Component.
 * - Must never use NEXT_PUBLIC_ for the service role key.
 * - Never expose or return the admin client to the browser.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  }

  // The application continues to function in native-currency mode if this is missing.
  // It only fails-closed for trusted snapshot persistence or admin tasks.
  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for this operation');
  }

  return createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
