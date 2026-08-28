import { type EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSafeRedirectUrl } from '@/lib/auth/redirect';

/**
 * Route handler to verify token_hash sent in Supabase email links (signup confirmation,
 * recovery, magiclink, email_change) and establish an active session before redirecting.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next');

  // Determine fallback next URL based on otp type
  const fallbackNext = type === 'recovery' ? '/reset-password' : '/dashboard';
  const safeNext = getSafeRedirectUrl(next, fallbackNext);

  if (token_hash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      // Direct recovery or reset-password targets straight through
      if (type === 'recovery' || safeNext === '/reset-password') {
        return NextResponse.redirect(`${origin}${safeNext}`);
      }

      // Check onboarding for new signup confirmation
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_completed')
        .single();

      const targetPath =
        profile && profile.onboarding_completed === false
          ? '/onboarding'
          : safeNext;

      return NextResponse.redirect(`${origin}${targetPath}`);
    }

    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent('Yêu cầu xác thực không hợp lệ hoặc liên kết đã hết hạn.')}`
  );
}
