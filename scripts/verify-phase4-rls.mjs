import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const USER_A_EMAIL = process.env.FINORA_TEST_USER_A_EMAIL;
const USER_A_PASSWORD = process.env.FINORA_TEST_USER_A_PASSWORD;
const USER_B_EMAIL = process.env.FINORA_TEST_USER_B_EMAIL;
const USER_B_PASSWORD = process.env.FINORA_TEST_USER_B_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !USER_A_EMAIL || !USER_B_EMAIL) {
  console.error("Missing credentials");
  process.exit(1);
}

const clientA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const clientB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

async function run() {
  const { data: authA, error: errA } = await clientA.auth.signInWithPassword({ email: USER_A_EMAIL, password: USER_A_PASSWORD });
  assert(!errA, "A auth fail");
  
  const { data: authB, error: errB } = await clientB.auth.signInWithPassword({ email: USER_B_EMAIL, password: USER_B_PASSWORD });
  assert(!errB, "B auth fail");

  const uidA = authA.user.id;
  const uidB = authB.user.id;

  // Setup A
  const { data: catA, error: catErrA } = await clientA.from('categories').insert({
    user_id: uidA, name: 'Phase4CatA', type: 'EXPENSE', icon: 'Car', color: '#111111'
  }).select().single();
  assert(!catErrA, "A cat insert fail: " + catErrA?.message);

  const { data: accA, error: accErrA } = await clientA.from('accounts').insert({
    user_id: uidA, name: 'Phase4AccA', type: 'CASH', currency_code: 'VND', opening_balance: 1000, color: '#111111'
  }).select().single();
  assert(!accErrA, "A acc insert fail: " + accErrA?.message);

  // Setup B
  const { data: catB, error: catErrB } = await clientB.from('categories').insert({
    user_id: uidB, name: 'Phase4CatB', type: 'EXPENSE', icon: 'Car', color: '#222222'
  }).select().single();
  assert(!catErrB, "B cat insert fail");

  const { data: accB, error: accErrB } = await clientB.from('accounts').insert({
    user_id: uidB, name: 'Phase4AccB', type: 'CASH', currency_code: 'VND', opening_balance: 1000, color: '#222222'
  }).select().single();
  assert(!accErrB, "B acc insert fail");

  // A insert own transaction
  const { data: txA, error: txErrA } = await clientA.from('transactions').insert({
    account_id: accA.id, category_id: catA.id, type: 'EXPENSE', amount: 100, currency_code: 'VND', merchant: 'M'
  }).select().single();
  assert(!txErrA, "A tx insert fail");

  // Read balance
  let { data: bal1 } = await clientA.from('account_balances').select().eq('account_id', accA.id).single();
  assert(bal1 && bal1.current_balance === '900.0000', "Balance exact read fail (expected 900.0000, got " + bal1?.current_balance + ")");

  // A update own
  const { error: upErrA } = await clientA.from('transactions').update({ merchant: 'M2' }).eq('id', txA.id);
  assert(!upErrA, "A tx update fail");

  // A void own
  await clientA.from('transactions').update({ is_voided: true }).eq('id', txA.id);
  let { data: bal2 } = await clientA.from('account_balances').select().eq('account_id', accA.id).single();
  assert(bal2 && bal2.current_balance === '1000.0000', "Void balance fail");

  // A restore own
  await clientA.from('transactions').update({ is_voided: false }).eq('id', txA.id);
  let { data: bal3 } = await clientA.from('account_balances').select().eq('account_id', accA.id).single();
  assert(bal3 && bal3.current_balance === '900.0000', "Restore balance fail");

  // B tries to select A's tx
  const { data: bSel } = await clientB.from('transactions').select().eq('id', txA.id);
  assert(bSel && bSel.length === 0, "B selected A's tx");

  // B tries to update A's tx
  await clientB.from('transactions').update({ merchant: 'Hacked' }).eq('id', txA.id);
  const { data: checkTx } = await clientA.from('transactions').select().eq('id', txA.id).single();
  assert(checkTx.merchant !== 'Hacked', "B updated A's tx");

  // A tries to insert with B's account
  const { error: crossAcc } = await clientA.from('transactions').insert({
    account_id: accB.id, category_id: catA.id, type: 'EXPENSE', amount: 100, currency_code: 'VND', merchant: 'M'
  });
  assert(crossAcc, "A inserted with B's account");

  // Clean up
  await clientA.from('transactions').update({ is_voided: true }).eq('id', txA.id);
  await clientA.from('accounts').update({ is_archived: true }).eq('id', accA.id);
  await clientA.from('categories').update({ is_archived: true }).eq('id', catA.id);
  await clientB.from('accounts').update({ is_archived: true }).eq('id', accB.id);
  await clientB.from('categories').update({ is_archived: true }).eq('id', catB.id);

  console.log("PASS");
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
