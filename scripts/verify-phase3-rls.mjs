import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const USER_A_EMAIL = process.env.FINORA_TEST_USER_A_EMAIL;
const USER_A_PASSWORD = process.env.FINORA_TEST_USER_A_PASSWORD;

const USER_B_EMAIL = process.env.FINORA_TEST_USER_B_EMAIL;
const USER_B_PASSWORD = process.env.FINORA_TEST_USER_B_PASSWORD;

console.log('=== FINORA PHASE 3 — TWO-USER RLS VERIFICATION ===');

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error('❌ FAIL: Missing required environment variables.');
  process.exit(1);
}

if (!USER_A_EMAIL || !USER_A_PASSWORD || !USER_B_EMAIL || !USER_B_PASSWORD) {
  console.error('❌ BLOCKED: Missing test user credentials.');
  process.exit(1);
}

function isMissingTableError(err) {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const code = err.code || '';
  return code === '42P01' || code === 'PGRST200' || code === 'PGRST205' || msg.includes('does not exist');
}

async function run() {
  const clientA = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const clientB = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  console.log('Authenticating users...');
  const { data: authA, error: errAuthA } = await clientA.auth.signInWithPassword({ email: USER_A_EMAIL, password: USER_A_PASSWORD });
  const { data: authB, error: errAuthB } = await clientB.auth.signInWithPassword({ email: USER_B_EMAIL, password: USER_B_PASSWORD });

  if (errAuthA || errAuthB) {
    console.error('❌ FAIL: Auth failed', errAuthA, errAuthB);
    process.exit(1);
  }

  const userIdA = authA.user.id;
  const userIdB = authB.user.id;
  console.log(`User A: ${userIdA}`);
  console.log(`User B: ${userIdB}\n`);

  let hasError = false;
  let testAccountA = null;
  let testCategoryA = null;

  // ACCOUNTS tests
  console.log('[1/4] Testing Accounts RLS for User A...');
  
  // A insert own account
  const { data: newAccA, error: errNewAccA } = await clientA.from('accounts').insert({
    user_id: userIdA,
    name: 'Test Account A',
    type: 'CASH',
    currency_code: 'VND',
    opening_balance: 1000000,
    color: '#111111'
  }).select('*').single();

  if (errNewAccA) {
    if (isMissingTableError(errNewAccA)) {
      console.error('❌ BLOCKED: Remote database not migrated yet. Please apply migration to Supabase.');
      process.exit(2);
    }
    console.error('❌ FAIL: User A could not insert own account.', errNewAccA);
    hasError = true;
  } else {
    console.log('✔ User A successfully inserted own account.');
    testAccountA = newAccA.id;
  }

  // A update own account
  if (testAccountA) {
    const { error: errUpdateAccA } = await clientA.from('accounts').update({ name: 'Test Account A Updated' }).eq('id', testAccountA);
    if (errUpdateAccA) {
      console.error('❌ FAIL: User A could not update own account.', errUpdateAccA);
      hasError = true;
    } else {
      console.log('✔ User A successfully updated own account.');
    }
  }

  // A insert for B
  const { error: errAInsertB } = await clientA.from('accounts').insert({
    user_id: userIdB,
    name: 'A inserting for B',
    type: 'CASH',
    currency_code: 'VND'
  });
  if (!errAInsertB) {
    console.error('❌ FAIL: User A successfully inserted an account for User B! RLS violation.');
    hasError = true;
  } else {
    console.log('✔ User A correctly blocked from inserting an account for User B.');
  }

  // CATEGORIES tests
  console.log('\n[2/4] Testing Categories RLS for User A...');
  const { data: catsA, error: errCatsA } = await clientA.from('categories').select('*').eq('user_id', userIdA);
  if (errCatsA) {
    console.error('❌ FAIL: User A could not read own categories.', errCatsA);
    hasError = true;
  } else {
    console.log(`✔ User A successfully read own categories (count: ${catsA.length}).`);
  }

  const { data: newCatA, error: errNewCatA } = await clientA.from('categories').insert({
    user_id: userIdA,
    name: 'Test Category A',
    type: 'EXPENSE',
    icon: 'Test',
    color: '#222222'
  }).select('*').single();

  if (errNewCatA) {
    console.error('❌ FAIL: User A could not insert own category.', errNewCatA);
    hasError = true;
  } else {
    console.log('✔ User A successfully inserted own category.');
    testCategoryA = newCatA.id;
  }

  const { error: errAInsertCatB } = await clientA.from('categories').insert({
    user_id: userIdB,
    name: 'A inserting for B',
    type: 'EXPENSE',
    icon: 'Test',
    color: '#333333'
  });
  if (!errAInsertCatB) {
    console.error('❌ FAIL: User A successfully inserted a category for User B! RLS violation.');
    hasError = true;
  } else {
    console.log('✔ User A correctly blocked from inserting a category for User B.');
  }

  // CROSS USER TESTS
  console.log('\n[3/4] Testing Cross-User RLS (B attempting to access A data)...');
  
  if (testAccountA) {
    // B select A's account
    const { data: bReadA, error: bReadAErr } = await clientB.from('accounts').select('*').eq('id', testAccountA);
    if (!bReadAErr && bReadA.length > 0) {
      console.error('❌ FAIL: User B successfully read User A account! RLS violation.');
      hasError = true;
    } else {
      console.log('✔ User B correctly blocked from reading User A account.');
    }

    // B update A's account
    const { error: bUpdateAErr } = await clientB.from('accounts').update({ name: 'Hacked by B' }).eq('id', testAccountA);
    if (!bUpdateAErr) {
      console.error('❌ FAIL: User B successfully updated User A account! RLS violation.');
      hasError = true;
    } else {
      console.log('✔ User B correctly blocked from updating User A account.');
    }
  }

  if (testCategoryA) {
    const { data: bReadCatA, error: bReadCatAErr } = await clientB.from('categories').select('*').eq('id', testCategoryA);
    if (!bReadCatAErr && bReadCatA.length > 0) {
      console.error('❌ FAIL: User B successfully read User A category! RLS violation.');
      hasError = true;
    } else {
      console.log('✔ User B correctly blocked from reading User A category.');
    }
  }

  console.log('\n[4/4] Cleanup (Archive test records)...');
  if (testAccountA) {
    await clientA.from('accounts').update({ is_archived: true, name: 'Test Account A Updated (Archived)' }).eq('id', testAccountA);
    console.log('✔ Archived test account A.');
  }
  if (testCategoryA) {
    await clientA.from('categories').update({ is_archived: true, name: 'Test Category A (Archived)' }).eq('id', testCategoryA);
    console.log('✔ Archived test category A.');
  }

  if (hasError) {
    console.error('\n❌ FAIL: One or more two-user RLS isolation tests failed.');
    process.exit(1);
  } else {
    console.log('\n✅ PASS: Two-user runtime RLS isolation passed for accounts and categories.');
  }
}

run();
