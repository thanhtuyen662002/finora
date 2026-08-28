import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const USER_A_EMAIL = process.env.FINORA_TEST_USER_A_EMAIL;
const USER_A_PASSWORD = process.env.FINORA_TEST_USER_A_PASSWORD;
const USER_B_EMAIL = process.env.FINORA_TEST_USER_B_EMAIL;
const USER_B_PASSWORD = process.env.FINORA_TEST_USER_B_PASSWORD;

console.log('=== FINORA PHASE 3 — TWO-USER RLS VERIFICATION ===');

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error('❌ FAIL: Missing public Supabase environment variables.');
  process.exit(1);
}
if (!USER_A_EMAIL || !USER_A_PASSWORD || !USER_B_EMAIL || !USER_B_PASSWORD) {
  console.error('❌ BLOCKED: Missing disposable two-user test credentials.');
  process.exit(1);
}

function isMissingTableError(error) {
  if (!error) return false;
  const message = String(error.message || '').toLowerCase();
  return ['42P01', 'PGRST200', 'PGRST205'].includes(error.code || '') || message.includes('does not exist');
}

function fail(message, detail) {
  console.error(`❌ FAIL: ${message}`, detail || '');
  return true;
}

async function run() {
  const clientA = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const clientB = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authA, error: authAError } = await clientA.auth.signInWithPassword({
    email: USER_A_EMAIL,
    password: USER_A_PASSWORD,
  });
  const { data: authB, error: authBError } = await clientB.auth.signInWithPassword({
    email: USER_B_EMAIL,
    password: USER_B_PASSWORD,
  });
  if (authAError || authBError || !authA.user || !authB.user) {
    console.error('❌ FAIL: Could not authenticate both test users.', authAError || authBError);
    process.exit(1);
  }

  const userIdA = authA.user.id;
  const userIdB = authB.user.id;
  const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  let hasError = false;

  console.log(`✔ User A authenticated: ${userIdA}`);
  console.log(`✔ User B authenticated: ${userIdB}`);

  const preflight = await clientA.from('accounts').select('id').limit(1);
  if (isMissingTableError(preflight.error)) {
    console.error('❌ BLOCKED: Phase 3 tables are not present on the remote database.');
    process.exit(2);
  }
  if (preflight.error) {
    console.error('❌ FAIL: Phase 3 preflight query failed.', preflight.error);
    process.exit(1);
  }

  console.log('\n[1/5] Deliberate database-error discrimination...');
  const deliberate = await clientA.from('accounts').insert({
    user_id: userIdA,
    name: `Verifier invalid ${runId}`,
    type: 'INVALID_TYPE',
    currency_code: 'VND',
  });
  if (!deliberate.error) {
    hasError = fail('Deliberate check-constraint violation unexpectedly succeeded.');
  } else if (deliberate.error.code !== '23514') {
    hasError = fail('Deliberate query error was not the expected check-constraint error.', deliberate.error);
  } else {
    console.log('✔ Normal database error is distinguishable from an RLS empty result.');
  }

  const accountNameA = `Verifier Account A ${runId}`;
  const accountNameB = `Verifier Account B ${runId}`;
  let accountA = null;
  let accountB = null;

  console.log('\n[2/5] Accounts — full bidirectional ownership matrix...');
  {
    const resultA = await clientA.from('accounts').insert({
      user_id: userIdA,
      name: accountNameA,
      type: 'CASH',
      currency_code: 'VND',
      opening_balance: '1000000.0000',
      color: '#111111',
    }).select('*').single();
    if (resultA.error || !resultA.data) hasError = fail('User A could not INSERT own account.', resultA.error);
    else { accountA = resultA.data; console.log('✔ A INSERT own account.'); }

    const resultB = await clientB.from('accounts').insert({
      user_id: userIdB,
      name: accountNameB,
      type: 'BANK',
      currency_code: 'USD',
      opening_balance: '500.0000',
      color: '#222222',
    }).select('*').single();
    if (resultB.error || !resultB.data) hasError = fail('User B could not INSERT own account.', resultB.error);
    else { accountB = resultB.data; console.log('✔ B INSERT own account.'); }

    if (accountA) {
      const ownReadA = await clientA.from('accounts').select('*').eq('id', accountA.id).single();
      if (ownReadA.error || ownReadA.data?.user_id !== userIdA) hasError = fail('A could not SELECT own account.', ownReadA.error);
      else console.log('✔ A SELECT own account.');

      const ownUpdateA = await clientA.from('accounts').update({ name: `${accountNameA} updated` }).eq('id', accountA.id).select('*').single();
      if (ownUpdateA.error || ownUpdateA.data?.name !== `${accountNameA} updated`) hasError = fail('A own account UPDATE did not persist.', ownUpdateA.error);
      else console.log('✔ A UPDATE own account persisted.');

      const ownerChangeA = await clientA.from('accounts').update({ user_id: userIdB }).eq('id', accountA.id).select('id,user_id');
      const ownerReadbackA = await clientA.from('accounts').select('user_id').eq('id', accountA.id).single();
      if ((!ownerChangeA.error && ownerChangeA.data.length > 0) || ownerReadbackA.error || ownerReadbackA.data?.user_id !== userIdA) {
        hasError = fail('A changed account ownership to B.', ownerChangeA.error || ownerReadbackA.error);
      } else console.log('✔ A cannot change account user_id.');
    }

    if (accountB) {
      const ownReadB = await clientB.from('accounts').select('*').eq('id', accountB.id).single();
      if (ownReadB.error || ownReadB.data?.user_id !== userIdB) hasError = fail('B could not SELECT own account.', ownReadB.error);
      else console.log('✔ B SELECT own account.');

      const ownUpdateB = await clientB.from('accounts').update({ name: `${accountNameB} updated` }).eq('id', accountB.id).select('*').single();
      if (ownUpdateB.error || ownUpdateB.data?.name !== `${accountNameB} updated`) hasError = fail('B own account UPDATE did not persist.', ownUpdateB.error);
      else console.log('✔ B UPDATE own account persisted.');

      const ownerChangeB = await clientB.from('accounts').update({ user_id: userIdA }).eq('id', accountB.id).select('id,user_id');
      const ownerReadbackB = await clientB.from('accounts').select('user_id').eq('id', accountB.id).single();
      if ((!ownerChangeB.error && ownerChangeB.data.length > 0) || ownerReadbackB.error || ownerReadbackB.data?.user_id !== userIdB) {
        hasError = fail('B changed account ownership to A.', ownerChangeB.error || ownerReadbackB.error);
      } else console.log('✔ B cannot change account user_id.');
    }

    const insertAForB = await clientA.from('accounts').insert({ user_id: userIdB, name: `A-for-B ${runId}`, type: 'CASH', currency_code: 'VND' });
    if (!insertAForB.error) hasError = fail('A INSERTed an account owned by B.'); else console.log('✔ A cannot INSERT for B.');
    const insertBForA = await clientB.from('accounts').insert({ user_id: userIdA, name: `B-for-A ${runId}`, type: 'CASH', currency_code: 'VND' });
    if (!insertBForA.error) hasError = fail('B INSERTed an account owned by A.'); else console.log('✔ B cannot INSERT for A.');

    if (accountA && accountB) {
      const aReadsB = await clientA.from('accounts').select('id').eq('id', accountB.id);
      if (aReadsB.error || aReadsB.data.length !== 0) hasError = fail('A foreign account SELECT was not an RLS-empty result.', aReadsB.error);
      else console.log('✔ A cannot SELECT B account.');
      const bReadsA = await clientB.from('accounts').select('id').eq('id', accountA.id);
      if (bReadsA.error || bReadsA.data.length !== 0) hasError = fail('B foreign account SELECT was not an RLS-empty result.', bReadsA.error);
      else console.log('✔ B cannot SELECT A account.');

      const aUpdatesB = await clientA.from('accounts').update({ name: `A hacked B ${runId}` }).eq('id', accountB.id).select('id');
      if (aUpdatesB.error || aUpdatesB.data.length !== 0) hasError = fail('A foreign account UPDATE was not blocked as zero rows.', aUpdatesB.error);
      else console.log('✔ A cannot UPDATE B account.');
      const bUpdatesA = await clientB.from('accounts').update({ name: `B hacked A ${runId}` }).eq('id', accountA.id).select('id');
      if (bUpdatesA.error || bUpdatesA.data.length !== 0) hasError = fail('B foreign account UPDATE was not blocked as zero rows.', bUpdatesA.error);
      else console.log('✔ B cannot UPDATE A account.');
    }
  }

  const baselinePairs = [
    ['INCOME', 'Lương'], ['INCOME', 'YouTube & AdSense'], ['INCOME', 'Freelance'], ['INCOME', 'Đầu tư'], ['INCOME', 'Khác'],
    ['EXPENSE', 'Ăn uống'], ['EXPENSE', 'Di chuyển'], ['EXPENSE', 'Mua sắm'], ['EXPENSE', 'Hóa đơn & Nhà cửa'],
    ['EXPENSE', 'Giải trí'], ['EXPENSE', 'Sức khỏe'], ['EXPENSE', 'Khác'],
  ];
  const categoryNameA = `Verifier Category A ${runId}`;
  const categoryNameB = `Verifier Category B ${runId}`;
  let categoryA = null;
  let categoryB = null;

  console.log('\n[3/5] Categories — baseline visibility + full bidirectional ownership matrix...');
  for (const [label, client, userId] of [['A', clientA, userIdA], ['B', clientB, userIdB]]) {
    const visible = await client.from('categories').select('user_id,type,name');
    if (visible.error) {
      hasError = fail(`${label} could not SELECT own categories.`, visible.error);
      continue;
    }
    if (visible.data.some((row) => row.user_id !== userId)) {
      hasError = fail(`${label} can see foreign seeded categories.`);
      continue;
    }
    const missing = baselinePairs.filter(([type, name]) => !visible.data.some((row) => row.type === type && row.name === name));
    if (missing.length > 0) hasError = fail(`${label} is missing baseline categories: ${JSON.stringify(missing)}`);
    else console.log(`✔ ${label} sees all 12 own baseline categories and no foreign rows.`);
  }

  {
    const resultA = await clientA.from('categories').insert({ user_id: userIdA, name: categoryNameA, type: 'EXPENSE', icon: 'Tag', color: '#333333' }).select('*').single();
    if (resultA.error || !resultA.data) hasError = fail('A could not INSERT own category.', resultA.error);
    else { categoryA = resultA.data; console.log('✔ A INSERT own category.'); }
    const resultB = await clientB.from('categories').insert({ user_id: userIdB, name: categoryNameB, type: 'INCOME', icon: 'Tag', color: '#444444' }).select('*').single();
    if (resultB.error || !resultB.data) hasError = fail('B could not INSERT own category.', resultB.error);
    else { categoryB = resultB.data; console.log('✔ B INSERT own category.'); }

    if (categoryA) {
      const ownReadA = await clientA.from('categories').select('*').eq('id', categoryA.id).single();
      if (ownReadA.error || ownReadA.data?.user_id !== userIdA) hasError = fail('A could not SELECT own category.', ownReadA.error);
      else console.log('✔ A SELECT own category.');
      const ownUpdateA = await clientA.from('categories').update({ name: `${categoryNameA} updated` }).eq('id', categoryA.id).select('*').single();
      if (ownUpdateA.error || ownUpdateA.data?.name !== `${categoryNameA} updated`) hasError = fail('A own category UPDATE did not persist.', ownUpdateA.error);
      else console.log('✔ A UPDATE own category persisted.');
      const ownerChangeA = await clientA.from('categories').update({ user_id: userIdB }).eq('id', categoryA.id).select('id,user_id');
      const readbackA = await clientA.from('categories').select('user_id').eq('id', categoryA.id).single();
      if ((!ownerChangeA.error && ownerChangeA.data.length > 0) || readbackA.error || readbackA.data?.user_id !== userIdA) hasError = fail('A changed category ownership.', ownerChangeA.error || readbackA.error);
      else console.log('✔ A cannot change category user_id.');
    }

    if (categoryB) {
      const ownReadB = await clientB.from('categories').select('*').eq('id', categoryB.id).single();
      if (ownReadB.error || ownReadB.data?.user_id !== userIdB) hasError = fail('B could not SELECT own category.', ownReadB.error);
      else console.log('✔ B SELECT own category.');
      const ownUpdateB = await clientB.from('categories').update({ name: `${categoryNameB} updated` }).eq('id', categoryB.id).select('*').single();
      if (ownUpdateB.error || ownUpdateB.data?.name !== `${categoryNameB} updated`) hasError = fail('B own category UPDATE did not persist.', ownUpdateB.error);
      else console.log('✔ B UPDATE own category persisted.');
      const ownerChangeB = await clientB.from('categories').update({ user_id: userIdA }).eq('id', categoryB.id).select('id,user_id');
      const readbackB = await clientB.from('categories').select('user_id').eq('id', categoryB.id).single();
      if ((!ownerChangeB.error && ownerChangeB.data.length > 0) || readbackB.error || readbackB.data?.user_id !== userIdB) hasError = fail('B changed category ownership.', ownerChangeB.error || readbackB.error);
      else console.log('✔ B cannot change category user_id.');
    }

    const insertAForB = await clientA.from('categories').insert({ user_id: userIdB, name: `A-cat-for-B ${runId}`, type: 'EXPENSE', icon: 'Tag', color: '#555555' });
    if (!insertAForB.error) hasError = fail('A INSERTed a category owned by B.'); else console.log('✔ A cannot INSERT category for B.');
    const insertBForA = await clientB.from('categories').insert({ user_id: userIdA, name: `B-cat-for-A ${runId}`, type: 'INCOME', icon: 'Tag', color: '#666666' });
    if (!insertBForA.error) hasError = fail('B INSERTed a category owned by A.'); else console.log('✔ B cannot INSERT category for A.');

    if (categoryA && categoryB) {
      const aReadsB = await clientA.from('categories').select('id').eq('id', categoryB.id);
      if (aReadsB.error || aReadsB.data.length !== 0) hasError = fail('A foreign category SELECT was not an RLS-empty result.', aReadsB.error);
      else console.log('✔ A cannot SELECT B category.');
      const bReadsA = await clientB.from('categories').select('id').eq('id', categoryA.id);
      if (bReadsA.error || bReadsA.data.length !== 0) hasError = fail('B foreign category SELECT was not an RLS-empty result.', bReadsA.error);
      else console.log('✔ B cannot SELECT A category.');
      const aUpdatesB = await clientA.from('categories').update({ name: `A hacked B category ${runId}` }).eq('id', categoryB.id).select('id');
      if (aUpdatesB.error || aUpdatesB.data.length !== 0) hasError = fail('A foreign category UPDATE was not blocked as zero rows.', aUpdatesB.error);
      else console.log('✔ A cannot UPDATE B category.');
      const bUpdatesA = await clientB.from('categories').update({ name: `B hacked A category ${runId}` }).eq('id', categoryA.id).select('id');
      if (bUpdatesA.error || bUpdatesA.data.length !== 0) hasError = fail('B foreign category UPDATE was not blocked as zero rows.', bUpdatesA.error);
      else console.log('✔ B cannot UPDATE A category.');
    }
  }

  console.log('\n[4/5] Checked archive cleanup...');
  const cleanupTargets = [
    [clientA, 'accounts', accountA, 'Verifier account A archived'],
    [clientB, 'accounts', accountB, 'Verifier account B archived'],
    [clientA, 'categories', categoryA, 'Verifier category A archived'],
    [clientB, 'categories', categoryB, 'Verifier category B archived'],
  ];
  for (const [client, table, row, label] of cleanupTargets) {
    if (!row) continue;
    const cleanup = await client.from(table).update({ is_archived: true }).eq('id', row.id).select('id,is_archived').single();
    if (cleanup.error || cleanup.data?.is_archived !== true) hasError = fail(`${label} cleanup was not proven.`, cleanup.error);
    else console.log(`✔ ${label}.`);
  }

  console.log('\n[5/5] Summary');
  if (hasError) {
    console.error('❌ FAIL: One or more Phase 3 runtime RLS assertions failed.');
    process.exit(1);
  }
  console.log('✅ PASS: Phase 3 two-user runtime RLS matrix passed completely.');
}

run().catch((error) => {
  console.error('❌ FAIL: Unexpected verifier exception.', error);
  process.exit(1);
});
