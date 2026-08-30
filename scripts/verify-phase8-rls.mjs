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

  assert(userAId !== userBId, 'DISTINCT_USERS=PASS - User A and User B have distinct IDs');

  const runId = Math.random().toString(36).substring(7);

  let origA, origB;
  let txId, trId, accA1Id, accA2Id, catAId;
  let txBId, trBId, accB1Id, accB2Id, catBId;

  try {
    console.log('\n--- Settings A/B lifecycle and isolation ---');
    const getA = await clientA.from('user_settings').select('auto_fx_enabled').eq('user_id', userAId).single();
    assert(!getA.error && typeof getA.data?.auto_fx_enabled === 'boolean', 'SETTINGS_READINESS=PASS - User A settings read succeed with boolean');
    origA = getA.data.auto_fx_enabled;

    const getB = await clientB.from('user_settings').select('auto_fx_enabled').eq('user_id', userBId).single();
    assert(!getB.error && typeof getB.data?.auto_fx_enabled === 'boolean', 'SETTINGS_READINESS=PASS - User B settings read succeed with boolean');
    origB = getB.data.auto_fx_enabled;

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
    assert(badInsert.error && badInsert.error.code === '42501', 'SNAPSHOT_BROWSER_MUTATION_DENIAL=PASS - Insert denied with RLS 42501');

    const snapsBeforeA = await clientA.from('transaction_fx_snapshots').select('*').eq('user_id', userAId);
    assert(!snapsBeforeA.error, 'SNAPSHOT_READBACK=PASS - A reads own snapshots before mutation attempt');

    const badUpdate = await clientA.from('transaction_fx_snapshots').update({ rate: '2.000000000000' }).eq('user_id', userAId).select();
    const updateDenied = (badUpdate.error && badUpdate.error.code === '42501') || (badUpdate.data && badUpdate.data.length === 0);
    const snapsAfterUpdateA = await clientA.from('transaction_fx_snapshots').select('*').eq('user_id', userAId);
    const updateUnchanged = JSON.stringify(snapsBeforeA.data) === JSON.stringify(snapsAfterUpdateA.data);
    assert(updateDenied && updateUnchanged, 'SNAPSHOT_BROWSER_MUTATION_DENIAL=PASS - Update denied with mutation proof and readback');

    const badDelete = await clientA.from('transaction_fx_snapshots')['delete']().eq('user_id', userAId).select();
    const deleteDenied = (badDelete.error && badDelete.error.code === '42501') || (badDelete.data && badDelete.data.length === 0);
    const snapsAfterDeleteA = await clientA.from('transaction_fx_snapshots').select('*').eq('user_id', userAId);
    const deleteUnchanged = JSON.stringify(snapsBeforeA.data) === JSON.stringify(snapsAfterDeleteA.data);
    assert(deleteDenied && deleteUnchanged, 'SNAPSHOT_BROWSER_MUTATION_DENIAL=PASS - Delete denied with mutation proof and readback');

    console.log('\n--- Bidirectional Snapshot isolation ---');
    const snapSelA = await clientA.from('transaction_fx_snapshots').select().eq('user_id', userBId);
    assert(snapSelA.data && snapSelA.data.length === 0, 'BIDIRECTIONAL_SNAPSHOT_ISOLATION=PASS - A cannot read B snapshots');
    const snapSelB = await clientB.from('transaction_fx_snapshots').select().eq('user_id', userAId);
    assert(snapSelB.data && snapSelB.data.length === 0, 'BIDIRECTIONAL_SNAPSHOT_ISOLATION=PASS - B cannot read A snapshots');

    const snapViewSelA = await clientA.from('transaction_fx_snapshot_details').select().eq('user_id', userBId);
    assert(snapViewSelA.data && snapViewSelA.data.length === 0, 'BIDIRECTIONAL_SNAPSHOT_VIEW_ISOLATION=PASS - A cannot read B snapshot view');
    const snapViewSelB = await clientB.from('transaction_fx_snapshot_details').select().eq('user_id', userAId);
    assert(snapViewSelB.data && snapViewSelB.data.length === 0, 'BIDIRECTIONAL_SNAPSHOT_VIEW_ISOLATION=PASS - B cannot read A snapshot view');

    console.log('\n--- Setup Data for regressions ---');
    // Category A & B
    const catA = await clientA.from('categories').insert({
      user_id: userAId, name: `Cat A ${runId}`, type: 'INCOME', color: '#000000', icon: 'smile'
    }).select().single();
    catAId = catA.data.id;

    const catB = await clientB.from('categories').insert({
      user_id: userBId, name: `Cat B ${runId}`, type: 'INCOME', color: '#000000', icon: 'smile'
    }).select().single();
    catBId = catB.data.id;

    // Accounts A & B
    const accA1 = await clientA.from('accounts').insert({
      user_id: userAId, name: `AccA1 ${runId}`, type: 'BANK', currency_code: 'USD', opening_balance: '100.0000', color: '#000000'
    }).select().single();
    accA1Id = accA1.data.id;

    const accA2 = await clientA.from('accounts').insert({
      user_id: userAId, name: `AccA2 ${runId}`, type: 'BANK', currency_code: 'USD', opening_balance: '0.0000', color: '#000000'
    }).select().single();
    accA2Id = accA2.data.id;

    const accB1 = await clientB.from('accounts').insert({
      user_id: userBId, name: `AccB1 ${runId}`, type: 'BANK', currency_code: 'USD', opening_balance: '100.0000', color: '#000000'
    }).select().single();
    accB1Id = accB1.data.id;

    const accB2 = await clientB.from('accounts').insert({
      user_id: userBId, name: `AccB2 ${runId}`, type: 'BANK', currency_code: 'USD', opening_balance: '0.0000', color: '#000000'
    }).select().single();
    accB2Id = accB2.data.id;

    console.log('\n--- Phase 4 Transaction regression ---');
    const txInsertA = await clientA.from('transactions').insert({
      user_id: userAId, account_id: accA1Id, category_id: catAId, type: 'INCOME',
      amount: '50.0000', currency_code: 'USD', merchant: 'TA', occurred_on: '2023-10-01'
    }).select().single();
    txId = txInsertA.data.id;

    const txReadA = await clientA.from('transaction_details').select().eq('id', txId);
    assert(txReadA.data && txReadA.data.length === 1, 'PHASE4_TRANSACTION_BALANCE_REGRESSION=PASS - Owner read transaction_details');
    const txReadB = await clientB.from('transaction_details').select().eq('id', txId);
    assert(txReadB.data && txReadB.data.length === 0, 'PHASE4_TRANSACTION_BALANCE_REGRESSION=PASS - Other sees zero');

    const bal1 = await clientA.from('account_balances').select('current_balance').eq('account_id', accA1Id).single();
    assert(exactMoneyEqual(bal1.data.current_balance, '150.0000'), 'PHASE4_TRANSACTION_BALANCE_REGRESSION=PASS - Balance changes exactly');

    await clientA.from('transactions').update({ is_voided: true }).eq('id', txId);
    const bal2 = await clientA.from('account_balances').select('current_balance').eq('account_id', accA1Id).single();
    assert(exactMoneyEqual(bal2.data.current_balance, '100.0000'), 'PHASE4_TRANSACTION_BALANCE_REGRESSION=PASS - Balance reverts on void');

    // Bidirectional Transaction Isolation
    const txInsertB = await clientB.from('transactions').insert({
      user_id: userBId, account_id: accB1Id, category_id: catBId, type: 'INCOME',
      amount: '50.0000', currency_code: 'USD', merchant: 'TB', occurred_on: '2023-10-01'
    }).select().single();
    txBId = txInsertB.data.id;

    const txReadBOwner = await clientB.from('transaction_details').select().eq('id', txBId);
    assert(txReadBOwner.data && txReadBOwner.data.length === 1, 'BIDIRECTIONAL_TX_ISOLATION=PASS - Owner B read transaction_details');
    const txReadAForeign = await clientA.from('transaction_details').select().eq('id', txBId);
    assert(txReadAForeign.data && txReadAForeign.data.length === 0, 'BIDIRECTIONAL_TX_ISOLATION=PASS - User A sees zero for B transaction');

    console.log('\n--- Phase 5 Transfer neutrality regression ---');
    const trInsertA = await clientA.from('transfers').insert({
      user_id: userAId, from_account_id: accA1Id, to_account_id: accA2Id,
      amount: '30.0000', currency_code: 'USD', occurred_on: '2023-10-01'
    }).select().single();
    trId = trInsertA.data.id;

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

    // Bidirectional Transfer Isolation
    const trInsertB = await clientB.from('transfers').insert({
      user_id: userBId, from_account_id: accB1Id, to_account_id: accB2Id,
      amount: '30.0000', currency_code: 'USD', occurred_on: '2023-10-01'
    }).select().single();
    trBId = trInsertB.data.id;

    const trReadBOwner = await clientB.from('transfer_details').select().eq('id', trBId);
    assert(trReadBOwner.data && trReadBOwner.data.length === 1, 'BIDIRECTIONAL_TR_ISOLATION=PASS - Owner B read transfer_details');
    const trReadAForeign = await clientA.from('transfer_details').select().eq('id', trBId);
    assert(trReadAForeign.data && trReadAForeign.data.length === 0, 'BIDIRECTIONAL_TR_ISOLATION=PASS - User A sees zero for B transfer');

    console.log('\n--- Deliberate non-RLS error distinction ---');
    const nonRls = await clientA.from('transactions').insert({
      user_id: userAId, account_id: '00000000-0000-0000-0000-000000000000', category_id: catAId, type: 'INCOME',
      amount: '50', currency_code: 'USD', merchant: 'T', occurred_on: '2023-10-01'
    });
    assert(nonRls.error && nonRls.error.code === '23503', 'DELIBERATE_NON_RLS_ERROR_DISTINCTION=PASS - Distinguish RLS (42501) vs FK (23503)');

  } finally {
    console.log('\n--- Cleanup ---');
    const cleanupFailures = [];

    function checkCleanup(condition, msg) {
      if (condition) {
        console.log(`[PASS] ${msg}`);
      } else {
        console.error(`[FAIL] ${msg}`);
        cleanupFailures.push(msg);
      }
    }

    // Settings A
    if (typeof origA !== 'undefined' && userAId) {
      try {
        const resA = await clientA.from('user_settings').update({ auto_fx_enabled: origA }).eq('user_id', userAId).select();
        checkCleanup(resA.data && resA.data.length === 1 && resA.data[0].auto_fx_enabled === origA, 'DETERMINISTIC_CLEANUP=PASS - Settings A updated');
        const readbackA = await clientA.from('user_settings').select('auto_fx_enabled').eq('user_id', userAId).single();
        checkCleanup(!readbackA.error && readbackA.data.auto_fx_enabled === origA, 'DETERMINISTIC_CLEANUP=PASS - Settings A readback persisted');
      } catch (err) {
        cleanupFailures.push(`Settings A cleanup error: ${err.message}`);
      }
    }

    // Settings B
    if (typeof origB !== 'undefined' && userBId) {
      try {
        const resB = await clientB.from('user_settings').update({ auto_fx_enabled: origB }).eq('user_id', userBId).select();
        checkCleanup(resB.data && resB.data.length === 1 && resB.data[0].auto_fx_enabled === origB, 'DETERMINISTIC_CLEANUP=PASS - Settings B updated');
        const readbackB = await clientB.from('user_settings').select('auto_fx_enabled').eq('user_id', userBId).single();
        checkCleanup(!readbackB.error && readbackB.data.auto_fx_enabled === origB, 'DETERMINISTIC_CLEANUP=PASS - Settings B readback persisted');
      } catch (err) {
        cleanupFailures.push(`Settings B cleanup error: ${err.message}`);
      }
    }

    // Transactions A & B
    if (typeof txId !== 'undefined') {
      try {
        const cl1 = await clientA.from('transactions').update({ is_voided: true }).eq('id', txId).select();
        checkCleanup(cl1.data && cl1.data.length === 1 && cl1.data[0].is_voided === true, 'DETERMINISTIC_CLEANUP=PASS - TX A voided');
        const readTxA = await clientA.from('transactions').select('is_voided').eq('id', txId).single();
        checkCleanup(!readTxA.error && readTxA.data.is_voided === true, 'DETERMINISTIC_CLEANUP=PASS - TX A void readback persisted');
      } catch (err) {
        cleanupFailures.push(`TX A cleanup error: ${err.message}`);
      }
    }
    if (typeof txBId !== 'undefined') {
      try {
        const cl1B = await clientB.from('transactions').update({ is_voided: true }).eq('id', txBId).select();
        checkCleanup(cl1B.data && cl1B.data.length === 1 && cl1B.data[0].is_voided === true, 'DETERMINISTIC_CLEANUP=PASS - TX B voided');
        const readTxB = await clientB.from('transactions').select('is_voided').eq('id', txBId).single();
        checkCleanup(!readTxB.error && readTxB.data.is_voided === true, 'DETERMINISTIC_CLEANUP=PASS - TX B void readback persisted');
      } catch (err) {
        cleanupFailures.push(`TX B cleanup error: ${err.message}`);
      }
    }

    // Transfers A & B
    if (typeof trId !== 'undefined') {
      try {
        const cl2 = await clientA.from('transfers').update({ is_voided: true }).eq('id', trId).select();
        checkCleanup(cl2.data && cl2.data.length === 1 && cl2.data[0].is_voided === true, 'DETERMINISTIC_CLEANUP=PASS - Transfer A voided');
        const readTrA = await clientA.from('transfers').select('is_voided').eq('id', trId).single();
        checkCleanup(!readTrA.error && readTrA.data.is_voided === true, 'DETERMINISTIC_CLEANUP=PASS - Transfer A void readback persisted');
      } catch (err) {
        cleanupFailures.push(`Transfer A cleanup error: ${err.message}`);
      }
    }
    if (typeof trBId !== 'undefined') {
      try {
        const cl2B = await clientB.from('transfers').update({ is_voided: true }).eq('id', trBId).select();
        checkCleanup(cl2B.data && cl2B.data.length === 1 && cl2B.data[0].is_voided === true, 'DETERMINISTIC_CLEANUP=PASS - Transfer B voided');
        const readTrB = await clientB.from('transfers').select('is_voided').eq('id', trBId).single();
        checkCleanup(!readTrB.error && readTrB.data.is_voided === true, 'DETERMINISTIC_CLEANUP=PASS - Transfer B void readback persisted');
      } catch (err) {
        cleanupFailures.push(`Transfer B cleanup error: ${err.message}`);
      }
    }

    // Accounts A & B
    if (typeof accA1Id !== 'undefined' && typeof accA2Id !== 'undefined') {
      try {
        const cl3 = await clientA.from('accounts').update({ is_archived: true }).in('id', [accA1Id, accA2Id]).select();
        checkCleanup(cl3.data && cl3.data.length === 2 && cl3.data.every(a => a.is_archived === true), 'DETERMINISTIC_CLEANUP=PASS - Accounts A archived');
        const readAccA = await clientA.from('accounts').select('is_archived').in('id', [accA1Id, accA2Id]);
        checkCleanup(!readAccA.error && readAccA.data.length === 2 && readAccA.data.every(a => a.is_archived === true), 'DETERMINISTIC_CLEANUP=PASS - Accounts A archived readback persisted');
      } catch (err) {
        cleanupFailures.push(`Accounts A cleanup error: ${err.message}`);
      }
    }
    if (typeof accB1Id !== 'undefined' && typeof accB2Id !== 'undefined') {
      try {
        const cl3B = await clientB.from('accounts').update({ is_archived: true }).in('id', [accB1Id, accB2Id]).select();
        checkCleanup(cl3B.data && cl3B.data.length === 2 && cl3B.data.every(a => a.is_archived === true), 'DETERMINISTIC_CLEANUP=PASS - Accounts B archived');
        const readAccB = await clientB.from('accounts').select('is_archived').in('id', [accB1Id, accB2Id]);
        checkCleanup(!readAccB.error && readAccB.data.length === 2 && readAccB.data.every(a => a.is_archived === true), 'DETERMINISTIC_CLEANUP=PASS - Accounts B archived readback persisted');
      } catch (err) {
        cleanupFailures.push(`Accounts B cleanup error: ${err.message}`);
      }
    }

    // Categories A & B
    if (typeof catAId !== 'undefined') {
      try {
        const cl4 = await clientA.from('categories').update({ is_archived: true }).eq('id', catAId).select();
        checkCleanup(cl4.data && cl4.data.length === 1 && cl4.data[0].is_archived === true, 'DETERMINISTIC_CLEANUP=PASS - Category A archived');
        const readCatA = await clientA.from('categories').select('is_archived').eq('id', catAId).single();
        checkCleanup(!readCatA.error && readCatA.data.is_archived === true, 'DETERMINISTIC_CLEANUP=PASS - Category A archived readback persisted');
      } catch (err) {
        cleanupFailures.push(`Category A cleanup error: ${err.message}`);
      }
    }
    if (typeof catBId !== 'undefined') {
      try {
        const cl4B = await clientB.from('categories').update({ is_archived: true }).eq('id', catBId).select();
        checkCleanup(cl4B.data && cl4B.data.length === 1 && cl4B.data[0].is_archived === true, 'DETERMINISTIC_CLEANUP=PASS - Category B archived');
        const readCatB = await clientB.from('categories').select('is_archived').eq('id', catBId).single();
        checkCleanup(!readCatB.error && readCatB.data.is_archived === true, 'DETERMINISTIC_CLEANUP=PASS - Category B archived readback persisted');
      } catch (err) {
        cleanupFailures.push(`Category B cleanup error: ${err.message}`);
      }
    }

    if (cleanupFailures.length > 0) {
      console.error(`Cleanup failed with ${cleanupFailures.length} issues.`);
      process.exit(1);
    }
  }
  console.log('\n99_OVERALL=PASS');
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
