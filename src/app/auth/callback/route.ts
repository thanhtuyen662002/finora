import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSafeRedirectUrl } from '@/lib/auth/redirect';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Validate `next` redirect target to avoid open redirect vulnerabilities
  const safeNext = getSafeRedirectUrl(next, '/dashboard');

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription || error)}`
    );
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      // Check onboarding completion for normal logins, but preserve recovery targets
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .single();

      const targetPath =
        safeNext === '/reset-password'
          ? safeNext
          : profile && profile.onboarding_completed === false
          ? '/onboarding'
          : safeNext;

      // Always use validated request URL origin
      return NextResponse.redirect(`${origin}${targetPath}`);
    }

    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
    );
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent('Yêu cầu xác thực không hợp lệ hoặc mã truy cập đã hết hạn.')}`
  );
}
