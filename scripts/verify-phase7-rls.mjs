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

  // 3. Schema readiness verification
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
  pass('SCHEMA_READINESS_PHASE7');

  // 4. Setup reference data for User A and User B
  console.log('Setting up reference accounts and categories...');
  // User A Account
  const { data: accA, error: accAErr } = await clientA
    .from('accounts')
    .insert({
      name: 'User A Test Account',
      type: 'BANK',
      currency_code: 'VND',
      opening_balance: '10000000.0000',
    })
    .select()
    .single();
  assert(!accAErr && accA, `User A account setup failed: ${accAErr?.message}`);

  // User A Expense Category
  const { data: catAExp, error: catAErr } = await clientA
    .from('categories')
    .insert({
      name: 'User A Food Expense',
      type: 'EXPENSE',
      icon: 'Utensils',
      color: '#ef4444',
    })
    .select()
    .single();
  assert(!catAErr && catAExp, `User A category setup failed: ${catAErr?.message}`);

  // User B Account
  const { data: accB, error: accBErr } = await clientB
    .from('accounts')
    .insert({
      name: 'User B Test Account',
      type: 'BANK',
      currency_code: 'VND',
      opening_balance: '5000000.0000',
    })
    .select()
    .single();
  assert(!accBErr && accB, `User B account setup failed: ${accBErr?.message}`);

  // User B Expense Category
  const { data: catBExp, error: catBErr } = await clientB
    .from('categories')
    .insert({
      name: 'User B Food Expense',
      type: 'EXPENSE',
      icon: 'Utensils',
      color: '#3b82f6',
    })
    .select()
    .single();
  assert(!catBErr && catBExp, `User B category setup failed: ${catBErr?.message}`);

  // 5. User A Full Budget Lifecycle
  console.log('Testing User A full budget lifecycle...');
  const testMonth = '2026-08-01';
  const { data: budgetA, error: bgtAErr } = await clientA
    .from('budgets')
    .insert({
      category_id: catAExp.id,
      category_type: 'EXPENSE',
      limit_amount: '5000000.0000',
      currency_code: 'VND',
      period_month: testMonth,
    })
    .select()
    .single();
  assert(!bgtAErr && budgetA, `User A budget creation failed: ${bgtAErr?.message}`);

  // Read budget_progress view before transactions
  const { data: bgtProgInit, error: bgtProgInitErr } = await clientA
    .from('budget_progress')
    .select('*')
    .eq('id', budgetA.id)
    .single();
  assert(!bgtProgInitErr && bgtProgInit, `User A budget_progress read failed: ${bgtProgInitErr?.message}`);
  assert(bgtProgInit.spent_amount === '0.0000', `Initial spent must be 0.0000, got ${bgtProgInit.spent_amount}`);
  assert(bgtProgInit.limit_amount === '5000000.0000', `Initial limit must match exact decimal`);

  // Create active Expense transaction in month
  const { data: txA, error: txAErr } = await clientA
    .from('transactions')
    .insert({
      account_id: accA.id,
      category_id: catAExp.id,
      type: 'EXPENSE',
      amount: '1200000.0000',
      currency_code: 'VND',
      occurred_at: '2026-08-10T12:00:00Z',
    })
    .select()
    .single();
  assert(!txAErr && txA, `User A transaction insert failed: ${txAErr?.message}`);

  // Read budget_progress view -> spent_amount must reflect exact transaction
  const { data: bgtProgAfterTx } = await clientA
    .from('budget_progress')
    .select('*')
    .eq('id', budgetA.id)
    .single();
  assert(bgtProgAfterTx?.spent_amount === '1200000.0000', `Spent amount must be 1200000.0000, got ${bgtProgAfterTx?.spent_amount}`);

  // Void transaction -> budget_progress spent reverts
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
      account_id: accA.id,
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

  // Read recurring_details view
  const { data: recViewA } = await clientA.from('recurring_details').select('*').eq('id', recA.id).single();
  assert(recViewA?.amount === '350000.0000', 'Recurring amount exact mismatch');
  assert(recViewA?.account_name === accA.name, 'Recurring account join mismatch');
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

  // 8. Cross-User Isolation (User B -> User A)
  console.log('Testing cross-user isolation: User B accessing User A resources...');

  // User B cannot select User A budget
  const { data: crossBgt } = await clientB.from('budgets').select('*').eq('id', budgetA.id);
  assert(Array.isArray(crossBgt) && crossBgt.length === 0, 'RLS VIOLATION: User B selected User A budget');

  // User B cannot select User A budget_progress view
  const { data: crossBgtView } = await clientB.from('budget_progress').select('*').eq('id', budgetA.id);
  assert(Array.isArray(crossBgtView) && crossBgtView.length === 0, 'RLS VIOLATION: User B selected User A budget_progress');

  // User B cannot update User A budget
  const { data: updateBgtAttempt } = await clientB.from('budgets').update({ limit_amount: '999.0000' }).eq('id', budgetA.id).select();
  assert(!updateBgtAttempt || updateBgtAttempt.length === 0, 'RLS VIOLATION: User B updated User A budget');

  // User B cannot select User A goal or goal_details
  const { data: crossGoal } = await clientB.from('goals').select('*').eq('id', goalA.id);
  assert(Array.isArray(crossGoal) && crossGoal.length === 0, 'RLS VIOLATION: User B selected User A goal');

  const { data: crossGoalView } = await clientB.from('goal_details').select('*').eq('id', goalA.id);
  assert(Array.isArray(crossGoalView) && crossGoalView.length === 0, 'RLS VIOLATION: User B selected User A goal_details');

  // User B cannot select User A recurring item or recurring_details
  const { data: crossRec } = await clientB.from('recurring_items').select('*').eq('id', recA.id);
  assert(Array.isArray(crossRec) && crossRec.length === 0, 'RLS VIOLATION: User B selected User A recurring item');

  const { data: crossRecView } = await clientB.from('recurring_details').select('*').eq('id', recA.id);
  assert(Array.isArray(crossRecView) && crossRecView.length === 0, 'RLS VIOLATION: User B selected User A recurring_details');

  // User B cannot spoof User A's user_id on insert
  const { error: spoofBgtErr } = await clientB.from('budgets').insert({
    user_id: userAId,
    category_id: catBExp.id,
    category_type: 'EXPENSE',
    limit_amount: '1000000.0000',
    currency_code: 'VND',
    period_month: '2026-09-01',
  });
  assert(spoofBgtErr, 'RLS VIOLATION: User B inserted budget with User A user_id without error');

  // User B cannot reference User A category in User B budget (Composite FK / RLS rejection)
  const { error: crossCatBgtErr } = await clientB.from('budgets').insert({
    category_id: catAExp.id,
    category_type: 'EXPENSE',
    limit_amount: '1000000.0000',
    currency_code: 'VND',
    period_month: '2026-09-01',
  });
  assert(crossCatBgtErr, 'FK/RLS VIOLATION: User B referenced User A category in budget');

  // User B cannot reference User A account in User B recurring item
  const { error: crossAccRecErr } = await clientB.from('recurring_items').insert({
    account_id: accA.id,
    category_id: catBExp.id,
    transaction_type: 'EXPENSE',
    name: 'Cross Account Test',
    amount: '100000.0000',
    currency_code: 'VND',
    frequency: 'MONTHLY',
    anchor_date: '2026-08-01',
  });
  assert(crossAccRecErr, 'FK/RLS VIOLATION: User B referenced User A account in recurring item');
  pass('BIDIRECTIONAL_CROSS_USER_ISOLATION');

  // 9. Domain Rejection Matrix
  console.log('Testing domain constraints & rejection matrix...');

  // Budget invalid period_month (non-first-day)
  const { error: bgtDayErr } = await clientA.from('budgets').insert({
    category_id: catAExp.id,
    category_type: 'EXPENSE',
    limit_amount: '1000000.0000',
    currency_code: 'VND',
    period_month: '2026-08-15',
  });
  assert(bgtDayErr, 'CONSTRAINT VIOLATION: Budget accepted non-first-day period_month');

  // Budget non-positive limit_amount
  const { error: bgtLimitErr } = await clientA.from('budgets').insert({
    category_id: catAExp.id,
    category_type: 'EXPENSE',
    limit_amount: '0.0000',
    currency_code: 'VND',
    period_month: '2026-09-01',
  });
  assert(bgtLimitErr, 'CONSTRAINT VIOLATION: Budget accepted 0.0000 limit');

  // Goal non-positive target_amount
  const { error: goalTgtErr } = await clientA.from('goals').insert({
    name: 'Zero Target Goal',
    target_amount: '0.0000',
    currency_code: 'VND',
  });
  assert(goalTgtErr, 'CONSTRAINT VIOLATION: Goal accepted 0.0000 target_amount');

  // Goal negative current_amount
  const { error: goalNegErr } = await clientA.from('goals').insert({
    name: 'Negative Goal',
    target_amount: '1000000.0000',
    current_amount: '-5000.0000',
    currency_code: 'VND',
  });
  assert(goalNegErr, 'CONSTRAINT VIOLATION: Goal accepted negative current_amount');

  // Recurring end_date before anchor_date
  const { error: recDateErr } = await clientA.from('recurring_items').insert({
    account_id: accA.id,
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

  // 10. Financial Neutrality
  console.log('Testing financial neutrality...');
  // Goal & recurring items must not affect account_balances
  const { data: accBalA } = await clientA.from('account_balances').select('*').eq('id', accA.id).single();
  // Account opened with 10M, 1 active expense transaction of 1.2M -> current balance = 8.8M
  assert(accBalA?.current_balance === '8800000.0000', `Account balance must be 8800000.0000, got ${accBalA?.current_balance}`);
  pass('FINANCIAL_NEUTRALITY');

  // Cleanup test resources (fail-closed)
  console.log('Cleaning up test data...');
  await clientA.from('transactions').update({ is_voided: true }).eq('id', txA.id);
  await clientA.from('budgets').update({ is_archived: true }).eq('id', budgetA.id);
  await clientA.from('goals').update({ is_archived: true }).eq('id', goalA.id);
  await clientA.from('recurring_items').update({ is_archived: true }).eq('id', recA.id);

  console.log('=======================================================');
  console.log('ALL PHASE 7 LIVE RLS RUNTIME CONTRACTS PASSED.');
  console.log('=======================================================');
}

runPhase7LiveRLSTests().catch((err) => {
  console.error('LIVE RLS TEST FAILED:', err);
  process.exit(1);
});
