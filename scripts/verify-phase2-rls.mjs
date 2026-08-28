import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const USER_A_EMAIL = process.env.FINORA_TEST_USER_A_EMAIL;
const USER_A_PASSWORD = process.env.FINORA_TEST_USER_A_PASSWORD;
const USER_B_EMAIL = process.env.FINORA_TEST_USER_B_EMAIL;
const USER_B_PASSWORD = process.env.FINORA_TEST_USER_B_PASSWORD;

console.log('=== FINORA PHASE 2 — TWO-USER RLS VERIFICATION ===');

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error('❌ FAIL: Missing required environment variables (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY).');
  process.exit(1);
}

if (!USER_A_EMAIL || !USER_A_PASSWORD || !USER_B_EMAIL || !USER_B_PASSWORD) {
  console.error('\n❌ BLOCKED: Two-user test credentials not supplied in environment.');
  console.error('To execute dynamic two-user cross-tenant isolation testing, provide:');
  console.error('  - FINORA_TEST_USER_A_EMAIL');
  console.error('  - FINORA_TEST_USER_A_PASSWORD');
  console.error('  - FINORA_TEST_USER_B_EMAIL');
  console.error('  - FINORA_TEST_USER_B_PASSWORD');
  console.error('\nNon-zero exit code returned because mandatory two-user verification credentials are missing.');
  process.exit(1);
}

function isMissingTableError(err) {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const code = err.code || '';
  return (
    code === '42P01' ||
    code === 'PGRST200' ||
    code === 'PGRST205' ||
    msg.includes('schema cache') ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table')
  );
}

