-- ==============================================================================
-- FINORA — PHASE 2 MIGRATION: AUTHENTICATION + RLS (PROFILES & USER_SETTINGS)
-- Target: Supabase PostgreSQL (qibfitbnlfgiqctntufr)
-- Invariant: User A cannot read/update User B's profile or settings.
-- ==============================================================================

-- 1. Create public.profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NULL,
    avatar_url TEXT NULL,
    onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'User public profile metadata managed under RLS.';

-- 2. Create public.user_settings table
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    base_currency TEXT NOT NULL DEFAULT 'VND' CHECK (char_length(base_currency) >= 3 AND char_length(base_currency) <= 5),
    locale TEXT NOT NULL DEFAULT 'vi-VN' CHECK (char_length(locale) >= 2 AND char_length(locale) <= 10),
    timezone TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.user_settings IS 'User personal financial preferences and localization settings.';

-- 3. Automatic updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER set_user_settings_updated_at
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 4. Auth new user trigger function
-- Initializes profile and settings automatically upon auth.users creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_display_name TEXT;
    v_avatar_url TEXT;
BEGIN
    -- Extract display name if present in OAuth/Signup metadata
    v_display_name := COALESCE(
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'display_name',
        split_part(NEW.email, '@', 1)
    );
    
    -- Extract avatar URL if present
    v_avatar_url := COALESCE(
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'picture'
    );

    -- Insert profile
    INSERT INTO public.profiles (
        id,
        display_name,
        avatar_url,
        onboarding_completed,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        v_display_name,
        v_avatar_url,
        FALSE,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    -- Insert default user_settings
    INSERT INTO public.user_settings (
        user_id,
        base_currency,
        locale,
        timezone,
        theme,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        'VND',
        'vi-VN',
        'Asia/Ho_Chi_Minh',
        'system',
        NOW(),
        NOW()
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- Register trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 5. Safe backfill for existing auth users
INSERT INTO public.profiles (id, display_name, avatar_url, onboarding_completed, created_at, updated_at)
SELECT
    u.id,
    COALESCE(
        u.raw_user_meta_data->>'full_name',
        u.raw_user_meta_data->>'name',
        u.raw_user_meta_data->>'display_name',
        split_part(u.email, '@', 1)
    ),
    COALESCE(
        u.raw_user_meta_data->>'avatar_url',
        u.raw_user_meta_data->>'picture'
    ),
    FALSE,
    u.created_at,
    u.created_at
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_settings (user_id, base_currency, locale, timezone, theme, created_at, updated_at)
SELECT
    u.id,
    'VND',
    'vi-VN',
    'Asia/Ho_Chi_Minh',
    'system',
    u.created_at,
    u.created_at
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- 7. Row Level Security Policies
-- Profiles: Users can only SELECT and UPDATE their own profile
DROP POLICY IF EXISTS "Users can select own profile" ON public.profiles;
CREATE POLICY "Users can select own profile"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = id)
    WITH CHECK ((SELECT auth.uid()) = id);

-- User Settings: Users can only SELECT and UPDATE their own settings
DROP POLICY IF EXISTS "Users can select own settings" ON public.user_settings;
CREATE POLICY "Users can select own settings"
    ON public.user_settings
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings"
    ON public.user_settings
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- 8. Table Grants and Privileges
REVOKE ALL ON TABLE public.profiles FROM anon, public;
REVOKE ALL ON TABLE public.user_settings FROM anon, public;

GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.user_settings TO authenticated;
