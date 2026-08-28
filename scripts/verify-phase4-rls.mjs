// scripts/verify-phase4-rls.mjs
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

async function run() {
  const { error: errA } = await clientA.auth.signInWithPassword({ email: USER_A_EMAIL, password: USER_A_PASSWORD });
  if (errA) throw new Error("A auth fail");
  console.log("USER_A_AUTH\nPASS");

  const { error: errB } = await clientB.auth.signInWithPassword({ email: USER_B_EMAIL, password: USER_B_PASSWORD });
  if (errB) throw new Error("B auth fail");
  console.log("USER_B_AUTH\nPASS");

  // Create a category for A
  const { data: catA, error: catAErr } = await clientA.from('categories').insert({
    name: 'Test Cat A',
    type: 'EXPENSE',
    icon: 'Car',
    color: '#000',
  }).select().single();
  if (catAErr) throw catAErr;

  // Create an account for A
  const { data: accA, error: accAErr } = await clientA.from('accounts').insert({
    name: 'Test Acc A',
    type: 'CASH',
    currency_code: 'VND',
    opening_balance: 1000,
    color: '#000'
  }).select().single();
  if (accAErr) throw accAErr;

  // Create a transaction for A
  const { data: txA, error: txAErr } = await clientA.from('transactions').insert({
    account_id: accA.id,
    category_id: catA.id,
    type: 'EXPENSE',
    amount: 100,
    currency_code: 'VND',
    merchant: 'Merchant A',
    occurred_on: '2026-08-28'
  }).select().single();
  if (txAErr) {
    console.log("TRANSACTION_OWN_INSERT_SELECT_UPDATE\nFAIL");
    throw txAErr;
  }
  
  // Select it
  const { data: selTxA, error: selTxAErr } = await clientA.from('transactions').select().eq('id', txA.id).single();
  if (selTxAErr || !selTxA) throw new Error("Could not select own tx");

  // Update it
  const { error: upTxAErr } = await clientA.from('transactions').update({ merchant: 'Updated A' }).eq('id', txA.id);
  if (upTxAErr) throw new Error("Could not update own tx");

  console.log("TRANSACTION_OWN_INSERT_SELECT_UPDATE\nPASS");

  // B tries to select A's transaction
  const { data: bSelTxA } = await clientB.from('transactions').select().eq('id', txA.id);
  if (bSelTxA && bSelTxA.length > 0) {
    console.log("TRANSACTION_CROSS_USER_SELECT_BLOCKED\nFAIL");
  } else {
    console.log("TRANSACTION_CROSS_USER_SELECT_BLOCKED\nPASS");
  }

  // B tries to update A's transaction
  const { error: bUpTxAErr } = await clientB.from('transactions').update({ merchant: 'Hacked by B' }).eq('id', txA.id);
  if (!bUpTxAErr) {
    // If it succeeds silently but doesn't update, it's also blocked. Let's check if it actually updated.
    const { data: checkTxA } = await clientA.from('transactions').select().eq('id', txA.id).single();
    if (checkTxA.merchant === 'Hacked by B') {
      console.log("TRANSACTION_CROSS_USER_UPDATE_BLOCKED\nFAIL");
    } else {
      console.log("TRANSACTION_CROSS_USER_UPDATE_BLOCKED\nPASS");
    }
  } else {
    console.log("TRANSACTION_CROSS_USER_UPDATE_BLOCKED\nPASS");
  }

  // A tries to insert with B's account
  // Create an account for B
  const { data: accB } = await clientB.from('accounts').insert({
    name: 'Test Acc B', type: 'CASH', currency_code: 'VND', opening_balance: 1000, color: '#000'
  }).select().single();
  
  const { error: aInsTxBErr } = await clientA.from('transactions').insert({
    account_id: accB.id,
    category_id: catA.id,
    type: 'EXPENSE',
    amount: 100,
    currency_code: 'VND',
    merchant: 'Hacked by A'
  });
  if (aInsTxBErr) {
    console.log("TRANSACTION_CROSS_USER_INSERT_BLOCKED\nPASS");
  } else {
    console.log("TRANSACTION_CROSS_USER_INSERT_BLOCKED\nFAIL");
  }

  // Check account balances view
  const { data: balA, error: balAErr } = await clientA.from('account_balances').select().eq('account_id', accA.id).single();
  if (balAErr || !balA) {
    console.log("ACCOUNT_BALANCES_VIEW_INVOKER\nFAIL");
  } else {
    if (balA.current_balance === 900) {
      console.log("ACCOUNT_BALANCES_VIEW_INVOKER\nPASS");
    } else {
      console.log("ACCOUNT_BALANCES_VIEW_INVOKER\nFAIL");
    }
  }

  console.log("RUNTIME_RLS_SCRIPT_SYNTAX\nPASS");
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
