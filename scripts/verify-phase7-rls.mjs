import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const USER_A_EMAIL = process.env.FINORA_TEST_USER_A_EMAIL;
const USER_A_PASSWORD = process.env.FINORA_TEST_USER_A_PASSWORD;
const USER_B_EMAIL = process.env.FINORA_TEST_USER_B_EMAIL;
const USER_B_PASSWORD = process.env.FINORA_TEST_USER_B_PASSWORD;

if (
  !SUPABASE_URL ||
  !SUPABASE_KEY ||
  !USER_A_EMAIL ||
  !USER_A_PASSWORD ||
  !USER_B_EMAIL ||
  !USER_B_PASSWORD
) {
  console.log('NOTICE: live Supabase URL or two-user credentials not provided in environment.');
  console.log('Phase 7 source-gate verification can proceed with verify-phase7-source.mjs.');
  process.exit(0);
}

const clientA = createClient(SUPABASE_URL, SUPABASE_KEY);
const clientB = createClient(SUPABASE_URL, SUPABASE_KEY);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function pass(name) {
  console.log(`${name}=PASS`);
}

async function runLiveRLSTests() {
  console.log('Authenticating Test User A...');
  const { data: authA, error: errA } = await clientA.auth.signInWithPassword({
    email: USER_A_EMAIL,
    password: USER_A_PASSWORD,
  });
  assert(!errA && authA.user, `User A signin failed: ${errA?.message}`);

  console.log('Authenticating Test User B...');
  const { data: authB, error: errB } = await clientB.auth.signInWithPassword({
    email: USER_B_EMAIL,
    password: USER_B_PASSWORD,
  });
  assert(!errB && authB.user, `User B signin failed: ${errB?.message}`);

  console.log('Running cross-user RLS isolation tests for Phase 7 tables & views...');

  // User A creates a Goal
  const { data: goalA, error: goalErr } = await clientA
    .from('goals')
    .insert({
      name: 'RLS Test Goal User A',
      target_amount: '10000000.0000',
      current_amount: '1000000.0000',
      monthly_contribution: '500000.0000',
      currency_code: 'VND',
      category: 'An toàn tài chính',
    })
    .select()
    .single();
  assert(!goalErr && goalA, `User A goal insert failed: ${goalErr?.message}`);
  pass('USER_A_GOAL_INSERT');

  // User B tries to read User A's goal
  const { data: crossGoal, error: crossErr } = await clientB
    .from('goals')
    .select('*')
    .eq('id', goalA.id);
  assert(!crossErr, `Cross-read returned DB error: ${crossErr?.message}`);
  assert(Array.isArray(crossGoal) && crossGoal.length === 0, 'RLS VIOLATION: User B can read User A goal');
  pass('GOALS_RLS_READ_ISOLATION');

  // User B tries to read User A's goal from goal_details view
  const { data: crossViewGoal, error: crossViewErr } = await clientB
    .from('goal_details')
    .select('*')
    .eq('id', goalA.id);
  assert(!crossViewErr, `Cross-view returned DB error: ${crossViewErr?.message}`);
  assert(Array.isArray(crossViewGoal) && crossViewGoal.length === 0, 'RLS VIOLATION: User B can read User A goal from view');
  pass('GOAL_DETAILS_VIEW_RLS_ISOLATION');

  console.log('ALL PHASE 7 LIVE RLS TESTS PASSED.');
}

runLiveRLSTests().catch((err) => {
  console.error('LIVE RLS TEST FAILED:', err);
  process.exit(1);
});