async function verifyTwoUserRLS() {
  const clientA = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const clientB = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`\n[Auth] Authenticating User A (${USER_A_EMAIL})...`);
  const { data: authA, error: errA } = await clientA.auth.signInWithPassword({
    email: USER_A_EMAIL,
    password: USER_A_PASSWORD,
  });
  if (errA || !authA?.user) {
    console.error('❌ Could not authenticate User A:', errA?.message || 'Unknown error');
    process.exit(1);
  }
  const userAId = authA.user.id;
  console.log('  ✔ User A authenticated. UUID:', userAId);

  console.log(`\n[Auth] Authenticating User B (${USER_B_EMAIL})...`);
  const { data: authB, error: errB } = await clientB.auth.signInWithPassword({
    email: USER_B_EMAIL,
    password: USER_B_PASSWORD,
  });
  if (errB || !authB?.user) {
    console.error('❌ Could not authenticate User B:', errB?.message || 'Unknown error');
    process.exit(1);
  }
  const userBId = authB.user.id;
  console.log('  ✔ User B authenticated. UUID:', userBId);

  if (userAId === userBId) {
    console.error('❌ Error: User A and User B must be distinct test users.');
    process.exit(1);
  }

  let failed = false;

  // 1. User A reads own profile
  console.log('\n[Check 1/12] User A reads own profile...');
  const { data: profileA, error: profAErr } = await clientA
    .from('profiles')
    .select('*')
    .eq('id', userAId)
    .maybeSingle();

  if (profAErr) {
    console.error('❌ User A failed to read own profile:', profAErr.message);
    failed = true;
  } else if (!profileA || profileA.id !== userAId) {
    console.error('❌ User A profile not found or ID mismatch.');
    failed = true;
  } else {
    console.log('  ✔ User A successfully read own profile.');
  }

  // 2. User A reads own settings
  console.log('\n[Check 2/12] User A reads own settings...');
  const { data: settingsA, error: setAErr } = await clientA
    .from('user_settings')
    .select('*')
    .eq('user_id', userAId)
    .maybeSingle();

  if (setAErr) {
    console.error('❌ User A failed to read own settings:', setAErr.message);
    failed = true;
  } else if (!settingsA || settingsA.user_id !== userAId) {
    console.error('❌ User A settings not found or user_id mismatch.');
    failed = true;
  } else {
    console.log('  ✔ User A successfully read own settings.');
  }

  // 3. User A updates own profile & restores
  console.log('\n[Check 3/12] User A updates and restores own profile...');
  const origDisplayNameA = profileA?.display_name || '';
  const testDisplayNameA = `Test_A_${Date.now()}`;
  const { data: updProfA, error: updProfAErr } = await clientA
    .from('profiles')
    .update({ display_name: testDisplayNameA })
    .eq('id', userAId)
    .select()
    .single();

  if (updProfAErr || updProfA?.display_name !== testDisplayNameA) {
    console.error('❌ User A failed to update own profile:', updProfAErr?.message || 'Value not updated');
    failed = true;
  } else {
    // Restore
    await clientA
      .from('profiles')
      .update({ display_name: origDisplayNameA })
      .eq('id', userAId);
    console.log('  ✔ User A successfully updated and restored own profile.');
  }

  // 4. User A attempts cross-read on User B's profile
  console.log("\n[Check 4/12] User A attempts to read User B's profile (RLS Invariant 1)...");
  const { data: crossProfA, error: crossProfAErr } = await clientA
    .from('profiles')
    .select('*')
    .eq('id', userBId);

  if (crossProfAErr && isMissingTableError(crossProfAErr)) {
    console.error('❌ Table error on query:', crossProfAErr.message);
    failed = true;
  } else if (crossProfA && crossProfA.length > 0) {
    console.error(`❌ Invariant 1 Violation: User A was able to read User B's profile! Data:`, crossProfA);
    failed = true;
  } else {
    console.log("  ✔ User A received 0 rows when querying User B's profile.");
  }

  // 5. User A attempts cross-read on User B's settings
  console.log("\n[Check 5/12] User A attempts to read User B's settings (RLS Invariant 1)...");
  const { data: crossSetA, error: crossSetAErr } = await clientA
    .from('user_settings')
    .select('*')
    .eq('user_id', userBId);

  if (crossSetAErr && isMissingTableError(crossSetAErr)) {
    console.error('❌ Table error on query:', crossSetAErr.message);
    failed = true;
  } else if (crossSetA && crossSetA.length > 0) {
    console.error(`❌ Invariant 1 Violation: User A was able to read User B's settings! Data:`, crossSetA);
    failed = true;
  } else {
    console.log("  ✔ User A received 0 rows when querying User B's settings.");
  }

  // 6. User A attempts cross-write on User B's profile
  console.log("\n[Check 6/12] User A attempts to update User B's profile (RLS Invariant 1)...");
  const { data: crossUpdProfA, error: crossUpdProfAErr } = await clientA
    .from('profiles')
    .update({ display_name: 'Attacked_By_A' })
    .eq('id', userBId)
    .select();

  if (crossUpdProfA && crossUpdProfA.length > 0) {
    console.error(`❌ Invariant 1 Violation: User A was able to update User B's profile!`);
    failed = true;
  } else {
    console.log("  ✔ User A cannot update User B's profile (0 rows modified / rejected).");
  }

  // 7. User A attempts cross-write on User B's settings
  console.log("\n[Check 7/12] User A attempts to update User B's settings (RLS Invariant 1)...");
  const { data: crossUpdSetA, error: crossUpdSetAErr } = await clientA
    .from('user_settings')
    .update({ base_currency: 'EUR' })
    .eq('user_id', userBId)
    .select();

  if (crossUpdSetA && crossUpdSetA.length > 0) {
    console.error(`❌ Invariant 1 Violation: User A was able to update User B's settings!`);
    failed = true;
  } else {
    console.log("  ✔ User A cannot update User B's settings (0 rows modified / rejected).");
  }

  // 8. User B reads own profile and settings
  console.log('\n[Check 8/12] User B reads own profile & settings...');
  const { data: profileB, error: profBErr } = await clientB
    .from('profiles')
    .select('*')
    .eq('id', userBId)
    .maybeSingle();
  const { data: settingsB, error: setBErr } = await clientB
    .from('user_settings')
    .select('*')
    .eq('user_id', userBId)
    .maybeSingle();

  if (profBErr || !profileB || profileB.id !== userBId) {
    console.error('❌ User B failed to read own profile:', profBErr?.message || 'Profile missing');
    failed = true;
  } else if (setBErr || !settingsB || settingsB.user_id !== userBId) {
    console.error('❌ User B failed to read own settings:', setBErr?.message || 'Settings missing');
    failed = true;
  } else {
    console.log('  ✔ User B successfully read own profile and settings.');
  }

  // 9. User B updates own settings & restores
  console.log('\n[Check 9/12] User B updates and restores own settings...');
  const origThemeB = settingsB?.theme || 'system';
  const testThemeB = origThemeB === 'dark' ? 'light' : 'dark';
  const { data: updSetB, error: updSetBErr } = await clientB
    .from('user_settings')
    .update({ theme: testThemeB })
    .eq('user_id', userBId)
    .select()
    .single();

  if (updSetBErr || updSetB?.theme !== testThemeB) {
    console.error('❌ User B failed to update own settings:', updSetBErr?.message || 'Value not updated');
    failed = true;
  } else {
    // Restore
    await clientB
      .from('user_settings')
      .update({ theme: origThemeB })
      .eq('user_id', userBId);
    console.log('  ✔ User B successfully updated and restored own settings.');
  }

  // 10. User B attempts cross-read on User A's profile
  console.log("\n[Check 10/12] User B attempts to read User A's profile (RLS Invariant 1)...");
  const { data: crossProfB, error: crossProfBErr } = await clientB
    .from('profiles')
    .select('*')
    .eq('id', userAId);

  if (crossProfBErr && isMissingTableError(crossProfBErr)) {
    console.error('❌ Table error on query:', crossProfBErr.message);
    failed = true;
  } else if (crossProfB && crossProfB.length > 0) {
    console.error(`❌ Invariant 1 Violation: User B was able to read User A's profile! Data:`, crossProfB);
    failed = true;
  } else {
    console.log("  ✔ User B received 0 rows when querying User A's profile.");
  }

  // 11. User B attempts cross-read on User A's settings
  console.log("\n[Check 11/12] User B attempts to read User A's settings (RLS Invariant 1)...");
  const { data: crossSetB, error: crossSetBErr } = await clientB
    .from('user_settings')
    .select('*')
    .eq('user_id', userAId);

  if (crossSetBErr && isMissingTableError(crossSetBErr)) {
    console.error('❌ Table error on query:', crossSetBErr.message);
    failed = true;
  } else if (crossSetB && crossSetB.length > 0) {
    console.error(`❌ Invariant 1 Violation: User B was able to read User A's settings! Data:`, crossSetB);
    failed = true;
  } else {
    console.log("  ✔ User B received 0 rows when querying User A's settings.");
  }

  // 12. User B attempts cross-write on User A's profile & settings
  console.log("\n[Check 12/12] User B attempts to update User A's profile & settings (RLS Invariant 1)...");
  const { data: crossUpdProfB } = await clientB
    .from('profiles')
    .update({ display_name: 'Attacked_By_B' })
    .eq('id', userAId)
    .select();
  const { data: crossUpdSetB } = await clientB
    .from('user_settings')
    .update({ base_currency: 'JPY' })
    .eq('user_id', userAId)
    .select();

  if ((crossUpdProfB && crossUpdProfB.length > 0) || (crossUpdSetB && crossUpdSetB.length > 0)) {
    console.error(`❌ Invariant 1 Violation: User B was able to update User A's records!`);
    failed = true;
  } else {
    console.log("  ✔ User B cannot update User A's profile or settings (0 rows modified / rejected).");
  }

  // Sign out
  await clientA.auth.signOut();
  await clientB.auth.signOut();

  if (failed) {
    console.error('\n❌ TWO-USER RLS VERIFICATION FAILED.');
    process.exit(1);
  }

  console.log('\n✅ PASS: Two-User RLS Isolation assertions succeeded completely.');
  process.exit(0);
}

verifyTwoUserRLS().catch((err) => {
  console.error('❌ Unexpected execution error:', err);
  process.exit(1);
});
