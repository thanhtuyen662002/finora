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
  console.error(
    'Environment requires: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, FINORA_TEST_USER_A_EMAIL, FINORA_TEST_USER_A_PASSWORD, FINORA_TEST_USER_B_EMAIL, FINORA_TEST_USER_B_PASSWORD'
  );
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

/**
 * Exact decimal string normalizer:
 * Accepts valid decimal strings with 0-4 fractional digits and normalizes to 4 fractional digits
 * using pure string/BigInt logic (never Number/parseFloat/float arithmetic).
 */
function normalizeExactDecimal(val) {
  if (typeof val !== 'string') {
    throw new Error(`Expected decimal string, got ${typeof val}: ${val}`);
  }
  const trimmed = val.trim();
  const regex = /^-?\d+(?:\.\d{1,4})?$/;
  if (!regex.test(trimmed)) {
    throw new Error(`Invalid exact decimal format: "${val}"`);
  }
  const isNegative = trimmed.startsWith('-');
  const raw = isNegative ? trimmed.slice(1) : trimmed;
  const [intPart, fracPart = ''] = raw.split('.');
  const cleanInt = BigInt(intPart).toString();
  const paddedFrac = fracPart.padEnd(4, '0');
  if (cleanInt === '0' && paddedFrac === '0000') {
    return '0.0000';
  }
  return `${isNegative ? '-' : ''}${cleanInt}.${paddedFrac}`;
}

/**
 * Semantic exact-money assertion helper comparing normalized exact 4-decimal strings.
 */
function assertExactMoney(actual, expected, message) {
  const normActual = normalizeExactDecimal(actual);
  const normExpected = normalizeExactDecimal(expected);
  assert(
    normActual === normExpected,
    `${message} (expected semantic money ${normExpected}, got ${normActual} [raw: "${actual}"])`
  );
}

/**
 * Recover stale legacy fixtures left by prior runs to ensure a clean test state.
 */
