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
  console.log('\n⚠️  DIAGNOSTIC: Two-user test credentials not supplied in environment.');
  console.log('To execute dynamic two-user cross-tenant isolation testing, provide:');
  console.log('  - FINORA_TEST_USER_A_EMAIL');
  console.log('  - FINORA_TEST_USER_A_PASSWORD');
  console.log('  - FINORA_TEST_USER_B_EMAIL');
  console.log('  - FINORA_TEST_USER_B_PASSWORD');
  console.log('\nStatic schema & Anonymous RLS assertions can be run via:');
  console.log('  node scripts/verify-phase2-auth.mjs');
  process.exit(0);
}

async function verifyTwoUserRLS() {
  const clientA = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const clientB = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(`\n1. Authenticating User A (${USER_A_EMAIL})...`);
  const { data: authA, error: errA } = await clientA.auth.signInWithPassword({
    email: USER_A_EMAIL,
    password: USER_A_PASSWORD,
  });
  if (errA || !authA?.user) {
    console.error('❌ Could not authenticate User A:', errA?.message);
    process.exit(1);
  }
  const userAId = authA.user.id;
  console.log('  ✔ User A authenticated. UUID:', userAId);

  console.log(`\n2. Authenticating User B (${USER_B_EMAIL})...`);
  const { data: authB, error: errB } = await clientB.auth.signInWithPassword({
    email: USER_B_EMAIL,
    password: USER_B_PASSWORD,
  });
  if (errB || !authB?.user) {
    console.error('❌ Could not authenticate User B:', errB?.message);
    process.exit(1);
  }
  const userBId = authB.user.id;
  console.log('  ✔ User B authenticated. UUID:', userBId);

  if (userAId === userBId) {
    console.error('❌ Error: User A and User B must be distinct test users.');
    process.exit(1);
  }

  let failed = false;

  // Test 1: User A reads own profile
  console.log('\n[Check 1/8] User A reads own profile...');
  const { data: profileA, error: profAErr } = await clientA
    .from('profiles')
    .select('*')
    .eq('id', userAId)
    .maybeSingle();

  if (profAErr || !profileA || profileA.id !== userAId) {
    console.error('❌ User A failed to read own profile:', profAErr?.message || 'Profile missing');
    failed = true;
  } else {
    console.log('  ✔ User A successfully read own profile.');
  }

  // Test 2: User A reads own settings
  console.log('\n[Check 2/8] User A reads own settings...');
  const { data: settingsA, error: setAErr } = await clientA
    .from('user_settings')
    .select('*')
    .eq('user_id', userAId)
    .maybeSingle();

  if (setAErr || !settingsA || settingsA.user_id !== userAId) {
    console.error('❌ User A failed to read own settings:', setAErr?.message || 'Settings missing');
    failed = true;
  } else {
    console.log('  ✔ User A successfully read own settings.');
  }

  // Test 3: User A attempts to read User B's profile (Cross-user read)
  console.log("\n[Check 3/8] User A attempts to read User B's profile (RLS Invariant 1)...");
  const { data: crossProfA, error: crossProfAErr } = await clientA
    .from('profiles')
    .select('*')
    .eq('id', userBId);

  if (crossProfA && crossProfA.length > 0) {
    console.error(`❌ Invariant 1 Violation: User A was able to read User B's profile! Data:`, crossProfA);
    failed = true;
  } else {
    console.log("  ✔ User A received 0 rows when attempting to read User B's profile.");
  }

  // Test 4: User A attempts to read User B's settings (Cross-user read)
  console.log("\n[Check 4/8] User A attempts to read User B's settings (RLS Invariant 1)...");
  const { data: crossSetA, error: crossSetAErr } = await clientA
    .from('user_settings')
    .select('*')
    .eq('user_id', userBId);

  if (crossSetA && crossSetA.length > 0) {
    console.error(`❌ Invariant 1 Violation: User A was able to read User B's settings! Data:`, crossSetA);
    failed = true;
  } else {
    console.log("  ✔ User A received 0 rows when attempting to read User B's settings.");
  }

  // Test 5: User A attempts to update User B's profile (Cross-user write)
  console.log("\n[Check 5/8] User A attempts to update User B's profile (RLS Invariant 1)...");
  const { data: crossUpdateProf, error: crossUpdProfErr } = await clientA
    .from('profiles')
    .update({ display_name: 'Attacked_By_A' })
    .eq('id', userBId)
    .select();

  if (crossUpdateProf && crossUpdateProf.length > 0) {
    console.error(`❌ Invariant 1 Violation: User A was able to update User B's profile!`);
    failed = true;
  } else {
    console.log("  ✔ User A cannot update User B's profile (0 rows modified / rejected).");
  }

  // Test 6: User A attempts to update User B's settings (Cross-user write)
  console.log("\n[Check 6/8] User A attempts to update User B's settings (RLS Invariant 1)...");
  const { data: crossUpdateSet, error: crossUpdSetErr } = await clientA
    .from('user_settings')
    .update({ base_currency: 'EUR' })
    .eq('user_id', userBId)
    .select();

  if (crossUpdateSet && crossUpdateSet.length > 0) {
    console.error(`❌ Invariant 1 Violation: User A was able to update User B's settings!`);
    failed = true;
  } else {
    console.log("  ✔ User A cannot update User B's settings (0 rows modified / rejected).");
  }

  // Test 7: User B reads own profile and settings
  console.log('\n[Check 7/8] User B reads own data...');
  const { data: profileB } = await clientB.from('profiles').select('*').eq('id', userBId).maybeSingle();
  const { data: settingsB } = await clientB.from('user_settings').select('*').eq('user_id', userBId).maybeSingle();

  if (!profileB || !settingsB) {
    console.error('❌ User B failed to read own data.');
    failed = true;
  } else {
    console.log('  ✔ User B successfully read own profile and settings.');
  }

  // Test 8: User B attempts to read User A's data
  console.log("\n[Check 8/8] User B attempts to read User A's data (RLS Invariant 1)...");
  const { data: crossProfB } = await clientB.from('profiles').select('*').eq('id', userAId);
  const { data: crossSetB } = await clientB.from('user_settings').select('*').eq('user_id', userAId);

  if ((crossProfB && crossProfB.length > 0) || (crossSetB && crossSetB.length > 0)) {
    console.error(`❌ Invariant 1 Violation: User B was able to read User A's data!`);
    failed = true;
  } else {
    console.log("  ✔ User B received 0 rows when attempting to query User A's records.");
  }

  // Clean up
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
