import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const EMAIL_A = process.env.FINORA_TEST_USER_A_EMAIL;
const PASS_A = process.env.FINORA_TEST_USER_A_PASSWORD;
const EMAIL_B = process.env.FINORA_TEST_USER_B_EMAIL;
const PASS_B = process.env.FINORA_TEST_USER_B_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_KEY || !EMAIL_A || !PASS_A || !EMAIL_B || !PASS_B) {
  console.error("Missing required environment variables for RLS test.");
  process.exit(1);
}

const clientA = createClient(SUPABASE_URL, SUPABASE_KEY);
const clientB = createClient(SUPABASE_URL, SUPABASE_KEY);

let total = 0;
let passed = 0;


function exactMoneyEqual(a, b) {
  const pad = (s) => {
    let [int, frac = ''] = String(s).split('.');
    return `${int}.${frac.padEnd(4, '0')}`;
  };
  return pad(a) === pad(b);
}

function assert(condition, msg) {
  total++;
  if (!condition) {
    console.error(`[FAIL] ${msg}`);
    process.exit(1);
  } else {
    console.log(`[PASS] ${msg}`);
    passed++;
  }
}

async function runTests() {
  console.log('--- Auth Setup ---');
  const authA = await clientA.auth.signInWithPassword({ email: EMAIL_A, password: PASS_A });
  assert(!authA.error && authA.data.user, 'AUTH_A_B=PASS - User A signed in');
  const userAId = authA.data.user.id;

  const authB = await clientB.auth.signInWithPassword({ email: EMAIL_B, password: PASS_B });
  assert(!authB.error && authB.data.user, 'AUTH_A_B=PASS - User B signed in');
  const userBId = authB.data.user.id;

  const runId = Math.random().toString(36).substring(7);

    let origA, origB, txId, trId, accA1Id, accA2Id, catAId;
  try {
console.log('\n--- Settings A/B lifecycle and isolation ---');
  const getA = await clientA.from('user_settings').select('auto_fx_enabled').eq('user_id', userAId).single();
  origA = getA.data?.auto_fx_enabled;

  const getB = await clientB.from('user_settings').select('auto_fx_enabled').eq('user_id', userBId).single();
  origB = getB.data?.auto_fx_enabled;

  const updateA = await clientA.from('user_settings').update({ auto_fx_enabled: !origA }).eq('user_id', userAId).select();
  assert(updateA.data && updateA.data.length === 1 && updateA.data[0].auto_fx_enabled === !origA, 'AUTO_FX_LIFECYCLE_A_B=PASS - A toggled own settings');

  const updateB = await clientB.from('user_settings').update({ auto_fx_enabled: !origB }).eq('user_id', userBId).select();
  assert(updateB.data && updateB.data.length === 1 && updateB.data[0].auto_fx_enabled === !origB, 'AUTO_FX_LIFECYCLE_A_B=PASS - B toggled own settings');

  const xUpdateA = await clientA.from('user_settings').update({ auto_fx_enabled: origB }).eq('user_id', userBId).select();
  assert(xUpdateA.data && xUpdateA.data.length === 0, 'BIDIRECTIONAL_SETTINGS_ISOLATION=PASS - A cannot update B settings');
  const xUpdateB = await clientB.from('user_settings').update({ auto_fx_enabled: origA }).eq('user_id', userAId).select();
  assert(xUpdateB.data && xUpdateB.data.length === 0, 'BIDIRECTIONAL_SETTINGS_ISOLATION=PASS - B cannot update A settings');

  const xSelA = await clientA.from('user_settings').select().eq('user_id', userBId);
  assert(xSelA.data && xSelA.data.length === 0, 'BIDIRECTIONAL_SETTINGS_ISOLATION=PASS - A cannot select B settings');
  const xSelB = await clientB.from('user_settings').select().eq('user_id', userAId);
  assert(xSelB.data && xSelB.data.length === 0, 'BIDIRECTIONAL_SETTINGS_ISOLATION=PASS - B cannot select A settings');

  console.log('\n--- Snapshot mutation denial ---');
  const badInsert = await clientA.from('transaction_fx_snapshots').insert({
    user_id: userAId,
    transaction_id: '00000000-0000-0000-0000-000000000000',
    target_currency_code: 'VND',
    source_currency_code: 'USD',
    source_amount: '10.0000',
    rate: '1.000000000000',
    converted_amount: '10.0000',
    requested_date: '2023-10-01',
    effective_date: '2023-10-01',
    provider: 'IDENTITY'
  });
  // RLS error for insert is usually 42501 (new row violates row-level security policy for table)
  assert(badInsert.error && badInsert.error.code === '42501', 'SNAPSHOT_BROWSER_MUTATION_DENIAL=PASS - Insert denied');

  const badUpdate = await clientA.from('transaction_fx_snapshots').update({ rate: '2.00' }).eq('user_id', userAId).select();
  assert(badUpdate.error != null || (badUpdate.data && badUpdate.data.length === 0), 'SNAPSHOT_BROWSER_MUTATION_DENIAL=PASS - Update denied');

  const badDelete = await clientA.from('transaction_fx_snapshots')['delete']().eq('user_id', userAId).select();
  assert(badDelete.error != null || (badDelete.data && badDelete.data.length === 0), 'SNAPSHOT_BROWSER_MUTATION_DENIAL=PASS - Delete denied');

  console.log('\n--- Bidirectional Snapshot isolation ---');
  const snapSelA = await clientA.from('transaction_fx_snapshots').select().eq('user_id', userBId);
  assert(snapSelA.data && snapSelA.data.length === 0, 'BIDIRECTIONAL_SNAPSHOT_ISOLATION=PASS - A cannot read B snapshots');
  const snapSelB = await clientB.from('transaction_fx_snapshots').select().eq('user_id', userAId);
  assert(snapSelB.data && snapSelB.data.length === 0, 'BIDIRECTIONAL_SNAPSHOT_ISOLATION=PASS - B cannot read A snapshots');

  console.log('\n--- Setup Data for regressions ---');
  // Category A
  const catA = await clientA.from('categories').insert({
    user_id: userAId, name: `Cat A ${runId}`, type: 'INCOME', color: '#000000', icon: 'smile'
  }).select().single();
  catAId = catA.data.id;

  // Accounts A
  const accA1 = await clientA.from('accounts').insert({
    user_id: userAId, name: `Acc1 ${runId}`, type: 'BANK', currency_code: 'USD', opening_balance: '100.0000', color: '#000000'
  }).select().single();
  accA1Id = accA1.data.id;

  const accA2 = await clientA.from('accounts').insert({
    user_id: userAId, name: `Acc2 ${runId}`, type: 'BANK', currency_code: 'USD', opening_balance: '0.0000', color: '#000000'
  }).select().single();
  accA2Id = accA2.data.id;

  console.log('\n--- Phase 4 Transaction regression ---');
  const txInsert = await clientA.from('transactions').insert({
    user_id: userAId, account_id: accA1Id, category_id: catAId, type: 'INCOME',
    amount: '50.0000', currency_code: 'USD', merchant: 'T', occurred_on: '2023-10-01'
  }).select().single();
  txId = txInsert.data.id;

  const txReadA = await clientA.from('transaction_details').select().eq('id', txId);
  assert(txReadA.data && txReadA.data.length === 1, 'PHASE4_TRANSACTION_BALANCE_REGRESSION=PASS - Owner read transaction_details');
  const txReadB = await clientB.from('transaction_details').select().eq('id', txId);
  assert(txReadB.data && txReadB.data.length === 0, 'PHASE4_TRANSACTION_BALANCE_REGRESSION=PASS - Other sees zero');

  const bal1 = await clientA.from('account_balances').select('current_balance').eq('account_id', accA1Id).single();
  assert(exactMoneyEqual(bal1.data.current_balance, '150.0000'), 'PHASE4_TRANSACTION_BALANCE_REGRESSION=PASS - Balance changes exactly');

  await clientA.from('transactions').update({ is_voided: true }).eq('id', txId);
  const bal2 = await clientA.from('account_balances').select('current_balance').eq('account_id', accA1Id).single();
  assert(exactMoneyEqual(bal2.data.current_balance, '100.0000'), 'PHASE4_TRANSACTION_BALANCE_REGRESSION=PASS - Balance reverts on void');

  console.log('\n--- Phase 5 Transfer neutrality regression ---');
  const trInsert = await clientA.from('transfers').insert({
    user_id: userAId, from_account_id: accA1Id, to_account_id: accA2Id,
    amount: '30.0000', currency_code: 'USD', occurred_on: '2023-10-01'
  }).select().single();
  trId = trInsert.data.id;

  const trReadA = await clientA.from('transfer_details').select().eq('id', trId);
  assert(trReadA.data && trReadA.data.length === 1, 'PHASE5_TRANSFER_NEUTRALITY_REGRESSION=PASS - Owner read transfer_details');
  const trReadB = await clientB.from('transfer_details').select().eq('id', trId);
  assert(trReadB.data && trReadB.data.length === 0, 'PHASE5_TRANSFER_NEUTRALITY_REGRESSION=PASS - Other sees zero');

  const b1 = await clientA.from('account_balances').select('current_balance').eq('account_id', accA1Id).single();
  const b2 = await clientA.from('account_balances').select('current_balance').eq('account_id', accA2Id).single();
  assert(exactMoneyEqual(b1.data.current_balance, '70.0000'), 'PHASE5_TRANSFER_NEUTRALITY_REGRESSION=PASS - Source decrease exact');
  assert(exactMoneyEqual(b2.data.current_balance, '30.0000'), 'PHASE5_TRANSFER_NEUTRALITY_REGRESSION=PASS - Dest increase exact');

  await clientA.from('transfers').update({ is_voided: true }).eq('id', trId);
  const b3 = await clientA.from('account_balances').select('current_balance').eq('account_id', accA1Id).single();
  const b4 = await clientA.from('account_balances').select('current_balance').eq('account_id', accA2Id).single();
  assert(exactMoneyEqual(b3.data.current_balance, '100.0000') && exactMoneyEqual(b4.data.current_balance, '0.0000'), 'PHASE5_TRANSFER_NEUTRALITY_REGRESSION=PASS - Balances restore on void');

  console.log('\n--- Deliberate non-RLS error distinction ---');
  const nonRls = await clientA.from('transactions').insert({
    user_id: userAId, account_id: '00000000-0000-0000-0000-000000000000', category_id: catAId, type: 'INCOME',
    amount: '50', currency_code: 'USD', merchant: 'T', occurred_on: '2023-10-01'
  });
  assert(nonRls.error && nonRls.error.code === '23503', 'DELIBERATE_NON_RLS_ERROR_DISTINCTION=PASS - Distinguish RLS (42501) vs FK (23503)');

    } finally {

  console.log('\n--- Cleanup ---');
  if (typeof origA !== 'undefined' && userAId) {
    const resA = await clientA.from('user_settings').update({ auto_fx_enabled: origA }).eq('user_id', userAId).select();
    assert(resA.data && resA.data.length === 1 && resA.data[0].auto_fx_enabled === origA, 'DETERMINISTIC_CLEANUP=PASS - Settings A restored');
  }
  if (typeof origB !== 'undefined' && userBId) {
    const resB = await clientB.from('user_settings').update({ auto_fx_enabled: origB }).eq('user_id', userBId).select();
    assert(resB.data && resB.data.length === 1 && resB.data[0].auto_fx_enabled === origB, 'DETERMINISTIC_CLEANUP=PASS - Settings B restored');
  }
  if (typeof txId !== 'undefined') {
    const cl1 = await clientA.from('transactions').update({ is_voided: true }).eq('id', txId).select();
    assert(cl1.data && cl1.data.length === 1 && cl1.data[0].is_voided === true, 'DETERMINISTIC_CLEANUP=PASS - TX voided');
  }
  if (typeof trId !== 'undefined') {
    const cl2 = await clientA.from('transfers').update({ is_voided: true }).eq('id', trId).select();
    assert(cl2.data && cl2.data.length === 1 && cl2.data[0].is_voided === true, 'DETERMINISTIC_CLEANUP=PASS - Transfer voided');
  }
  if (typeof accA1Id !== 'undefined' && typeof accA2Id !== 'undefined') {
    const cl3 = await clientA.from('accounts').update({ is_archived: true }).in('id', [accA1Id, accA2Id]).select();
    assert(cl3.data && cl3.data.length === 2 && cl3.data[0].is_archived === true, 'DETERMINISTIC_CLEANUP=PASS - Accounts archived');
  }
  if (typeof catAId !== 'undefined') {
    const cl4 = await clientA.from('categories').update({ is_archived: true }).eq('id', catAId).select();
    assert(cl4.data && cl4.data.length === 1 && cl4.data[0].is_archived === true, 'DETERMINISTIC_CLEANUP=PASS - Category archived');
  }
  }
  console.log('\n99_OVERALL=PASS');
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