async function recoverStaleFixtures(client, userId, userLabel) {
  console.log(`Checking for stale legacy fixtures for ${userLabel}...`);
  // Find existing test accounts
  const { data: staleAccounts } = await client
    .from('accounts')
    .select('id, name')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .ilike('name', `${userLabel} Test%`);

  const accountIds = (staleAccounts || []).map((a) => a.id);

  // Find existing test categories
  const { data: staleCategories } = await client
    .from('categories')
    .select('id, name')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .ilike('name', `${userLabel} %`);

  const categoryIds = (staleCategories || []).map((c) => c.id);

  if (accountIds.length > 0) {
    await client
      .from('transactions')
      .update({ is_voided: true })
      .eq('user_id', userId)
      .in('account_id', accountIds)
      .eq('is_voided', false);

    await client
      .from('transfers')
      .update({ is_voided: true })
      .eq('user_id', userId)
      .in('from_account_id', accountIds)
      .eq('is_voided', false);

    await client
      .from('transfers')
      .update({ is_voided: true })
      .eq('user_id', userId)
      .in('to_account_id', accountIds)
      .eq('is_voided', false);

    await client
      .from('recurring_items')
      .update({ is_archived: true })
      .eq('user_id', userId)
      .in('account_id', accountIds)
      .eq('is_archived', false);
  }

  if (categoryIds.length > 0) {
    await client
      .from('budgets')
      .update({ is_archived: true })
      .eq('user_id', userId)
      .in('category_id', categoryIds)
      .eq('is_archived', false);
  }

  // Also archive active test goals by legacy names
  await client
    .from('goals')
    .update({ is_archived: true })
    .eq('user_id', userId)
    .ilike('name', `%Fund ${userLabel.endsWith('A') ? 'A' : 'B'}%`)
    .eq('is_archived', false);

  for (const acc of staleAccounts || []) {
    await client.from('accounts').update({ is_archived: true }).eq('id', acc.id);
  }
  for (const cat of staleCategories || []) {
    await client.from('categories').update({ is_archived: true }).eq('id', cat.id);
  }
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

  // Recover any stale fixtures from previous failed runs before creating new ones
  await recoverStaleFixtures(clientA, userAId, 'User A');
  await recoverStaleFixtures(clientB, userBId, 'User B');

  // Unique run identifier for fixture naming
  const runId = Math.random().toString(36).substring(2, 10);

  // Track created resources for deterministic fail-closed cleanup
  const cleanupResources = {
    transactionsA: [],
    transactionsB: [],
    transfersA: [],
    transfersB: [],
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

  let primaryTestError = null;

  try {
    // 4. Setup reference data for User A and User B
    console.log('Setting up reference accounts and categories with unique runId: ' + runId);
    // User A Account 1 (Bank VND)
    const { data: accA1, error: accA1Err } = await clientA
      .from('accounts')
      .insert({
        user_id: userAId,
        name: `User A Test Bank ${runId}`,
        type: 'BANK',
        currency_code: 'VND',
        opening_balance: '10000000.0000',
      })
      .select()
      .single();
    assert(!accA1Err && accA1, `User A account 1 setup failed: ${accA1Err?.message}`);
    cleanupResources.accountsA.push(accA1.id);

    // User A Account 2 (Savings VND for transfer regression)
    const { data: accA2, error: accA2Err } = await clientA
      .from('accounts')
      .insert({
        user_id: userAId,
        name: `User A Test Savings ${runId}`,
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
        name: `User A Food Expense ${runId}`,
        type: 'EXPENSE',
        icon: 'Utensils',
        color: '#ef4444',
      })
      .select()
      .single();
    assert(!catAErr && catAExp, `User A expense category setup failed: ${catAErr?.message}`);
    cleanupResources.categoriesA.push(catAExp.id);

    // User A Income Category
    const { data: catAInc, error: catAIncErr } = await clientA
      .from('categories')
      .insert({
        user_id: userAId,
        name: `User A Salary Income ${runId}`,
        type: 'INCOME',
        icon: 'Briefcase',
        color: '#10b981',
      })
      .select()
      .single();
    assert(!catAIncErr && catAInc, `User A income category setup failed: ${catAIncErr?.message}`);
    cleanupResources.categoriesA.push(catAInc.id);

    // User B Account 1 (Bank VND)
    const { data: accB1, error: accB1Err } = await clientB
      .from('accounts')
      .insert({
        user_id: userBId,
        name: `User B Test Bank ${runId}`,
        type: 'BANK',
        currency_code: 'VND',
        opening_balance: '5000000.0000',
      })
      .select()
      .single();
    assert(!accB1Err && accB1, `User B account 1 setup failed: ${accB1Err?.message}`);
    cleanupResources.accountsB.push(accB1.id);

    // User B Account 2 (Savings VND)
    const { data: accB2, error: accB2Err } = await clientB
      .from('accounts')
      .insert({
        user_id: userBId,
        name: `User B Test Savings ${runId}`,
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
        name: `User B Food Expense ${runId}`,
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
    assertExactMoney(bgtProgInit.spent_amount, '0.0000', 'Initial spent must be 0.0000');
    assertExactMoney(bgtProgInit.limit_amount, '5000000.0000', 'Initial limit must match exact decimal');

    // Edit budget limit and verify via budget_progress view
    const { data: bgtAEdited, error: bgtAEditErr } = await clientA
      .from('budgets')
      .update({ limit_amount: '6000000.0000' })
      .eq('id', budgetA.id)
      .select()
      .single();
    assert(!bgtAEditErr && bgtAEdited, 'Budget limit edit failed');
    const { data: bgtProgEdited } = await clientA
      .from('budget_progress')
      .select('*')
      .eq('id', budgetA.id)
      .single();
    assertExactMoney(bgtProgEdited?.limit_amount, '6000000.0000', 'Budget limit mismatch in budget_progress view');

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
        merchant: `Test Supermarket A ${runId}`,
        note: `Groceries for week ${runId}`,
        occurred_on: '2026-08-10',
      })
      .select()
      .single();
    assert(!txAErr && txA, `User A transaction insert failed: ${txAErr?.message}`);
    cleanupResources.transactionsA.push(txA.id);

    // Read budget_progress view -> spent_amount must reflect exact transaction
    const { data: bgtProgAfterTx } = await clientA
      .from('budget_progress')
      .select('*')
      .eq('id', budgetA.id)
      .single();
    assertExactMoney(bgtProgAfterTx?.spent_amount, '1200000.0000', 'Spent amount must reflect transaction');

    // Void transaction -> budget_progress spent reverts to 0
    await clientA.from('transactions').update({ is_voided: true }).eq('id', txA.id);
    const { data: bgtProgAfterVoid } = await clientA
      .from('budget_progress')
      .select('*')
      .eq('id', budgetA.id)
      .single();
    assertExactMoney(bgtProgAfterVoid?.spent_amount, '0.0000', 'Voided tx must not contribute to budget spent');

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
        name: `Emergency Fund A ${runId}`,
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
    assertExactMoney(goalViewA?.target_amount, '20000000.0000', 'Goal target amount exact mismatch');
    assertExactMoney(goalViewA?.current_amount, '5000000.0000', 'Goal current amount exact mismatch');

    // Edit goal fields and verify money update through goal_details view
    const { data: goalEdited, error: goalEditErr } = await clientA
      .from('goals')
      .update({ name: `Emergency Fund A Renamed ${runId}`, monthly_contribution: '1500000.0000' })
      .eq('id', goalA.id)
      .select()
      .single();
    assert(!goalEditErr && goalEdited?.name === `Emergency Fund A Renamed ${runId}`, 'Goal name update failed');
    const { data: goalViewEdited } = await clientA.from('goal_details').select('*').eq('id', goalA.id).single();
    assertExactMoney(goalViewEdited?.monthly_contribution, '1500000.0000', 'Goal monthly contribution update view mismatch');

    // Overfunded goal update test (current_amount > target_amount allowed)
    const { error: goalOverfundErr } = await clientA
      .from('goals')
      .update({ current_amount: '25000000.0000' })
      .eq('id', goalA.id);
    assert(!goalOverfundErr, 'Overfunded goal update failed');
    const { data: goalViewOverfunded } = await clientA.from('goal_details').select('*').eq('id', goalA.id).single();
    assertExactMoney(goalViewOverfunded?.current_amount, '25000000.0000', 'Overfunded goal view mismatch');

    // Archive and unarchive goal
    await clientA.from('goals').update({ is_archived: true }).eq('id', goalA.id);
    const { data: goalArchived } = await clientA.from('goals').select('is_archived').eq('id', goalA.id).single();
    assert(goalArchived?.is_archived === true, 'Goal archive failed');

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
        name: `Internet Monthly A ${runId}`,
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
    assertExactMoney(recViewA?.amount, '350000.0000', 'Recurring amount exact mismatch');
    assert(recViewA?.account_name === accA1.name, 'Recurring account join mismatch');
    assert(recViewA?.category_name === catAExp.name, 'Recurring category join mismatch');

    // Edit recurring item and verify money update via recurring_details view
    const { data: recEdited, error: recEditErr } = await clientA
      .from('recurring_items')
      .update({ amount: '380000.0000', name: `Fiber Internet A ${runId}` })
      .eq('id', recA.id)
      .select()
      .single();
    assert(!recEditErr && recEdited?.name === `Fiber Internet A ${runId}`, 'Recurring edit failed');
    const { data: recViewEdited } = await clientA.from('recurring_details').select('*').eq('id', recA.id).single();
    assertExactMoney(recViewEdited?.amount, '380000.0000', 'Recurring amount view mismatch');

    // Pause and resume
    await clientA.from('recurring_items').update({ is_paused: true }).eq('id', recA.id);
    const { data: recPaused } = await clientA.from('recurring_items').select('is_paused').eq('id', recA.id).single();
    assert(recPaused?.is_paused === true, 'Pause recurring failed');

    await clientA.from('recurring_items').update({ is_paused: false }).eq('id', recA.id);

    // Archive and unarchive
    await clientA.from('recurring_items').update({ is_archived: true }).eq('id', recA.id);
    const { data: recArchived } = await clientA.from('recurring_items').select('is_archived').eq('id', recA.id).single();
    assert(recArchived?.is_archived === true, 'Archive recurring failed');

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

    // User B exact budget read
    const { data: bgtProgBInit } = await clientB.from('budget_progress').select('*').eq('id', budgetB.id).single();
    assertExactMoney(bgtProgBInit?.spent_amount, '0.0000', 'User B initial budget spent must be 0');
    assertExactMoney(bgtProgBInit?.limit_amount, '4000000.0000', 'User B initial budget limit mismatch');

    // User B edit budget limit and verify via budget_progress view
    const { data: bgtBEdited, error: bgtBEditErr } = await clientB
      .from('budgets')
      .update({ limit_amount: '4500000.0000' })
      .eq('id', budgetB.id)
      .select()
      .single();
    assert(!bgtBEditErr && bgtBEdited, 'User B budget limit update failed');
    const { data: bgtProgBEdited } = await clientB.from('budget_progress').select('*').eq('id', budgetB.id).single();
    assertExactMoney(bgtProgBEdited?.limit_amount, '4500000.0000', 'User B budget limit mismatch in budget_progress view');

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
        merchant: `Test Supermarket B ${runId}`,
        occurred_on: '2026-08-15',
      })
      .select()
      .single();
    assert(!txBErr && txB, `User B transaction insert failed: ${txBErr?.message}`);
    cleanupResources.transactionsB.push(txB.id);

    const { data: bgtProgBAfterTx } = await clientB.from('budget_progress').select('*').eq('id', budgetB.id).single();
    assertExactMoney(bgtProgBAfterTx?.spent_amount, '800000.0000', 'User B budget spent mismatch');

    // Void and restore User B transaction
    await clientB.from('transactions').update({ is_voided: true }).eq('id', txB.id);
    const { data: bgtProgBAfterVoid } = await clientB.from('budget_progress').select('*').eq('id', budgetB.id).single();
    assertExactMoney(bgtProgBAfterVoid?.spent_amount, '0.0000', 'User B voided tx must not contribute to budget spent');
    await clientB.from('transactions').update({ is_voided: false }).eq('id', txB.id);

    // User B archive and unarchive budget
    await clientB.from('budgets').update({ is_archived: true }).eq('id', budgetB.id);
    const { data: bgtBArchived } = await clientB.from('budgets').select('is_archived').eq('id', budgetB.id).single();
    assert(bgtBArchived?.is_archived === true, 'User B budget archive failed');
    await clientB.from('budgets').update({ is_archived: false }).eq('id', budgetB.id);

    // User B Goal
    const { data: goalB, error: goalBErr } = await clientB
      .from('goals')
      .insert({
        user_id: userBId,
        name: `Vacation Fund B ${runId}`,
        target_amount: '15000000.0000',
        current_amount: '3000000.0000',
        monthly_contribution: '500000.0000',
        currency_code: 'VND',
        category: 'Du lịch',
        icon: 'Plane',
        color: '#3b82f6',
        target_date: '2027-06-30',
      })
      .select()
      .single();
    assert(!goalBErr && goalB, `User B goal creation failed: ${goalBErr?.message}`);
    cleanupResources.goalsB.push(goalB.id);

    // User B exact goal read
    const { data: goalViewB } = await clientB.from('goal_details').select('*').eq('id', goalB.id).single();
    assertExactMoney(goalViewB?.target_amount, '15000000.0000', 'User B goal target amount mismatch');

    // User B edit goal and verify via goal_details view
    const { data: goalBEdited, error: goalBEditErr } = await clientB
      .from('goals')
      .update({ name: `Vacation Fund B Updated ${runId}`, monthly_contribution: '750000.0000' })
      .eq('id', goalB.id)
      .select()
      .single();
    assert(!goalBEditErr && goalBEdited?.name === `Vacation Fund B Updated ${runId}`, 'User B goal edit failed');
    const { data: goalViewBEdited } = await clientB.from('goal_details').select('*').eq('id', goalB.id).single();
    assertExactMoney(goalViewBEdited?.monthly_contribution, '750000.0000', 'User B goal monthly contrib mismatch in goal_details');

    // User B overfunded goal update
    const { error: goalBOverfundErr } = await clientB
      .from('goals')
      .update({ current_amount: '20000000.0000' })
      .eq('id', goalB.id);
    assert(!goalBOverfundErr, 'User B overfunded goal failed');
    const { data: goalViewBOverfunded } = await clientB.from('goal_details').select('*').eq('id', goalB.id).single();
    assertExactMoney(goalViewBOverfunded?.current_amount, '20000000.0000', 'User B overfunded goal mismatch in goal_details');

    // User B archive and unarchive goal
    await clientB.from('goals').update({ is_archived: true }).eq('id', goalB.id);
    const { data: goalBArchived } = await clientB.from('goals').select('is_archived').eq('id', goalB.id).single();
    assert(goalBArchived?.is_archived === true, 'User B goal archive failed');
    await clientB.from('goals').update({ is_archived: false }).eq('id', goalB.id);

    // User B Recurring
    const { data: recB, error: recBErr } = await clientB
      .from('recurring_items')
      .insert({
        user_id: userBId,
        account_id: accB1.id,
        category_id: catBExp.id,
        transaction_type: 'EXPENSE',
        name: `Phone Bill B ${runId}`,
        amount: '200000.0000',
        currency_code: 'VND',
        frequency: 'MONTHLY',
        anchor_date: '2026-08-01',
      })
      .select()
      .single();
    assert(!recBErr && recB, `User B recurring creation failed: ${recBErr?.message}`);
    cleanupResources.recurringB.push(recB.id);

    // User B exact recurring read
    const { data: recViewB } = await clientB.from('recurring_details').select('*').eq('id', recB.id).single();
    assertExactMoney(recViewB?.amount, '200000.0000', 'User B recurring amount mismatch');

    // User B edit recurring and verify via recurring_details view
    const { data: recBEdited, error: recBEditErr } = await clientB
      .from('recurring_items')
      .update({ amount: '220000.0000', name: `Phone Bill B 5G ${runId}` })
      .eq('id', recB.id)
      .select()
      .single();
    assert(!recBEditErr && recBEdited?.name === `Phone Bill B 5G ${runId}`, 'User B recurring edit failed');
    const { data: recViewBEdited } = await clientB.from('recurring_details').select('*').eq('id', recB.id).single();
    assertExactMoney(recViewBEdited?.amount, '220000.0000', 'User B recurring amount mismatch in recurring_details');

    // User B pause and resume
    await clientB.from('recurring_items').update({ is_paused: true }).eq('id', recB.id);
    const { data: recBPaused } = await clientB.from('recurring_items').select('is_paused').eq('id', recB.id).single();
    assert(recBPaused?.is_paused === true, 'User B recurring pause failed');
    await clientB.from('recurring_items').update({ is_paused: false }).eq('id', recB.id);

    // User B archive and unarchive
    await clientB.from('recurring_items').update({ is_archived: true }).eq('id', recB.id);
    const { data: recBArchived } = await clientB.from('recurring_items').select('is_archived').eq('id', recB.id).single();
    assert(recBArchived?.is_archived === true, 'User B recurring archive failed');
    await clientB.from('recurring_items').update({ is_archived: false }).eq('id', recB.id);

    pass('USER_B_FULL_LIFECYCLE');

    // 9. Bidirectional Cross-User Isolation (A -> B and B -> A across Budgets, Goals, Recurring)
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

    // Cross-user updates return empty (Budgets, Goals, Recurring)
    const { data: bUpdateBgtA } = await clientB.from('budgets').update({ limit_amount: '999.0000' }).eq('id', budgetA.id).select();
    assert(!bUpdateBgtA || bUpdateBgtA.length === 0, 'RLS VIOLATION: User B updated User A budget');
    const { data: aUpdateBgtB } = await clientA.from('budgets').update({ limit_amount: '999.0000' }).eq('id', budgetB.id).select();
    assert(!aUpdateBgtB || aUpdateBgtB.length === 0, 'RLS VIOLATION: User A updated User B budget');

    const { data: bUpdateGoalA } = await clientB.from('goals').update({ target_amount: '999.0000' }).eq('id', goalA.id).select();
    assert(!bUpdateGoalA || bUpdateGoalA.length === 0, 'RLS VIOLATION: User B updated User A goal');
    const { data: aUpdateGoalB } = await clientA.from('goals').update({ target_amount: '999.0000' }).eq('id', goalB.id).select();
    assert(!aUpdateGoalB || aUpdateGoalB.length === 0, 'RLS VIOLATION: User A updated User B goal');

    const { data: bUpdateRecA } = await clientB.from('recurring_items').update({ amount: '999.0000' }).eq('id', recA.id).select();
    assert(!bUpdateRecA || bUpdateRecA.length === 0, 'RLS VIOLATION: User B updated User A recurring');
    const { data: aUpdateRecB } = await clientA.from('recurring_items').update({ amount: '999.0000' }).eq('id', recB.id).select();
    assert(!aUpdateRecB || aUpdateRecB.length === 0, 'RLS VIOLATION: User A updated User B recurring');

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

    const { error: bSpoofGoalA } = await clientB.from('goals').insert({
      user_id: userAId,
      name: `Spoofed Goal ${runId}`,
      target_amount: '1000000.0000',
      currency_code: 'VND',
    });
    assert(bSpoofGoalA, 'RLS VIOLATION: User B inserted goal with User A user_id');

    const { error: aSpoofGoalB } = await clientA.from('goals').insert({
      user_id: userBId,
      name: `Spoofed Goal B ${runId}`,
      target_amount: '1000000.0000',
      currency_code: 'VND',
    });
    assert(aSpoofGoalB, 'RLS VIOLATION: User A inserted goal with User B user_id');

    const { error: bSpoofRecA } = await clientB.from('recurring_items').insert({
      user_id: userAId,
      account_id: accB1.id,
      category_id: catBExp.id,
      transaction_type: 'EXPENSE',
      name: `Spoofed Recurring ${runId}`,
      amount: '100000.0000',
      currency_code: 'VND',
      frequency: 'MONTHLY',
      anchor_date: '2026-08-01',
    });
    assert(bSpoofRecA, 'RLS VIOLATION: User B inserted recurring with User A user_id');

    const { error: aSpoofRecB } = await clientA.from('recurring_items').insert({
      user_id: userBId,
      account_id: accA1.id,
      category_id: catAExp.id,
      transaction_type: 'EXPENSE',
      name: `Spoofed Recurring B ${runId}`,
      amount: '100000.0000',
      currency_code: 'VND',
      frequency: 'MONTHLY',
      anchor_date: '2026-08-01',
    });
    assert(aSpoofRecB, 'RLS VIOLATION: User A inserted recurring with User B user_id');

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

    const { error: aRefCatB } = await clientA.from('budgets').insert({
      user_id: userAId,
      category_id: catBExp.id,
      category_type: 'EXPENSE',
      limit_amount: '1000000.0000',
      currency_code: 'VND',
      period_month: '2026-09-01',
    });
    assert(aRefCatB, 'FK/RLS VIOLATION: User A referenced User B category in budget');

    const { error: bRefAccA } = await clientB.from('recurring_items').insert({
      user_id: userBId,
      account_id: accA1.id,
      category_id: catBExp.id,
      transaction_type: 'EXPENSE',
      name: `Cross Account Test B ${runId}`,
      amount: '100000.0000',
      currency_code: 'VND',
      frequency: 'MONTHLY',
      anchor_date: '2026-08-01',
    });
    assert(bRefAccA, 'FK/RLS VIOLATION: User B referenced User A account in recurring item');

    const { error: aRefAccB } = await clientA.from('recurring_items').insert({
      user_id: userAId,
      account_id: accB1.id,
      category_id: catAExp.id,
      transaction_type: 'EXPENSE',
      name: `Cross Account Test A ${runId}`,
      amount: '100000.0000',
      currency_code: 'VND',
      frequency: 'MONTHLY',
      anchor_date: '2026-08-01',
    });
    assert(aRefAccB, 'FK/RLS VIOLATION: User A referenced User B account in recurring item');

    const { error: bRefRecCatA } = await clientB.from('recurring_items').insert({
      user_id: userBId,
      account_id: accB1.id,
      category_id: catAExp.id,
      transaction_type: 'EXPENSE',
      name: `Cross Category Test B ${runId}`,
      amount: '100000.0000',
      currency_code: 'VND',
      frequency: 'MONTHLY',
      anchor_date: '2026-08-01',
    });
    assert(bRefRecCatA, 'FK/RLS VIOLATION: User B referenced User A category in recurring item');

    pass('BIDIRECTIONAL_CROSS_USER_ISOLATION');

    // 10. Complete Domain Rejection Matrix
    console.log('Testing domain constraints & rejection matrix...');

    // Budgets: zero limit
    const { error: bgtZeroErr } = await clientA.from('budgets').insert({
      user_id: userAId,
      category_id: catAExp.id,
      category_type: 'EXPENSE',
      limit_amount: '0.0000',
      currency_code: 'VND',
      period_month: '2026-09-01',
    });
    assert(bgtZeroErr, 'CONSTRAINT VIOLATION: Budget accepted 0.0000 limit');

    // Budgets: negative limit
    const { error: bgtNegErr } = await clientA.from('budgets').insert({
      user_id: userAId,
      category_id: catAExp.id,
      category_type: 'EXPENSE',
      limit_amount: '-1000.0000',
      currency_code: 'VND',
      period_month: '2026-09-01',
    });
    assert(bgtNegErr, 'CONSTRAINT VIOLATION: Budget accepted negative limit');

    // Budgets: non-EXPENSE category type
    const { error: bgtTypeErr } = await clientA.from('budgets').insert({
      user_id: userAId,
      category_id: catAInc.id,
      category_type: 'INCOME',
      limit_amount: '1000000.0000',
      currency_code: 'VND',
      period_month: '2026-09-01',
    });
    assert(bgtTypeErr, 'CONSTRAINT VIOLATION: Budget accepted INCOME category');

    // Budgets: invalid/lowercase currency
    const { error: bgtCurrErr } = await clientA.from('budgets').insert({
      user_id: userAId,
      category_id: catAExp.id,
      category_type: 'EXPENSE',
      limit_amount: '1000000.0000',
      currency_code: 'vnd',
      period_month: '2026-09-01',
    });
    assert(bgtCurrErr, 'CONSTRAINT VIOLATION: Budget accepted lowercase currency');

    // Budgets: non-first-day period_month
    const { error: bgtDayErr } = await clientA.from('budgets').insert({
      user_id: userAId,
      category_id: catAExp.id,
      category_type: 'EXPENSE',
      limit_amount: '1000000.0000',
      currency_code: 'VND',
      period_month: '2026-08-15',
    });
    assert(bgtDayErr, 'CONSTRAINT VIOLATION: Budget accepted non-first-day period_month');

    // Budgets: duplicate (user, category, currency, month)
    const { error: bgtDupErr } = await clientA.from('budgets').insert({
      user_id: userAId,
      category_id: catAExp.id,
      category_type: 'EXPENSE',
      limit_amount: '2000000.0000',
      currency_code: 'VND',
      period_month: testMonth,
    });
    assert(bgtDupErr, 'CONSTRAINT VIOLATION: Budget accepted duplicate month for same category');

    // Goals: zero target
    const { error: goalTgtZeroErr } = await clientA.from('goals').insert({
      user_id: userAId,
      name: `Zero Target Goal ${runId}`,
      target_amount: '0.0000',
      currency_code: 'VND',
    });
    assert(goalTgtZeroErr, 'CONSTRAINT VIOLATION: Goal accepted 0.0000 target_amount');

    // Goals: negative target
    const { error: goalTgtNegErr } = await clientA.from('goals').insert({
      user_id: userAId,
      name: `Negative Target Goal ${runId}`,
      target_amount: '-5000.0000',
      currency_code: 'VND',
    });
    assert(goalTgtNegErr, 'CONSTRAINT VIOLATION: Goal accepted negative target_amount');

    // Goals: negative current amount
    const { error: goalNegCurrErr } = await clientA.from('goals').insert({
      user_id: userAId,
      name: `Negative Current Goal ${runId}`,
      target_amount: '1000000.0000',
      current_amount: '-500.0000',
      currency_code: 'VND',
    });
    assert(goalNegCurrErr, 'CONSTRAINT VIOLATION: Goal accepted negative current_amount');

    // Goals: negative monthly contribution
    const { error: goalNegContribErr } = await clientA.from('goals').insert({
      user_id: userAId,
      name: `Negative Contrib Goal ${runId}`,
      target_amount: '1000000.0000',
      monthly_contribution: '-100.0000',
      currency_code: 'VND',
    });
    assert(goalNegContribErr, 'CONSTRAINT VIOLATION: Goal accepted negative monthly_contribution');

    // Goals: invalid/lowercase currency
    const { error: goalCurrErr } = await clientA.from('goals').insert({
      user_id: userAId,
      name: `Lowercase Currency Goal ${runId}`,
      target_amount: '1000000.0000',
      currency_code: 'usd',
    });
    assert(goalCurrErr, 'CONSTRAINT VIOLATION: Goal accepted lowercase currency');

    // Goals: blank name
    const { error: goalBlankNameErr } = await clientA.from('goals').insert({
      user_id: userAId,
      name: '   ',
      target_amount: '1000000.0000',
      currency_code: 'VND',
    });
    assert(goalBlankNameErr, 'CONSTRAINT VIOLATION: Goal accepted blank name');

    // Recurring: zero amount
    const { error: recZeroAmtErr } = await clientA.from('recurring_items').insert({
      user_id: userAId,
      account_id: accA1.id,
      category_id: catAExp.id,
      transaction_type: 'EXPENSE',
      name: `Zero Amount Recurring ${runId}`,
      amount: '0.0000',
      currency_code: 'VND',
      frequency: 'MONTHLY',
      anchor_date: '2026-08-01',
    });
    assert(recZeroAmtErr, 'CONSTRAINT VIOLATION: Recurring accepted 0.0000 amount');

    // Recurring: negative amount
    const { error: recNegAmtErr } = await clientA.from('recurring_items').insert({
      user_id: userAId,
      account_id: accA1.id,
      category_id: catAExp.id,
      transaction_type: 'EXPENSE',
      name: `Negative Amount Recurring ${runId}`,
      amount: '-200.0000',
      currency_code: 'VND',
      frequency: 'MONTHLY',
      anchor_date: '2026-08-01',
    });
    assert(recNegAmtErr, 'CONSTRAINT VIOLATION: Recurring accepted negative amount');

    // Recurring: invalid transaction type
    const { error: recBadTypeErr } = await clientA.from('recurring_items').insert({
      user_id: userAId,
      account_id: accA1.id,
      category_id: catAExp.id,
      transaction_type: 'TRANSFER',
      name: `Invalid Type Recurring ${runId}`,
      amount: '100000.0000',
      currency_code: 'VND',
      frequency: 'MONTHLY',
      anchor_date: '2026-08-01',
    });
    assert(recBadTypeErr, 'CONSTRAINT VIOLATION: Recurring accepted TRANSFER type');

    // Recurring: invalid frequency
    const { error: recBadFreqErr } = await clientA.from('recurring_items').insert({
      user_id: userAId,
      account_id: accA1.id,
      category_id: catAExp.id,
      transaction_type: 'EXPENSE',
      name: `Invalid Freq Recurring ${runId}`,
      amount: '100000.0000',
      currency_code: 'VND',
      frequency: 'DAILY',
      anchor_date: '2026-08-01',
    });
    assert(recBadFreqErr, 'CONSTRAINT VIOLATION: Recurring accepted DAILY frequency');

    // Recurring: invalid currency code
    const { error: recBadCurrErr } = await clientA.from('recurring_items').insert({
      user_id: userAId,
      account_id: accA1.id,
      category_id: catAExp.id,
      transaction_type: 'EXPENSE',
      name: `Invalid Curr Recurring ${runId}`,
      amount: '100000.0000',
      currency_code: 'vnd',
      frequency: 'MONTHLY',
      anchor_date: '2026-08-01',
    });
    assert(recBadCurrErr, 'CONSTRAINT VIOLATION: Recurring accepted lowercase currency');

    // Recurring: blank name
    const { error: recBlankNameErr } = await clientA.from('recurring_items').insert({
      user_id: userAId,
      account_id: accA1.id,
      category_id: catAExp.id,
      transaction_type: 'EXPENSE',
      name: '  ',
      amount: '100000.0000',
      currency_code: 'VND',
      frequency: 'MONTHLY',
      anchor_date: '2026-08-01',
    });
    assert(recBlankNameErr, 'CONSTRAINT VIOLATION: Recurring accepted blank name');

    // Recurring: end_date before anchor_date
    const { error: recDateErr } = await clientA.from('recurring_items').insert({
      user_id: userAId,
      account_id: accA1.id,
      category_id: catAExp.id,
      transaction_type: 'EXPENSE',
      name: `Invalid Date Recurring ${runId}`,
      amount: '100000.0000',
      currency_code: 'VND',
      frequency: 'MONTHLY',
      anchor_date: '2026-08-15',
      end_date: '2026-08-10',
    });
    assert(recDateErr, 'CONSTRAINT VIOLATION: Recurring accepted end_date before anchor_date');

    // Direct DELETE rejection across budgets, goals, recurring_items
    const { data: deleteBgtAttempt } = await clientA.from('budgets').delete().eq('id', budgetA.id).select();
    assert(!deleteBgtAttempt || deleteBgtAttempt.length === 0, 'DELETE POLICY VIOLATION: Direct delete succeeded on budgets');

    const { data: deleteGoalAttempt } = await clientA.from('goals').delete().eq('id', goalA.id).select();
    assert(!deleteGoalAttempt || deleteGoalAttempt.length === 0, 'DELETE POLICY VIOLATION: Direct delete succeeded on goals');

    const { data: deleteRecAttempt } = await clientA.from('recurring_items').delete().eq('id', recA.id).select();
    assert(!deleteRecAttempt || deleteRecAttempt.length === 0, 'DELETE POLICY VIOLATION: Direct delete succeeded on recurring_items');

    pass('DOMAIN_REJECTION_MATRIX');

    // 11. Phase 4 exact transaction read & account-balance effect regression
    console.log('Testing Phase 4 exact transaction read & balance effect...');
    const { data: txDetailA } = await clientA.from('transaction_details').select('*').eq('id', txA.id).single();
    assertExactMoney(txDetailA?.amount, '1200000.0000', 'transaction_details amount mismatch');
    assert(txDetailA?.merchant === `Test Supermarket A ${runId}`, 'transaction_details merchant mismatch');
    assert(txDetailA?.occurred_on === '2026-08-10', 'transaction_details occurred_on mismatch');

    const { data: accBalBeforeTrf } = await clientA.from('account_balances').select('*').eq('account_id', accA1.id).single();
    // Opening balance 10M - 1.2M expense = 8.8M
    assertExactMoney(accBalBeforeTrf?.current_balance, '8800000.0000', 'Account balance must be 8800000.0000');
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
        note: `Transfer to savings test ${runId}`,
        occurred_on: '2026-08-12',
      })
      .select()
      .single();
    assert(!trfAErr && trfA, `User A transfer insert failed: ${trfAErr?.message}`);
    cleanupResources.transfersA.push(trfA.id);

    // Check transfer_details view
    const { data: trfDetailA } = await clientA.from('transfer_details').select('*').eq('id', trfA.id).single();
    assertExactMoney(trfDetailA?.amount, '1000000.0000', 'transfer_details amount mismatch');
    assert(trfDetailA?.from_account_name === accA1.name, 'transfer_details from_account mismatch');
    assert(trfDetailA?.to_account_name === accA2.name, 'transfer_details to_account mismatch');

    // Check account balances after transfer: accA1 should be 8.8M - 1.0M = 7.8M, accA2 should be 2.0M + 1.0M = 3.0M
    const { data: acc1BalAfterTrf } = await clientA.from('account_balances').select('*').eq('account_id', accA1.id).single();
    const { data: acc2BalAfterTrf } = await clientA.from('account_balances').select('*').eq('account_id', accA2.id).single();
    assertExactMoney(acc1BalAfterTrf?.current_balance, '7800000.0000', 'accA1 balance after transfer mismatch');
    assertExactMoney(acc2BalAfterTrf?.current_balance, '3000000.0000', 'accA2 balance after transfer mismatch');

    // Prove transfer does NOT affect budget_progress spent
    const { data: bgtProgAfterTrf } = await clientA.from('budget_progress').select('*').eq('id', budgetA.id).single();
    assertExactMoney(bgtProgAfterTrf?.spent_amount, '1200000.0000', 'Transfer must not affect budget spent');

    // Void transfer -> balances revert
    await clientA.from('transfers').update({ is_voided: true }).eq('id', trfA.id);
    const { data: acc1BalReverted } = await clientA.from('account_balances').select('*').eq('account_id', accA1.id).single();
    assertExactMoney(acc1BalReverted?.current_balance, '8800000.0000', 'Transfer void did not revert account balance');
    pass('PHASE5_TRANSFER_BUDGET_NEUTRALITY_REGRESSION');

    // 13. Deliberate non-RLS database error distinction
    console.log('Testing deliberate non-RLS database error distinction...');
    const { error: nonExistentTableErr } = await clientA.from('nonexistent_table_finora_xyz').select('*');
    assert(nonExistentTableErr, 'Expected error when querying nonexistent table');
    pass('DELIBERATE_NON_RLS_ERROR_DISTINCTION');
  } catch (err) {
    primaryTestError = err;
  } finally {
    // 14. Deterministic fail-closed cleanup executed in both PASS and FAIL paths
    console.log('Performing deterministic fail-closed cleanup with ownership assertions...');
    let cleanupError = null;
    try {
      // Void User A transfers
      for (const trfId of cleanupResources.transfersA) {
        const { data, error: vErr } = await clientA.from('transfers').update({ is_voided: true }).eq('id', trfId).select();
        assert(!vErr && data?.length === 1 && data[0].is_voided === true, `Failed to void transferA ${trfId}`);
        const { data: readback } = await clientA.from('transfers').select('is_voided').eq('id', trfId).single();
        assert(readback?.is_voided === true, `TransferA ${trfId} readback void assertion failed`);
      }
      // Void User B transfers
      for (const trfId of cleanupResources.transfersB) {
        const { data, error: vErr } = await clientB.from('transfers').update({ is_voided: true }).eq('id', trfId).select();
        assert(!vErr && data?.length === 1 && data[0].is_voided === true, `Failed to void transferB ${trfId}`);
        const { data: readback } = await clientB.from('transfers').select('is_voided').eq('id', trfId).single();
        assert(readback?.is_voided === true, `TransferB ${trfId} readback void assertion failed`);
      }

      // Void User A transactions
      for (const txId of cleanupResources.transactionsA) {
        const { data, error: vErr } = await clientA.from('transactions').update({ is_voided: true }).eq('id', txId).select();
        assert(!vErr && data?.length === 1 && data[0].is_voided === true, `Failed to void transactionA ${txId}`);
        const { data: readback } = await clientA.from('transactions').select('is_voided').eq('id', txId).single();
        assert(readback?.is_voided === true, `TransactionA ${txId} readback void assertion failed`);
      }
      // Void User B transactions
      for (const txId of cleanupResources.transactionsB) {
        const { data, error: vErr } = await clientB.from('transactions').update({ is_voided: true }).eq('id', txId).select();
        assert(!vErr && data?.length === 1 && data[0].is_voided === true, `Failed to void transactionB ${txId}`);
        const { data: readback } = await clientB.from('transactions').select('is_voided').eq('id', txId).single();
        assert(readback?.is_voided === true, `TransactionB ${txId} readback void assertion failed`);
      }

      // Archive User A budgets, goals, recurring, accounts, categories
      for (const id of cleanupResources.budgetsA) {
        const { data, error: aErr } = await clientA.from('budgets').update({ is_archived: true }).eq('id', id).select();
        assert(!aErr && data?.length === 1 && data[0].is_archived === true, `Failed to archive budgetA ${id}`);
        const { data: rb } = await clientA.from('budgets').select('is_archived').eq('id', id).single();
        assert(rb?.is_archived === true, `BudgetA ${id} readback archive assertion failed`);
      }
      for (const id of cleanupResources.goalsA) {
        const { data, error: aErr } = await clientA.from('goals').update({ is_archived: true }).eq('id', id).select();
        assert(!aErr && data?.length === 1 && data[0].is_archived === true, `Failed to archive goalA ${id}`);
        const { data: rb } = await clientA.from('goals').select('is_archived').eq('id', id).single();
        assert(rb?.is_archived === true, `GoalA ${id} readback archive assertion failed`);
      }
      for (const id of cleanupResources.recurringA) {
        const { data, error: aErr } = await clientA.from('recurring_items').update({ is_archived: true }).eq('id', id).select();
        assert(!aErr && data?.length === 1 && data[0].is_archived === true, `Failed to archive recurringA ${id}`);
        const { data: rb } = await clientA.from('recurring_items').select('is_archived').eq('id', id).single();
        assert(rb?.is_archived === true, `RecurringA ${id} readback archive assertion failed`);
      }
      for (const id of cleanupResources.accountsA) {
        const { data, error: aErr } = await clientA.from('accounts').update({ is_archived: true }).eq('id', id).select();
        assert(!aErr && data?.length === 1 && data[0].is_archived === true, `Failed to archive accountA ${id}`);
        const { data: rb } = await clientA.from('accounts').select('is_archived').eq('id', id).single();
        assert(rb?.is_archived === true, `AccountA ${id} readback archive assertion failed`);
      }
      for (const id of cleanupResources.categoriesA) {
        const { data, error: aErr } = await clientA.from('categories').update({ is_archived: true }).eq('id', id).select();
        assert(!aErr && data?.length === 1 && data[0].is_archived === true, `Failed to archive categoryA ${id}`);
        const { data: rb } = await clientA.from('categories').select('is_archived').eq('id', id).single();
        assert(rb?.is_archived === true, `CategoryA ${id} readback archive assertion failed`);
      }

      // Archive User B budgets, goals, recurring, accounts, categories
      for (const id of cleanupResources.budgetsB) {
        const { data, error: aErr } = await clientB.from('budgets').update({ is_archived: true }).eq('id', id).select();
        assert(!aErr && data?.length === 1 && data[0].is_archived === true, `Failed to archive budgetB ${id}`);
        const { data: rb } = await clientB.from('budgets').select('is_archived').eq('id', id).single();
        assert(rb?.is_archived === true, `BudgetB ${id} readback archive assertion failed`);
      }
      for (const id of cleanupResources.goalsB) {
        const { data, error: aErr } = await clientB.from('goals').update({ is_archived: true }).eq('id', id).select();
        assert(!aErr && data?.length === 1 && data[0].is_archived === true, `Failed to archive goalB ${id}`);
        const { data: rb } = await clientB.from('goals').select('is_archived').eq('id', id).single();
        assert(rb?.is_archived === true, `GoalB ${id} readback archive assertion failed`);
      }
      for (const id of cleanupResources.recurringB) {
        const { data, error: aErr } = await clientB.from('recurring_items').update({ is_archived: true }).eq('id', id).select();
        assert(!aErr && data?.length === 1 && data[0].is_archived === true, `Failed to archive recurringB ${id}`);
        const { data: rb } = await clientB.from('recurring_items').select('is_archived').eq('id', id).single();
        assert(rb?.is_archived === true, `RecurringB ${id} readback archive assertion failed`);
      }
      for (const id of cleanupResources.accountsB) {
        const { data, error: aErr } = await clientB.from('accounts').update({ is_archived: true }).eq('id', id).select();
        assert(!aErr && data?.length === 1 && data[0].is_archived === true, `Failed to archive accountB ${id}`);
        const { data: rb } = await clientB.from('accounts').select('is_archived').eq('id', id).single();
        assert(rb?.is_archived === true, `AccountB ${id} readback archive assertion failed`);
      }
      for (const id of cleanupResources.categoriesB) {
        const { data, error: aErr } = await clientB.from('categories').update({ is_archived: true }).eq('id', id).select();
        assert(!aErr && data?.length === 1 && data[0].is_archived === true, `Failed to archive categoryB ${id}`);
        const { data: rb } = await clientB.from('categories').select('is_archived').eq('id', id).single();
        assert(rb?.is_archived === true, `CategoryB ${id} readback archive assertion failed`);
      }

      pass('DETERMINISTIC_CLEANUP_ASSERTIONS');
    } catch (cErr) {
      cleanupError = cErr;
    }

    if (primaryTestError) {
      console.error('LIVE RLS TEST FAILED:', primaryTestError);
      if (cleanupError) {
        console.error('ADDITIONAL CLEANUP ERROR:', cleanupError);
      }
      process.exit(1);
    }

    if (cleanupError) {
      console.error('CLEANUP ASSERTION ERROR:', cleanupError);
      process.exit(1);
    }
  }

  console.log('=======================================================');
  console.log('ALL PHASE 7 LIVE RLS RUNTIME CONTRACTS PASSED.');
  console.log('=======================================================');
}

runPhase7LiveRLSTests().catch((err) => {
  console.error('LIVE RLS TEST FAILED:', err);
  process.exit(1);
});
