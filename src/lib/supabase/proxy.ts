import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getClientEnv } from "@/config/env";

/**
 * Updates user session and propagates authentication cookies and cache headers
 * at the Next.js request boundary (Proxy).
 */
export async function updateSession(request: NextRequest) {
  const { supabaseUrl, supabasePublishableKey, isConfigured } = getClientEnv();

  if (!isConfigured) {
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    supabaseUrl,
    supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: Array<{
            name: string;
            value: string;
            options?: Parameters<typeof supabaseResponse.cookies.set>[2];
          }>,
          headers?: Record<string, string>
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
          if (headers) {
            for (const [key, value] of Object.entries(headers)) {
              if (value) {
                supabaseResponse.headers.set(key, value);
              }
            }
          }
        },
      },
    }
  );

  // Trigger lazy session init / token validation using getClaims() per current Supabase SSR guidance
  await supabase.auth.getClaims();

  return supabaseResponse;
}
