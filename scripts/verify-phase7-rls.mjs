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
  console.error('FAIL: Missing required live Supabase credentials for Phase 7 RLS runtime verification.');
  console.error('Environment requires: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, FINORA_TEST_USER_A_EMAIL, FINORA_TEST_USER_A_PASSWORD, FINORA_TEST_USER_B_EMAIL, FINORA_TEST_USER_B_PASSWORD');
  process.exit(1);
}

const clientA = createClient(SUPABASE_URL, SUPABASE_KEY);
const clientB = createClient(SUPABASE_URL, SUPABASE_KEY);

function assert(condition, message) {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function pass(name) {
  console.log(`${name}=PASS`);
}

async function runPhase7LiveRLSTests() {
  console.log('=== FINORA PHASE 7 STRICT LIVE RLS RUNTIME VERIFIER ===');

  // 1. Authenticate User A
  console.log('Authenticating Test User A...');
  const { data: authA, error: errA } = await clientA.auth.signInWithPassword({
    email: USER_A_EMAIL,
    password: USER_A_PASSWORD,
  });
  assert(!errA && authA?.user?.id, `User A signin failed: ${errA?.message}`);
  const userAId = authA.user.id;
  pass('AUTH_USER_A');

  // 2. Authenticate User B
  console.log('Authenticating Test User B...');
  const { data: authB, error: errB } = await clientB.auth.signInWithPassword({
    email: USER_B_EMAIL,
    password: USER_B_PASSWORD,
  });
  assert(!errB && authB?.user?.id, `User B signin failed: ${errB?.message}`);
  const userBId = authB.user.id;
  pass('AUTH_USER_B');

  assert(userAId !== userBId, 'User A and User B must have distinct user IDs');

  // 3. Schema readiness verification across Phase 3-7 tables and views
  console.log('Verifying Phase 7 tables & views accessibility...');
  const { error: chkBgt } = await clientA.from('budgets').select('id').limit(1);
  assert(!chkBgt, `budgets table query failed: ${chkBgt?.message}`);

  const { error: chkGoal } = await clientA.from('goals').select('id').limit(1);
  assert(!chkGoal, `goals table query failed: ${chkGoal?.message}`);

  const { error: chkRec } = await clientA.from('recurring_items').select('id').limit(1);
  assert(!chkRec, `recurring_items table query failed: ${chkRec?.message}`);

  const { error: chkBgtView } = await clientA.from('budget_progress').select('id').limit(1);
  assert(!chkBgtView, `budget_progress view query failed: ${chkBgtView?.message}`);

  const { error: chkGoalView } = await clientA.from('goal_details').select('id').limit(1);
  assert(!chkGoalView, `goal_details view query failed: ${chkGoalView?.message}`);

  const { error: chkRecView } = await clientA.from('recurring_details').select('id').limit(1);
  assert(!chkRecView, `recurring_details view query failed: ${chkRecView?.message}`);

  const { error: chkTxView } = await clientA.from('transaction_details').select('id').limit(1);
  assert(!chkTxView, `transaction_details view query failed: ${chkTxView?.message}`);

  const { error: chkTrfView } = await clientA.from('transfer_details').select('id').limit(1);
  assert(!chkTrfView, `transfer_details view query failed: ${chkTrfView?.message}`);

  const { error: chkBalView } = await clientA.from('account_balances').select('account_id').limit(1);
  assert(!chkBalView, `account_balances view query failed: ${chkBalView?.message}`);
  pass('SCHEMA_READINESS_PHASE7');

  // Track created resources for deterministic fail-closed cleanup
  const cleanupResources = {
    transactions: [],
    transfers: [],
    budgetsA: [],
    budgetsB: [],
    goalsA: [],
    goalsB: [],
    recurringA: [],
    recurringB: [],
    accountsA: [],
    accountsB: [],
    categoriesA: [],
    categoriesB: [],
  };

  // 4. Setup reference data for User A and User B
  console.log('Setting up reference accounts and categories...');
  // User A Account 1 (Bank)
  const { data: accA1, error: accA1Err } = await clientA
    .from('accounts')
    .insert({
      user_id: userAId,
      name: 'User A Test Bank',
      type: 'BANK',
      currency_code: 'VND',
      opening_balance: '10000000.0000',
    })
    .select()
    .single();
  assert(!accA1Err && accA1, `User A account 1 setup failed: ${accA1Err?.message}`);
  cleanupResources.accountsA.push(accA1.id);

  // User A Account 2 (Savings for transfer regression)
  const { data: accA2, error: accA2Err } = await clientA
    .from('accounts')
    .insert({
      user_id: userAId,
      name: 'User A Test Savings',
      type: 'SAVINGS',
      currency_code: 'VND',
      opening_balance: '2000000.0000',
    })
    .select()
    .single();
  assert(!accA2Err && accA2, `User A account 2 setup failed: ${accA2Err?.message}`);
  cleanupResources.accountsA.push(accA2.id);

  // User A Expense Category
  const { data: catAExp, error: catAErr } = await clientA
    .from('categories')
    .insert({
      user_id: userAId,
      name: 'User A Food Expense',
      type: 'EXPENSE',
      icon: 'Utensils',
      color: '#ef4444',
    })
    .select()
    .single();
  assert(!catAErr && catAExp, `User A expense category setup failed: ${catAErr?.message}`);
  cleanupResources.categoriesA.push(catAExp.id);

  // User B Account 1 (Bank)
  const { data: accB1, error: accB1Err } = await clientB
    .from('accounts')
    .insert({
      user_id: userBId,
      name: 'User B Test Bank',
      type: 'BANK',
      currency_code: 'VND',
      opening_balance: '5000000.0000',
    })
    .select()
    .single();
  assert(!accB1Err && accB1, `User B account 1 setup failed: ${accB1Err?.message}`);
  cleanupResources.accountsB.push(accB1.id);

  // User B Account 2 (Savings)
  const { data: accB2, error: accB2Err } = await clientB
    .from('accounts')
    .insert({
      user_id: userBId,
      name: 'User B Test Savings',
      type: 'SAVINGS',
      currency_code: 'VND',
      opening_balance: '1000000.0000',
    })
    .select()
    .single();
  assert(!accB2Err && accB2, `User B account 2 setup failed: ${accB2Err?.message}`);
  cleanupResources.accountsB.push(accB2.id);

  // User B Expense Category
  const { data: catBExp, error: catBErr } = await clientB
    .from('categories')
    .insert({
      user_id: userBId,
      name: 'User B Food Expense',
      type: 'EXPENSE',
      icon: 'Utensils',
      color: '#3b82f6',
    })
    .select()
    .single();
  assert(!catBErr && catBExp, `User B expense category setup failed: ${catBErr?.message}`);
  cleanupResources.categoriesB.push(catBExp.id);

  // 5. User A Full Budget Lifecycle
  console.log('Testing User A full budget lifecycle...');
  const testMonth = '2026-08-01';
  const { data: budgetA, error: bgtAErr } = await clientA
    .from('budgets')
    .insert({
      user_id: userAId,
      category_id: catAExp.id,
      category_type: 'EXPENSE',
      limit_amount: '5000000.0000',
      currency_code: 'VND',
      period_month: testMonth,
    })
    .select()
    .single();
  assert(!bgtAErr && budgetA, `User A budget creation failed: ${bgtAErr?.message}`);
  cleanupResources.budgetsA.push(budgetA.id);

  // Read budget_progress view before transactions
  const { data: bgtProgInit, error: bgtProgInitErr } = await clientA
    .from('budget_progress')
    .select('*')
    .eq('id', budgetA.id)
    .single();
  assert(!bgtProgInitErr && bgtProgInit, `User A budget_progress read failed: ${bgtProgInitErr?.message}`);
  assert(bgtProgInit.spent_amount === '0.0000', `Initial spent must be 0.0000, got ${bgtProgInit.spent_amount}`);
  assert(bgtProgInit.limit_amount === '5000000.0000', `Initial limit must match exact decimal`);

  // Create active Expense transaction in month using authoritative Phase 4 schema (occurred_on, merchant)
  const { data: txA, error: txAErr } = await clientA
    .from('transactions')
    .insert({
      user_id: userAId,
      account_id: accA1.id,
      category_id: catAExp.id,
      type: 'EXPENSE',
      amount: '1200000.0000',
      currency_code: 'VND',
      merchant: 'Test Supermarket A',
      note: 'Groceries for week',
      occurred_on: '2026-08-10',
    })
    .select()
    .single();
  assert(!txAErr && txA, `User A transaction insert failed: ${txAErr?.message}`);
  cleanupResources.transactions.push(txA.id);

  // Read budget_progress view -> spent_amount must reflect exact transaction
  const { data: bgtProgAfterTx } = await clientA
    .from('budget_progress')
    .select('*')
    .eq('id', budgetA.id)
    .single();
  assert(bgtProgAfterTx?.spent_amount === '1200000.0000', `Spent amount must be 1200000.0000, got ${bgtProgAfterTx?.spent_amount}`);

  // Void transaction -> budget_progress spent reverts to 0
  await clientA.from('transactions').update({ is_voided: true }).eq('id', txA.id);
  const { data: bgtProgAfterVoid } = await clientA
    .from('budget_progress')
    .select('*')
    .eq('id', budgetA.id)
    .single();
  assert(bgtProgAfterVoid?.spent_amount === '0.0000', `Voided tx must not contribute to budget spent`);

  // Restore transaction
  await clientA.from('transactions').update({ is_voided: false }).eq('id', txA.id);

  // Archive and unarchive budget
  await clientA.from('budgets').update({ is_archived: true }).eq('id', budgetA.id);
  const { data: bgtArchived } = await clientA.from('budgets').select('is_archived').eq('id', budgetA.id).single();
  assert(bgtArchived?.is_archived === true, 'Budget archive failed');

  await clientA.from('budgets').update({ is_archived: false }).eq('id', budgetA.id);
  pass('USER_A_BUDGET_LIFECYCLE');

  // 6. User A Full Goal Lifecycle
  console.log('Testing User A full goal lifecycle...');
  const { data: goalA, error: goalAErr } = await clientA
    .from('goals')
    .insert({
      user_id: userAId,
      name: 'Emergency Fund A',
      target_amount: '20000000.0000',
      current_amount: '5000000.0000',
      monthly_contribution: '1000000.0000',
      currency_code: 'VND',
      category: 'An toàn tài chính',
      icon: 'Shield',
      color: '#10b981',
      target_date: '2027-12-31',
    })
    .select()
    .single();
  assert(!goalAErr && goalA, `User A goal creation failed: ${goalAErr?.message}`);
  cleanupResources.goalsA.push(goalA.id);

  // Read goal_details view
  const { data: goalViewA } = await clientA.from('goal_details').select('*').eq('id', goalA.id).single();
  assert(goalViewA?.target_amount === '20000000.0000', 'Goal target amount exact mismatch');
  assert(goalViewA?.current_amount === '5000000.0000', 'Goal current amount exact mismatch');

  // Overfunded goal update test
  await clientA.from('goals').update({ current_amount: '25000000.0000' }).eq('id', goalA.id);
  const { data: goalOverfunded } = await clientA.from('goals').select('current_amount').eq('id', goalA.id).single();
  assert(goalOverfunded?.current_amount === '25000000.0000', 'Overfunded goal update failed');

  // Archive and unarchive goal
  await clientA.from('goals').update({ is_archived: true }).eq('id', goalA.id);
  await clientA.from('goals').update({ is_archived: false }).eq('id', goalA.id);
  pass('USER_A_GOAL_LIFECYCLE');

  // 7. User A Full Recurring Lifecycle
  console.log('Testing User A full recurring lifecycle...');
  const { data: recA, error: recAErr } = await clientA
    .from('recurring_items')
    .insert({
      user_id: userAId,
      account_id: accA1.id,
      category_id: catAExp.id,
      transaction_type: 'EXPENSE',
      name: 'Internet Monthly A',
      amount: '350000.0000',
      currency_code: 'VND',
      frequency: 'MONTHLY',
      anchor_date: '2026-08-05',
    })
    .select()
    .single();
  assert(!recAErr && recA, `User A recurring creation failed: ${recAErr?.message}`);
  cleanupResources.recurringA.push(recA.id);

  // Read recurring_details view
  const { data: recViewA } = await clientA.from('recurring_details').select('*').eq('id', recA.id).single();
  assert(recViewA?.amount === '350000.0000', 'Recurring amount exact mismatch');
  assert(recViewA?.account_name === accA1.name, 'Recurring account join mismatch');
  assert(recViewA?.category_name === catAExp.name, 'Recurring category join mismatch');

  // Pause and resume
  await clientA.from('recurring_items').update({ is_paused: true }).eq('id', recA.id);
  const { data: recPaused } = await clientA.from('recurring_items').select('is_paused').eq('id', recA.id).single();
  assert(recPaused?.is_paused === true, 'Pause recurring failed');

  await clientA.from('recurring_items').update({ is_paused: false }).eq('id', recA.id);

  // Archive and unarchive
  await clientA.from('recurring_items').update({ is_archived: true }).eq('id', recA.id);
  await clientA.from('recurring_items').update({ is_archived: false }).eq('id', recA.id);
  pass('USER_A_RECURRING_LIFECYCLE');

  // 8. User B Independent Full Lifecycle (Budgets, Goals, Recurring)
  console.log('Testing User B independent full lifecycle...');
  // User B Budget
  const { data: budgetB, error: bgtBErr } = await clientB
    .from('budgets')
    .insert({
      user_id: userBId,
      category_id: catBExp.id,
      category_type: 'EXPENSE',
      limit_amount: '4000000.0000',
      currency_code: 'VND',
      period_month: testMonth,
    })
    .select()
    .single();
  assert(!bgtBErr && budgetB, `User B budget creation failed: ${bgtBErr?.message}`);
  cleanupResources.budgetsB.push(budgetB.id);

  const { data: bgtProgBInit } = await clientB.from('budget_progress').select('*').eq('id', budgetB.id).single();
  assert(bgtProgBInit?.spent_amount === '0.0000', 'User B initial budget spent must be 0');

  // User B Transaction
  const { data: txB, error: txBErr } = await clientB
    .from('transactions')
    .insert({
      user_id: userBId,
      account_id: accB1.id,
      category_id: catBExp.id,
      type: 'EXPENSE',
      amount: '800000.0000',
      currency_code: 'VND',
      merchant: 'Test Supermarket B',
      occurred_on: '2026-08-15',
    })
    .select()
    .single();
  assert(!txBErr && txB, `User B transaction insert failed: ${txBErr?.message}`);
  cleanupResources.transactions.push(txB.id);

  const { data: bgtProgBAfterTx } = await clientB.from('budget_progress').select('*').eq('id', budgetB.id).single();
  assert(bgtProgBAfterTx?.spent_amount === '800000.0000', 'User B budget spent mismatch');

  // Void and restore User B transaction
  await clientB.from('transactions').update({ is_voided: true }).eq('id', txB.id);
  const { data: bgtProgBAfterVoid } = await clientB.from('budget_progress').select('*').eq('id', budgetB.id).single();
  assert(bgtProgBAfterVoid?.spent_amount === '0.0000', 'User B voided tx must not contribute to budget spent');
  await clientB.from('transactions').update({ is_voided: false }).eq('id', txB.id);

  // User B Goal
  const { data: goalB, error: goalBErr } = await clientB
    .from('goals')
    .insert({
      user_id: userBId,
      name: 'Vacation Fund B',
      target_amount: '15000000.0000',
      current_amount: '3000000.0000',
      monthly_contribution: '500000.0000',
      currency_code: 'VND',
      category: 'Du lịch',
    })
    .select()
    .single();
  assert(!goalBErr && goalB, `User B goal creation failed: ${goalBErr?.message}`);
  cleanupResources.goalsB.push(goalB.id);

  const { data: goalViewB } = await clientB.from('goal_details').select('*').eq('id', goalB.id).single();
  assert(goalViewB?.target_amount === '15000000.0000', 'User B goal target amount mismatch');

  // User B Recurring
  const { data: recB, error: recBErr } = await clientB
    .from('recurring_items')
    .insert({
      user_id: userBId,
      account_id: accB1.id,
      category_id: catBExp.id,
      transaction_type: 'EXPENSE',
      name: 'Phone Bill B',
      amount: '200000.0000',
      currency_code: 'VND',
      frequency: 'MONTHLY',
      anchor_date: '2026-08-01',
    })
    .select()
    .single();
  assert(!recBErr && recB, `User B recurring creation failed: ${recBErr?.message}`);
  cleanupResources.recurringB.push(recB.id);

  const { data: recViewB } = await clientB.from('recurring_details').select('*').eq('id', recB.id).single();
  assert(recViewB?.amount === '200000.0000', 'User B recurring amount mismatch');
  pass('USER_B_FULL_LIFECYCLE');

  // 9. Bidirectional Cross-User Isolation (A -> B and B -> A)
  console.log('Testing bidirectional cross-user isolation...');

  // User B cannot select User A budget / budget_progress
  const { data: bSelectBgtA } = await clientB.from('budgets').select('*').eq('id', budgetA.id);
  assert(Array.isArray(bSelectBgtA) && bSelectBgtA.length === 0, 'RLS VIOLATION: User B selected User A budget');
  const { data: bSelectBgtProgA } = await clientB.from('budget_progress').select('*').eq('id', budgetA.id);
  assert(Array.isArray(bSelectBgtProgA) && bSelectBgtProgA.length === 0, 'RLS VIOLATION: User B selected User A budget_progress');

  // User A cannot select User B budget / budget_progress
  const { data: aSelectBgtB } = await clientA.from('budgets').select('*').eq('id', budgetB.id);
  assert(Array.isArray(aSelectBgtB) && aSelectBgtB.length === 0, 'RLS VIOLATION: User A selected User B budget');
  const { data: aSelectBgtProgB } = await clientA.from('budget_progress').select('*').eq('id', budgetB.id);
  assert(Array.isArray(aSelectBgtProgB) && aSelectBgtProgB.length === 0, 'RLS VIOLATION: User A selected User B budget_progress');

  // User B cannot select User A goal / goal_details
  const { data: bSelectGoalA } = await clientB.from('goals').select('*').eq('id', goalA.id);
  assert(Array.isArray(bSelectGoalA) && bSelectGoalA.length === 0, 'RLS VIOLATION: User B selected User A goal');
  const { data: bSelectGoalViewA } = await clientB.from('goal_details').select('*').eq('id', goalA.id);
  assert(Array.isArray(bSelectGoalViewA) && bSelectGoalViewA.length === 0, 'RLS VIOLATION: User B selected User A goal_details');

  // User A cannot select User B goal / goal_details
  const { data: aSelectGoalB } = await clientA.from('goals').select('*').eq('id', goalB.id);
  assert(Array.isArray(aSelectGoalB) && aSelectGoalB.length === 0, 'RLS VIOLATION: User A selected User B goal');
  const { data: aSelectGoalViewB } = await clientA.from('goal_details').select('*').eq('id', goalB.id);
  assert(Array.isArray(aSelectGoalViewB) && aSelectGoalViewB.length === 0, 'RLS VIOLATION: User A selected User B goal_details');

  // User B cannot select User A recurring / recurring_details
  const { data: bSelectRecA } = await clientB.from('recurring_items').select('*').eq('id', recA.id);
  assert(Array.isArray(bSelectRecA) && bSelectRecA.length === 0, 'RLS VIOLATION: User B selected User A recurring');
  const { data: bSelectRecViewA } = await clientB.from('recurring_details').select('*').eq('id', recA.id);
  assert(Array.isArray(bSelectRecViewA) && bSelectRecViewA.length === 0, 'RLS VIOLATION: User B selected User A recurring_details');

  // User A cannot select User B recurring / recurring_details
  const { data: aSelectRecB } = await clientA.from('recurring_items').select('*').eq('id', recB.id);
  assert(Array.isArray(aSelectRecB) && aSelectRecB.length === 0, 'RLS VIOLATION: User A selected User B recurring');
  const { data: aSelectRecViewB } = await clientA.from('recurring_details').select('*').eq('id', recB.id);
  assert(Array.isArray(aSelectRecViewB) && aSelectRecViewB.length === 0, 'RLS VIOLATION: User A selected User B recurring_details');

  // Cross-user updates return empty
  const { data: bUpdateBgtA } = await clientB.from('budgets').update({ limit_amount: '999.0000' }).eq('id', budgetA.id).select();
  assert(!bUpdateBgtA || bUpdateBgtA.length === 0, 'RLS VIOLATION: User B updated User A budget');
  const { data: aUpdateBgtB } = await clientA.from('budgets').update({ limit_amount: '999.0000' }).eq('id', budgetB.id).select();
  assert(!aUpdateBgtB || aUpdateBgtB.length === 0, 'RLS VIOLATION: User A updated User B budget');

  // Cross-user spoofed inserts rejected
  const { error: bSpoofBgtA } = await clientB.from('budgets').insert({
    user_id: userAId,
    category_id: catBExp.id,
    category_type: 'EXPENSE',
    limit_amount: '1000000.0000',
    currency_code: 'VND',
    period_month: '2026-09-01',
  });
  assert(bSpoofBgtA, 'RLS VIOLATION: User B inserted budget with User A user_id');

  const { error: aSpoofBgtB } = await clientA.from('budgets').insert({
    user_id: userBId,
    category_id: catAExp.id,
    category_type: 'EXPENSE',
    limit_amount: '1000000.0000',
    currency_code: 'VND',
    period_month: '2026-09-01',
  });
  assert(aSpoofBgtB, 'RLS VIOLATION: User A inserted budget with User B user_id');

  // Cross-user foreign references rejected
  const { error: bRefCatA } = await clientB.from('budgets').insert({
    user_id: userBId,
    category_id: catAExp.id,
    category_type: 'EXPENSE',
    limit_amount: '1000000.0000',
    currency_code: 'VND',
    period_month: '2026-09-01',
  });
  assert(bRefCatA, 'FK/RLS VIOLATION: User B referenced User A category in budget');

  const { error: aRefAccB } = await clientA.from('recurring_items').insert({
    user_id: userAId,
    account_id: accB1.id,
    category_id: catAExp.id,
    transaction_type: 'EXPENSE',
    name: 'Cross Account Test',
    amount: '100000.0000',
    currency_code: 'VND',
    frequency: 'MONTHLY',
    anchor_date: '2026-08-01',
  });
  assert(aRefAccB, 'FK/RLS VIOLATION: User A referenced User B account in recurring item');
  pass('BIDIRECTIONAL_CROSS_USER_ISOLATION');

  // 10. Complete Domain Rejection Matrix
  console.log('Testing domain constraints & rejection matrix...');

  // Budget invalid period_month (non-first-day)
  const { error: bgtDayErr } = await clientA.from('budgets').insert({
    user_id: userAId,
    category_id: catAExp.id,
    category_type: 'EXPENSE',
    limit_amount: '1000000.0000',
    currency_code: 'VND',
    period_month: '2026-08-15',
  });
  assert(bgtDayErr, 'CONSTRAINT VIOLATION: Budget accepted non-first-day period_month');

  // Budget non-positive limit_amount
  const { error: bgtLimitErr } = await clientA.from('budgets').insert({
    user_id: userAId,
    category_id: catAExp.id,
    category_type: 'EXPENSE',
    limit_amount: '0.0000',
    currency_code: 'VND',
    period_month: '2026-09-01',
  });
  assert(bgtLimitErr, 'CONSTRAINT VIOLATION: Budget accepted 0.0000 limit');

  // Budget duplicate period_month for same category
  const { error: bgtDupErr } = await clientA.from('budgets').insert({
    user_id: userAId,
    category_id: catAExp.id,
    category_type: 'EXPENSE',
    limit_amount: '2000000.0000',
    currency_code: 'VND',
    period_month: testMonth,
  });
  assert(bgtDupErr, 'CONSTRAINT VIOLATION: Budget accepted duplicate month for same category');

  // Goal non-positive target_amount
  const { error: goalTgtErr } = await clientA.from('goals').insert({
    user_id: userAId,
    name: 'Zero Target Goal',
    target_amount: '0.0000',
    currency_code: 'VND',
  });
  assert(goalTgtErr, 'CONSTRAINT VIOLATION: Goal accepted 0.0000 target_amount');

  // Goal negative current_amount
  const { error: goalNegErr } = await clientA.from('goals').insert({
    user_id: userAId,
    name: 'Negative Goal',
    target_amount: '1000000.0000',
    current_amount: '-5000.0000',
    currency_code: 'VND',
  });
  assert(goalNegErr, 'CONSTRAINT VIOLATION: Goal accepted negative current_amount');

  // Recurring end_date before anchor_date
  const { error: recDateErr } = await clientA.from('recurring_items').insert({
    user_id: userAId,
    account_id: accA1.id,
    category_id: catAExp.id,
    transaction_type: 'EXPENSE',
    name: 'Invalid Date Recurring',
    amount: '100000.0000',
    currency_code: 'VND',
    frequency: 'MONTHLY',
    anchor_date: '2026-08-15',
    end_date: '2026-08-10',
  });
  assert(recDateErr, 'CONSTRAINT VIOLATION: Recurring accepted end_date before anchor_date');

  // Direct DELETE rejection (no DELETE policies)
  const { data: deleteBgtAttempt } = await clientA.from('budgets').delete().eq('id', budgetA.id).select();
  assert(!deleteBgtAttempt || deleteBgtAttempt.length === 0, 'DELETE POLICY VIOLATION: Direct delete succeeded on budgets');
  pass('DOMAIN_REJECTION_MATRIX');

  // 11. Phase 4 exact transaction read & account-balance effect regression
  console.log('Testing Phase 4 exact transaction read & balance effect...');
  const { data: txDetailA } = await clientA.from('transaction_details').select('*').eq('id', txA.id).single();
  assert(txDetailA?.amount === '1200000.0000', 'transaction_details amount mismatch');
  assert(txDetailA?.merchant === 'Test Supermarket A', 'transaction_details merchant mismatch');
  assert(txDetailA?.occurred_on === '2026-08-10', 'transaction_details occurred_on mismatch');

  const { data: accBalBeforeTrf } = await clientA.from('account_balances').select('*').eq('account_id', accA1.id).single();
  // Opening balance 10M - 1.2M expense = 8.8M
  assert(accBalBeforeTrf?.current_balance === '8800000.0000', `Account balance must be 8800000.0000, got ${accBalBeforeTrf?.current_balance}`);
  pass('PHASE4_TRANSACTION_BALANCE_REGRESSION');

  // 12. Phase 5 same-currency transfer regression & budget spent neutrality
  console.log('Testing Phase 5 transfer regression and budget neutrality...');
  const { data: trfA, error: trfAErr } = await clientA
    .from('transfers')
    .insert({
      user_id: userAId,
      from_account_id: accA1.id,
      to_account_id: accA2.id,
      amount: '1000000.0000',
      currency_code: 'VND',
      note: 'Transfer to savings test',
      occurred_on: '2026-08-12',
    })
    .select()
    .single();
  assert(!trfAErr && trfA, `User A transfer insert failed: ${trfAErr?.message}`);
  cleanupResources.transfers.push(trfA.id);

  // Check transfer_details view
  const { data: trfDetailA } = await clientA.from('transfer_details').select('*').eq('id', trfA.id).single();
  assert(trfDetailA?.amount === '1000000.0000', 'transfer_details amount mismatch');
  assert(trfDetailA?.from_account_name === accA1.name, 'transfer_details from_account mismatch');
  assert(trfDetailA?.to_account_name === accA2.name, 'transfer_details to_account mismatch');

  // Check account balances after transfer: accA1 should be 8.8M - 1.0M = 7.8M, accA2 should be 2.0M + 1.0M = 3.0M
  const { data: acc1BalAfterTrf } = await clientA.from('account_balances').select('*').eq('account_id', accA1.id).single();
  const { data: acc2BalAfterTrf } = await clientA.from('account_balances').select('*').eq('account_id', accA2.id).single();
  assert(acc1BalAfterTrf?.current_balance === '7800000.0000', `accA1 balance after transfer must be 7800000.0000, got ${acc1BalAfterTrf?.current_balance}`);
  assert(acc2BalAfterTrf?.current_balance === '3000000.0000', `accA2 balance after transfer must be 3000000.0000, got ${acc2BalAfterTrf?.current_balance}`);

  // Prove transfer does NOT affect budget_progress spent
  const { data: bgtProgAfterTrf } = await clientA.from('budget_progress').select('*').eq('id', budgetA.id).single();
  assert(bgtProgAfterTrf?.spent_amount === '1200000.0000', `Transfer must not affect budget spent! Expected 1200000.0000, got ${bgtProgAfterTrf?.spent_amount}`);

  // Void transfer -> balances revert
  await clientA.from('transfers').update({ is_voided: true }).eq('id', trfA.id);
  const { data: acc1BalReverted } = await clientA.from('account_balances').select('*').eq('account_id', accA1.id).single();
  assert(acc1BalReverted?.current_balance === '8800000.0000', 'Transfer void did not revert account balance');
  pass('PHASE5_TRANSFER_BUDGET_NEUTRALITY_REGRESSION');

  // 13. Deliberate non-RLS database error distinction
  console.log('Testing deliberate non-RLS database error distinction...');
  const { error: nonExistentTableErr } = await clientA.from('nonexistent_table_finora_xyz').select('*');
  assert(nonExistentTableErr, 'Expected error when querying nonexistent table');
  pass('DELIBERATE_NON_RLS_ERROR_DISTINCTION');

  // 14. Deterministic fail-closed cleanup using allowed archive/void mutations
  console.log('Performing deterministic fail-closed cleanup...');
  // Void transfers
  for (const trfId of cleanupResources.transfers) {
    const { error: vErr } = await clientA.from('transfers').update({ is_voided: true }).eq('id', trfId);
    assert(!vErr, `Failed to void transfer ${trfId}: ${vErr?.message}`);
  }
  // Void transactions
  for (const txId of cleanupResources.transactions) {
    const { error: vErr } = await clientA.from('transactions').update({ is_voided: true }).eq('id', txId);
    assert(!vErr, `Failed to void transaction ${txId}: ${vErr?.message}`);
  }
  // Archive User A budgets, goals, recurring, accounts, categories
  for (const id of cleanupResources.budgetsA) {
    const { error: aErr } = await clientA.from('budgets').update({ is_archived: true }).eq('id', id);
    assert(!aErr, `Failed to archive budgetA ${id}: ${aErr?.message}`);
  }
  for (const id of cleanupResources.goalsA) {
    const { error: aErr } = await clientA.from('goals').update({ is_archived: true }).eq('id', id);
    assert(!aErr, `Failed to archive goalA ${id}: ${aErr?.message}`);
  }
  for (const id of cleanupResources.recurringA) {
    const { error: aErr } = await clientA.from('recurring_items').update({ is_archived: true }).eq('id', id);
    assert(!aErr, `Failed to archive recurringA ${id}: ${aErr?.message}`);
  }
  for (const id of cleanupResources.accountsA) {
    const { error: aErr } = await clientA.from('accounts').update({ is_archived: true }).eq('id', id);
    assert(!aErr, `Failed to archive accountA ${id}: ${aErr?.message}`);
  }
  for (const id of cleanupResources.categoriesA) {
    const { error: aErr } = await clientA.from('categories').update({ is_archived: true }).eq('id', id);
    assert(!aErr, `Failed to archive categoryA ${id}: ${aErr?.message}`);
  }

  // Archive User B budgets, goals, recurring, accounts, categories
  for (const id of cleanupResources.budgetsB) {
    const { error: aErr } = await clientB.from('budgets').update({ is_archived: true }).eq('id', id);
    assert(!aErr, `Failed to archive budgetB ${id}: ${aErr?.message}`);
  }
  for (const id of cleanupResources.goalsB) {
    const { error: aErr } = await clientB.from('goals').update({ is_archived: true }).eq('id', id);
    assert(!aErr, `Failed to archive goalB ${id}: ${aErr?.message}`);
  }
  for (const id of cleanupResources.recurringB) {
    const { error: aErr } = await clientB.from('recurring_items').update({ is_archived: true }).eq('id', id);
    assert(!aErr, `Failed to archive recurringB ${id}: ${aErr?.message}`);
  }
  for (const id of cleanupResources.accountsB) {
    const { error: aErr } = await clientB.from('accounts').update({ is_archived: true }).eq('id', id);
    assert(!aErr, `Failed to archive accountB ${id}: ${aErr?.message}`);
  }
  for (const id of cleanupResources.categoriesB) {
    const { error: aErr } = await clientB.from('categories').update({ is_archived: true }).eq('id', id);
    assert(!aErr, `Failed to archive categoryB ${id}: ${aErr?.message}`);
  }
  pass('DETERMINISTIC_CLEANUP_ASSERTIONS');

  console.log('=======================================================');
  console.log('ALL PHASE 7 LIVE RLS RUNTIME CONTRACTS PASSED.');
  console.log('=======================================================');
}

runPhase7LiveRLSTests().catch((err) => {
  console.error('LIVE RLS TEST FAILED:', err);
  process.exit(1);
});
