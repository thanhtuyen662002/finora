import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getClientEnv } from "@/config/env";
import type { Database } from "@/types/database";
import { getSafeRedirectUrl } from "@/lib/auth/redirect";

/**
 * Updates user session, enforces route protection, and propagates authentication cookies
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

  // Authenticate user via verified Supabase server identity check
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
  if (!user && isProtectedRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('next', pathname);

    const redirectResponse = NextResponse.redirect(redirectUrl);
    // Copy any cookies and headers accumulated by Supabase client
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  // 2. If authenticated user tries to access auth pages -> redirect to /dashboard or next param
  if (user && isAuthRoute) {
    const nextParam = request.nextUrl.searchParams.get('next');
    const safeTargetPath = getSafeRedirectUrl(nextParam, '/dashboard');
    const redirectUrl = new URL(safeTargetPath, request.nextUrl.origin);

    const redirectResponse = NextResponse.redirect(redirectUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  return supabaseResponse;
}

