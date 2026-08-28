import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getClientEnv } from "@/config/env";
import type { Database } from "@/types/database";
import { getSafeRedirectUrl } from "@/lib/auth/redirect";

/**
 * Helper to copy Supabase session cookies and response headers to a redirect response
 * without overriding the Location header or interfering with redirect body headers.
 */
function createSafeRedirectResponse(
  redirectUrl: URL,
  supabaseResponse: NextResponse
): NextResponse {
  const redirectResponse = NextResponse.redirect(redirectUrl);

  // 1. Preserve all cookies accumulated/refreshed by the Supabase client
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
  });

  // 2. Preserve Supabase & cache headers while avoiding Location and Content-* collisions
  supabaseResponse.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey !== "location" && !lowerKey.startsWith("content-")) {
      redirectResponse.headers.set(key, value);
    }
  });

  return redirectResponse;
}

/**
 * Updates user session, enforces route protection, and propagates authentication cookies
 * and cache headers at the Next.js request boundary (Proxy).
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

  const supabase = createServerClient<Database>(
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

  // Trigger immediate session refresh and retrieve verified JWT claims at request boundary
  const { data: claimsData } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(claimsData?.claims?.sub);

  const pathname = request.nextUrl.pathname;

  // Protected application routes
  const protectedRoutes = [
    '/dashboard',
    '/accounts',
    '/transactions',
    '/budgets',
    '/goals',
    '/recurring',
    '/reports',
    '/settings',
    '/onboarding',
    '/admin',
  ];

  const isProtectedRoute = protectedRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // Auth pages (login, signup, forgot-password)
  const authRoutes = ['/login', '/signup', '/forgot-password'];
  const isAuthRoute = authRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );

  // 1. If unauthenticated user tries to access protected route -> redirect to /login
  if (!isAuthenticated && isProtectedRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('next', pathname);

    return createSafeRedirectResponse(redirectUrl, supabaseResponse);
  }

  // 2. If authenticated user tries to access auth pages -> redirect to /dashboard or next param
  if (isAuthenticated && isAuthRoute) {
    const nextParam = request.nextUrl.searchParams.get('next');
    const safeTargetPath = getSafeRedirectUrl(nextParam, '/dashboard');
    const redirectUrl = new URL(safeTargetPath, request.nextUrl.origin);

    return createSafeRedirectResponse(redirectUrl, supabaseResponse);
  }

  return supabaseResponse;
}

