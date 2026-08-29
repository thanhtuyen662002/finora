import { createClient } from '@/lib/supabase/client';
import type { Profile, ProfileUpdate, UserSettings, UserSettingsUpdate } from '@/types/database';

/**
 * Sign in with email and password
 */
export async function signInWithEmail(email: string, password: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return { data, error };
}

/**
 * Sign up with email and password, optionally passing display name metadata
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  displayName?: string
) {
  const supabase = createClient();
  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : undefined;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: displayName || '',
      },
      emailRedirectTo: redirectTo,
    },
  });

  return { data, error };
}

/**
 * Initiate Google OAuth sign in with PKCE flow
 */
export async function signInWithGoogle() {
  const supabase = createClient();
  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback`
      : undefined;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  return { data, error };
}

/**
 * Request a password reset link to be sent to user's email
 */
export async function requestPasswordReset(email: string) {
  const supabase = createClient();
  const redirectTo =
    typeof window !== 'undefined'
      ? `${window.location.origin}/auth/callback?next=/reset-password`
      : undefined;

  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  return { data, error };
}

/**
 * Update user password after recovery flow
 */
export async function updatePassword(newPassword: string) {
  const supabase = createClient();
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  return { data, error };
}

/**
 * Sign out current user and clear local session cookies
 */
export async function signOut() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Get current authenticated user
 */
export async function getCurrentUser() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return { user, error };
}

/**
 * Get current user profile from public.profiles
 */
export async function getCurrentProfile(): Promise<{
  data: Profile | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: new Error('User not authenticated') };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return { data: data as Profile | null, error: error as Error | null };
}

/**
 * Update current user profile
 */
export async function updateCurrentProfile(
  updates: ProfileUpdate
): Promise<{ data: Profile | null; error: Error | null }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: new Error('User not authenticated') };
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select()
    .single();

  return { data: data as Profile | null, error: error as Error | null };
}

/**
 * Get current user settings from public.user_settings
 */
export async function getCurrentUserSettings(): Promise<{
  data: UserSettings | null;
  error: Error | null;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: new Error('User not authenticated') };
  }

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return { data: data as UserSettings | null, error: error as Error | null };
}

/**
 * Update current user settings
 */
export async function updateCurrentUserSettings(
  updates: UserSettingsUpdate
): Promise<{ data: UserSettings | null; error: Error | null }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: new Error('User not authenticated') };
  }

  const { data, error } = await supabase
    .from('user_settings')
    .update(updates)
    .eq('user_id', user.id)
    .select()
    .single();

  return { data: data as UserSettings | null, error: error as Error | null };
}

/**
 * Get current user context (auth + profile + settings) in parallel
 */
export async function getCurrentUserContext() {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (!user || userError) {
    return { user: null, profile: null, settings: null, error: userError };
  }

  const [profileResult, settingsResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('user_settings').select('*').eq('user_id', user.id).single()
  ]);

  return {
    user,
    profile: profileResult.data as Profile | null,
    settings: settingsResult.data as UserSettings | null,
    error: null
  };
}

export { getSafeRedirectUrl } from './redirect';
