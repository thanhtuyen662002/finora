import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const USER_A_EMAIL = process.env.FINORA_TEST_USER_A_EMAIL;
const USER_A_PASSWORD = process.env.FINORA_TEST_USER_A_PASSWORD;
const USER_B_EMAIL = process.env.FINORA_TEST_USER_B_EMAIL;
const USER_B_PASSWORD = process.env.FINORA_TEST_USER_B_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !USER_A_EMAIL || !USER_B_EMAIL || !USER_A_PASSWORD || !USER_B_PASSWORD) {
  console.error("FAIL: Missing Supabase environment variables or test user credentials.");
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
  console.log("--- FINORA PHASE 4 TWO-USER RUNTIME RLS & INTEGRITY MATRIX ---");

  // 1. Authenticate User A and User B
  console.log("1. Authenticating User A & User B...");
  const { data: authA, error: errA } = await clientA.auth.signInWithPassword({
    email: USER_A_EMAIL,
    password: USER_A_PASSWORD,
  });
  assert(!errA && authA?.user, `User A login failed: ${errA?.message}`);
  const uidA = authA.user.id;

  const { data: authB, error: errB } = await clientB.auth.signInWithPassword({
    email: USER_B_EMAIL,
    password: USER_B_PASSWORD,
  });
  assert(!errB && authB?.user, `User B login failed: ${errB?.message}`);
  const uidB = authB.user.id;

  assert(uidA !== uidB, "User A and User B must be distinct test users");

  // 2. Setup Fixtures for User A
  console.log("2. Setting up fixtures for User A...");
  const { data: catA_Exp, error: catAErr1 } = await clientA.from('categories').insert({
    user_id: uidA,
    name: 'P4_Test_CatA_Exp',
    type: 'EXPENSE',
    icon: 'Car',
    color: '#e11d48',
  }).select().single();
  assert(!catAErr1 && catA_Exp, `User A Expense category insert failed: ${catAErr1?.message}`);

  const { data: catA_Inc, error: catAErr2 } = await clientA.from('categories').insert({
    user_id: uidA,
    name: 'P4_Test_CatA_Inc',
    type: 'INCOME',
    icon: 'Briefcase',
    color: '#10b981',
  }).select().single();
  assert(!catAErr2 && catA_Inc, `User A Income category insert failed: ${catAErr2?.message}`);

  const { data: accA, error: accAErr } = await clientA.from('accounts').insert({
    user_id: uidA,
    name: 'P4_Test_AccA_VND',
    type: 'CASH',
    currency_code: 'VND',
    opening_balance: 1000000,
    color: '#2563eb',
  }).select().single();
  assert(!accAErr && accA, `User A account insert failed: ${accAErr?.message}`);

  // 3. Setup Fixtures for User B
  console.log("3. Setting up fixtures for User B...");
  const { data: catB_Exp, error: catBErr1 } = await clientB.from('categories').insert({
    user_id: uidB,
    name: 'P4_Test_CatB_Exp',
    type: 'EXPENSE',
    icon: 'Film',
    color: '#7c3aed',
  }).select().single();
  assert(!catBErr1 && catB_Exp, `User B Expense category insert failed: ${catBErr1?.message}`);

  const { data: catB_Inc, error: catBErr2 } = await clientB.from('categories').insert({
    user_id: uidB,
    name: 'P4_Test_CatB_Inc',
    type: 'INCOME',
    icon: 'TrendingUp',
    color: '#059669',
  }).select().single();
  assert(!catBErr2 && catB_Inc, `User B Income category insert failed: ${catBErr2?.message}`);

  const { data: accB, error: accBErr } = await clientB.from('accounts').insert({
    user_id: uidB,
    name: 'P4_Test_AccB_VND',
    type: 'BANK',
    currency_code: 'VND',
    opening_balance: 2000000,
    color: '#d97706',
  }).select().single();
  assert(!accBErr && accB, `User B account insert failed: ${accBErr?.message}`);

  // Fixture IDs to clean up
  const createdTxsA = [];
  const createdTxsB = [];

  try {
    // 4. User A Own Transaction Lifecycle & Derived Balance Check
    console.log("4. Testing User A own transactions & exact derived balances...");
    // A creates EXPENSE: 200,000 VND
    const { data: txA1, error: txA1Err } = await clientA.from('transactions').insert({
      user_id: uidA,
      account_id: accA.id,
      category_id: catA_Exp.id,
      type: 'EXPENSE',
      amount: '200000.0000',
      currency_code: 'VND',
      merchant: 'A_Merchant_1',
      note: 'A Expense',
      occurred_on: '2026-08-28',
    }).select().single();
    assert(!txA1Err && txA1, `User A tx1 insert failed: ${txA1Err?.message}`);
    createdTxsA.push(txA1.id);

    // Verify User A derived balance: 1,000,000 - 200,000 = 800,000.0000
    const { data: balA1, error: balA1Err } = await clientA.from('account_balances').select().eq('account_id', accA.id).single();
    assert(!balA1Err && balA1?.current_balance === '800000.0000', `Balance A1 mismatch (expected 800000.0000, got ${balA1?.current_balance})`);

    // A creates INCOME: 500,000 VND
    const { data: txA2, error: txA2Err } = await clientA.from('transactions').insert({
      user_id: uidA,
      account_id: accA.id,
      category_id: catA_Inc.id,
      type: 'INCOME',
      amount: '500000.0000',
      currency_code: 'VND',
      merchant: 'A_Income_Source',
      occurred_on: '2026-08-28',
    }).select().single();
    assert(!txA2Err && txA2, `User A tx2 insert failed: ${txA2Err?.message}`);
    createdTxsA.push(txA2.id);

    // Verify User A derived balance: 800,000 + 500,000 = 1,300,000.0000
    const { data: balA2 } = await clientA.from('account_balances').select().eq('account_id', accA.id).single();
    assert(balA2?.current_balance === '1300000.0000', `Balance A2 mismatch (expected 1300000.0000, got ${balA2?.current_balance})`);

    // A updates tx1 amount to 300,000
    const { error: upTxA1Err } = await clientA.from('transactions').update({
      amount: '300000.0000',
    }).eq('id', txA1.id);
    assert(!upTxA1Err, `User A tx1 update failed: ${upTxA1Err?.message}`);

    // Verify User A derived balance: 1,000,000 - 300,000 + 500,000 = 1,200,000.0000
    const { data: balA3 } = await clientA.from('account_balances').select().eq('account_id', accA.id).single();
    assert(balA3?.current_balance === '1200000.0000', `Balance A3 mismatch (expected 1200000.0000, got ${balA3?.current_balance})`);

    // A voids tx1
    const { error: voidA1Err } = await clientA.from('transactions').update({
      is_voided: true,
    }).eq('id', txA1.id);
    assert(!voidA1Err, `User A void tx1 failed: ${voidA1Err?.message}`);

    // Verify User A derived balance: 1,000,000 + 500,000 = 1,500,000.0000
    const { data: balA4 } = await clientA.from('account_balances').select().eq('account_id', accA.id).single();
    assert(balA4?.current_balance === '1500000.0000', `Balance A4 void mismatch (expected 1500000.0000, got ${balA4?.current_balance})`);

    // A restores tx1
    const { error: restoreA1Err } = await clientA.from('transactions').update({
      is_voided: false,
    }).eq('id', txA1.id);
    assert(!restoreA1Err, `User A restore tx1 failed: ${restoreA1Err?.message}`);

    // Verify User A derived balance: back to 1,200,000.0000
    const { data: balA5 } = await clientA.from('account_balances').select().eq('account_id', accA.id).single();
    assert(balA5?.current_balance === '1200000.0000', `Balance A5 restore mismatch (expected 1200000.0000, got ${balA5?.current_balance})`);

    // 5. User B Own Transaction Lifecycle & Balance Check
    console.log("5. Testing User B own transactions & balance...");
    const { data: txB1, error: txB1Err } = await clientB.from('transactions').insert({
      user_id: uidB,
      account_id: accB.id,
      category_id: catB_Exp.id,
      type: 'EXPENSE',
      amount: '400000.0000',
      currency_code: 'VND',
      merchant: 'B_Merchant_1',
      occurred_on: '2026-08-28',
    }).select().single();
    assert(!txB1Err && txB1, `User B tx1 insert failed: ${txB1Err?.message}`);
    createdTxsB.push(txB1.id);

    // Verify User B derived balance: 2,000,000 - 400,000 = 1,600,000.0000
    const { data: balB1 } = await clientB.from('account_balances').select().eq('account_id', accB.id).single();
    assert(balB1?.current_balance === '1600000.0000', `Balance B1 mismatch (expected 1600000.0000, got ${balB1?.current_balance})`);

    // 6. Cross-User Transaction Isolation Matrix
    console.log("6. Testing cross-user isolation barriers...");

    // B tries to SELECT A's transaction
    const { data: bReadA } = await clientB.from('transactions').select().eq('id', txA1.id);
    assert(!bReadA || bReadA.length === 0, "Security violation: User B was able to read User A transaction");

    // A tries to SELECT B's transaction
    const { data: aReadB } = await clientA.from('transactions').select().eq('id', txB1.id);
    assert(!aReadB || aReadB.length === 0, "Security violation: User A was able to read User B transaction");

    // B tries to UPDATE A's transaction
    const { error: bUpA } = await clientB.from('transactions').update({ merchant: 'HACKED_BY_B' }).eq('id', txA1.id);
    const { data: verifyA1 } = await clientA.from('transactions').select().eq('id', txA1.id).single();
    assert(verifyA1.merchant !== 'HACKED_BY_B', "Security violation: User B was able to update User A transaction");

    // A tries to UPDATE B's transaction
    const { error: aUpB } = await clientA.from('transactions').update({ merchant: 'HACKED_BY_A' }).eq('id', txB1.id);
    const { data: verifyB1 } = await clientB.from('transactions').select().eq('id', txB1.id).single();
    assert(verifyB1.merchant !== 'HACKED_BY_A', "Security violation: User A was able to update User B transaction");

    // B tries to DELETE A's transaction
    const { error: bDelA } = await clientB.from('transactions').delete().eq('id', txA1.id);
    const { data: verifyA1StillExists } = await clientA.from('transactions').select().eq('id', txA1.id);
    assert(verifyA1StillExists && verifyA1StillExists.length === 1, "Security violation: User B was able to delete User A transaction or DELETE policy allowed");

    // A tries to DELETE own transaction (should be blocked by 0 DELETE policies / privilege revoke)
    const { error: aDelA } = await clientA.from('transactions').delete().eq('id', txA1.id);
    const { data: verifyA1AfterDel } = await clientA.from('transactions').select().eq('id', txA1.id);
    assert(verifyA1AfterDel && verifyA1AfterDel.length === 1, "Security violation: DELETE operation on transactions must be rejected");

    // 7. Composite Foreign Key & Cross-User Reference Integrity
    console.log("7. Testing composite foreign key & cross-user reference boundaries...");

    // A tries to insert transaction referencing B's account
    const { data: crossAccA, error: crossAccAErr } = await clientA.from('transactions').insert({
      user_id: uidA,
      account_id: accB.id,
      category_id: catA_Exp.id,
      type: 'EXPENSE',
      amount: '50000.0000',
      currency_code: 'VND',
      merchant: 'Cross_Acc',
    }).select();
    assert(crossAccAErr, "Integrity violation: User A was able to reference User B account");

    // A tries to insert transaction referencing B's category
    const { data: crossCatA, error: crossCatAErr } = await clientA.from('transactions').insert({
      user_id: uidA,
      account_id: accA.id,
      category_id: catB_Exp.id,
      type: 'EXPENSE',
      amount: '50000.0000',
      currency_code: 'VND',
      merchant: 'Cross_Cat',
    }).select();
    assert(crossCatAErr, "Integrity violation: User A was able to reference User B category");

    // B tries to insert transaction referencing A's account
    const { data: crossAccB, error: crossAccBErr } = await clientB.from('transactions').insert({
      user_id: uidB,
      account_id: accA.id,
      category_id: catB_Exp.id,
      type: 'EXPENSE',
      amount: '50000.0000',
      currency_code: 'VND',
      merchant: 'Cross_Acc_B',
    }).select();
    assert(crossAccBErr, "Integrity violation: User B was able to reference User A account");

    // B tries to insert transaction referencing A's category
    const { data: crossCatB, error: crossCatBErr } = await clientB.from('transactions').insert({
      user_id: uidB,
      account_id: accB.id,
      category_id: catA_Exp.id,
      type: 'EXPENSE',
      amount: '50000.0000',
      currency_code: 'VND',
      merchant: 'Cross_Cat_B',
    }).select();
    assert(crossCatBErr, "Integrity violation: User B was able to reference User A category");

    // 8. Type & Currency Composite Foreign Key Protection
    console.log("8. Testing type & currency composite FK invariants...");

    // EXPENSE transaction referencing INCOME category (should fail composite FK)
    const { error: typeMismatchErr } = await clientA.from('transactions').insert({
      user_id: uidA,
      account_id: accA.id,
      category_id: catA_Inc.id,
      type: 'EXPENSE',
      amount: '50000.0000',
      currency_code: 'VND',
      merchant: 'Type_Mismatch',
    });
    assert(typeMismatchErr, "Integrity violation: EXPENSE transaction referenced INCOME category");

    // Transaction with currency USD referencing VND account (should fail composite FK)
    const { error: currMismatchErr } = await clientA.from('transactions').insert({
      user_id: uidA,
      account_id: accA.id,
      category_id: catA_Exp.id,
      type: 'EXPENSE',
      amount: '50.0000',
      currency_code: 'USD',
      merchant: 'Currency_Mismatch',
    });
    assert(currMismatchErr, "Integrity violation: USD transaction referenced VND account");

    // 9. CHECK Constraints & Column-Level Privilege Protections
    console.log("9. Testing check constraints and immutable column restrictions...");

    // Amount <= 0 rejected
    const { error: zeroAmtErr } = await clientA.from('transactions').insert({
      user_id: uidA,
      account_id: accA.id,
      category_id: catA_Exp.id,
      type: 'EXPENSE',
      amount: '0.0000',
      currency_code: 'VND',
      merchant: 'Zero_Amt',
    });
    assert(zeroAmtErr, "Constraint violation: Zero amount transaction was accepted");

    // Negative amount rejected
    const { error: negAmtErr } = await clientA.from('transactions').insert({
      user_id: uidA,
      account_id: accA.id,
      category_id: catA_Exp.id,
      type: 'EXPENSE',
      amount: '-10000.0000',
      currency_code: 'VND',
      merchant: 'Neg_Amt',
    });
    assert(negAmtErr, "Constraint violation: Negative amount transaction was accepted");

    // Attempt to mutate user_id (ownership takeover)
    const { error: userMutErr } = await clientA.from('transactions').update({
      user_id: uidB,
    }).eq('id', txA1.id);
    assert(userMutErr, "Security violation: User was able to mutate transaction user_id");

    // 10. View Isolation & Security Invoker Validation
    console.log("10. Testing view isolation and security_invoker enforcement...");
    
    // User A reads transaction_details
    const { data: viewA, error: viewAErr } = await clientA.from('transaction_details').select().eq('id', txA1.id);
    assert(!viewAErr && viewA && viewA.length === 1, `User A failed to read own transaction_details: ${viewAErr?.message}`);
    assert(typeof viewA[0].amount === 'string', "Exact read error: transaction_details.amount must be text");

    // User B reads transaction_details for A's transaction (must return 0 rows)
    const { data: viewB, error: viewBErr } = await clientB.from('transaction_details').select().eq('id', txA1.id);
    assert(!viewBErr && (!viewB || viewB.length === 0), "Security violation: User B read User A row via transaction_details view");

    // User B reads account_balances for A's account (must return 0 rows or error)
    const { data: accBalB } = await clientB.from('account_balances').select().eq('account_id', accA.id);
    assert(!accBalB || accBalB.length === 0, "Security violation: User B read User A account balance via view");

    console.log("All matrix assertions passed successfully!");
  } finally {
    // 11. Fixture Cleanup & Archiving
    console.log("11. Cleaning up test fixtures...");
    for (const txId of createdTxsA) {
      await clientA.from('transactions').update({ is_voided: true }).eq('id', txId);
    }
    for (const txId of createdTxsB) {
      await clientB.from('transactions').update({ is_voided: true }).eq('id', txId);
    }
    await clientA.from('accounts').update({ is_archived: true }).eq('id', accA.id);
    await clientA.from('categories').update({ is_archived: true }).eq('id', catA_Exp.id);
    await clientA.from('categories').update({ is_archived: true }).eq('id', catA_Inc.id);

    await clientB.from('accounts').update({ is_archived: true }).eq('id', accB.id);
    await clientB.from('categories').update({ is_archived: true }).eq('id', catB_Exp.id);
    await clientB.from('categories').update({ is_archived: true }).eq('id', catB_Inc.id);
  }

  console.log("\n========================================");
  console.log("PHASE 4 RUNTIME RLS & INTEGRITY: PASS");
  console.log("========================================\n");
  process.exit(0);
}

run().catch((err) => {
  console.error("FATAL UNEXPECTED ERROR IN VERIFIER:", err);
  process.exit(1);
});
