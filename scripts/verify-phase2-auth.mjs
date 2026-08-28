import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error('❌ FAIL: Missing required environment variables.');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY) are set.');
  process.exit(1);
}

console.log('=== FINORA PHASE 2 — ANONYMOUS AUTH & RLS VERIFICATION ===');
console.log('Target URL:', SUPABASE_URL);

async function run() {
  const anonClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  let hasError = false;

  // 1. Verify Anonymous SELECT on public.profiles
  console.log('\n[1/4] Testing Anonymous SELECT on profiles...');
  const { data: profiles, error: profilesErr } = await anonClient
    .from('profiles')
    .select('*');

  if (profilesErr) {
    // Check if table missing
    if (profilesErr.code === '42P01' || profilesErr.message?.includes('does not exist')) {
      console.error('❌ Assertion failed: table "public.profiles" does not exist in target database.');
      hasError = true;
    } else {
      console.log('  ✔ Anonymous SELECT profiles rejected by database/RLS:', profilesErr.message);
    }
  } else if (Array.isArray(profiles)) {
    if (profiles.length > 0) {
      console.error(`❌ Invariant 1 Violation: Anonymous query returned ${profiles.length} profile rows! Data exposure.`);
      hasError = true;
    } else {
      console.log('  ✔ Anonymous SELECT profiles returned 0 rows (RLS isolation active).');
    }
  }

  // 2. Verify Anonymous SELECT on public.user_settings
  console.log('\n[2/4] Testing Anonymous SELECT on user_settings...');
  const { data: settings, error: settingsErr } = await anonClient
    .from('user_settings')
    .select('*');

  if (settingsErr) {
    if (settingsErr.code === '42P01' || settingsErr.message?.includes('does not exist')) {
      console.error('❌ Assertion failed: table "public.user_settings" does not exist in target database.');
      hasError = true;
    } else {
      console.log('  ✔ Anonymous SELECT user_settings rejected by database/RLS:', settingsErr.message);
    }
  } else if (Array.isArray(settings)) {
    if (settings.length > 0) {
      console.error(`❌ Invariant 1 Violation: Anonymous query returned ${settings.length} settings rows! Data exposure.`);
      hasError = true;
    } else {
      console.log('  ✔ Anonymous SELECT user_settings returned 0 rows (RLS isolation active).');
    }
  }

  // 3. Verify Anonymous UPDATE on public.profiles
  console.log('\n[3/4] Testing Anonymous UPDATE on profiles...');
  const { data: updatedProfiles, error: updateProfilesErr } = await anonClient
    .from('profiles')
    .update({ display_name: 'Hacked_Anon' })
    .neq('id', '00000000-0000-0000-0000-000000000000')
    .select();

  if (updateProfilesErr) {
    console.log('  ✔ Anonymous UPDATE profiles rejected by database/RLS:', updateProfilesErr.message);
  } else if (updatedProfiles && updatedProfiles.length > 0) {
    console.error(`❌ Invariant 1 Violation: Anonymous UPDATE modified ${updatedProfiles.length} profile rows!`);
    hasError = true;
  } else {
    console.log('  ✔ Anonymous UPDATE profiles modified 0 rows.');
  }

  // 4. Verify Anonymous UPDATE on public.user_settings
  console.log('\n[4/4] Testing Anonymous UPDATE on user_settings...');
  const { data: updatedSettings, error: updateSettingsErr } = await anonClient
    .from('user_settings')
    .update({ base_currency: 'USD' })
    .neq('user_id', '00000000-0000-0000-0000-000000000000')
    .select();

  if (updateSettingsErr) {
    console.log('  ✔ Anonymous UPDATE user_settings rejected by database/RLS:', updateSettingsErr.message);
  } else if (updatedSettings && updatedSettings.length > 0) {
    console.error(`❌ Invariant 1 Violation: Anonymous UPDATE modified ${updatedSettings.length} settings rows!`);
    hasError = true;
  } else {
    console.log('  ✔ Anonymous UPDATE user_settings modified 0 rows.');
  }

  if (hasError) {
    console.error('\n❌ VERIFICATION FAILED: Anonymous isolation assertions did not pass.');
    process.exit(1);
  }

  console.log('\n✅ PASS: Phase 2 Anonymous RLS Isolation assertions succeeded.');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Unexpected execution error:', err);
  process.exit(1);
});
