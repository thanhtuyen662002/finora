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
  console.error('BLOCKED: missing Supabase URL/publishable key or two-user credentials');
  process.exit(1);
}

const clientA = createClient(SUPABASE_URL, SUPABASE_KEY);
const clientB = createClient(SUPABASE_URL, SUPABASE_KEY);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function pass(name) {
  console.log(`${name}=PASS`);
}

async function readDetail(client, id) {
  const { data, error } = await client
    .from('transaction_details')
    .select('*')
    .eq('id', id)
    .single();
  assert(!error && data, `transaction_details read failed for ${id}: ${error?.message}`);
  assert(typeof data.amount === 'string', 'transaction_details.amount must be returned as text');
  return data;
}

async function readBalance(client, accountId) {
  const { data, error } = await client
    .from('account_balances')
    .select('account_id,user_id,currency_code,current_balance')
    .eq('account_id', accountId)
    .single();
  assert(!error && data, `account_balances read failed for ${accountId}: ${error?.message}`);
  assert(typeof data.current_balance === 'string', 'account_balances.current_balance must be text');
  return data;
}

async function assertCrossSelectEmpty(client, transactionId, label) {
  const { data, error } = await client
    .from('transactions')
    .select('id')
    .eq('id', transactionId);
  assert(!error, `${label}: cross-user SELECT returned a database error instead of an RLS-empty result`);
  assert(Array.isArray(data) && data.length === 0, `${label}: cross-user SELECT leaked a transaction`);
}

async function archiveFixture(client, table, id) {
  const { data, error } = await client
    .from(table)
    .update({ is_archived: true })
    .eq('id', id)
    .select('id,is_archived')
    .single();
  assert(!error && data?.is_archived === true, `cleanup failed to archive ${table}:${id}: ${error?.message}`);
}

async function voidFixture(client, id) {
  const { data, error } = await client
    .from('transactions')
    .update({ is_voided: true })
    .eq('id', id)
    .select('id,is_voided')
    .single();
  assert(!error && data?.is_voided === true, `cleanup failed to void transaction ${id}: ${error?.message}`);
}

async function run() {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const today = new Date().toISOString().slice(0, 10);

  const transactionFixtures = [];
  const archiveFixtures = [];
  let cleanupStarted = false;

  try {
    const { data: authA, error: authAError } = await clientA.auth.signInWithPassword({
      email: USER_A_EMAIL,
      password: USER_A_PASSWORD,
    });
    assert(!authAError && authA?.user, `User A auth failed: ${authAError?.message}`);
    const uidA = authA.user.id;
    pass('USER_A_AUTH');

    const { data: authB, error: authBError } = await clientB.auth.signInWithPassword({
      email: USER_B_EMAIL,
      password: USER_B_PASSWORD,
    });
    assert(!authBError && authB?.user, `User B auth failed: ${authBError?.message}`);
    const uidB = authB.user.id;
    assert(uidA !== uidB, 'User A and User B must be distinct');
    pass('USER_B_AUTH');

    const { data: catAExpense, error: catAExpenseError } = await clientA
      .from('categories')
      .insert({
        user_id: uidA,
        name: `P4_${suffix}_A_EXP`,
        type: 'EXPENSE',
        icon: 'Car',
        color: '#e11d48',
      })
      .select('*')
      .single();
    assert(!catAExpenseError && catAExpense, `A expense category setup failed: ${catAExpenseError?.message}`);
    archiveFixtures.push({ client: clientA, table: 'categories', id: catAExpense.id });

    const { data: catAIncome, error: catAIncomeError } = await clientA
      .from('categories')
      .insert({
        user_id: uidA,
        name: `P4_${suffix}_A_INC`,
        type: 'INCOME',
        icon: 'Briefcase',
        color: '#10b981',
      })
      .select('*')
      .single();
    assert(!catAIncomeError && catAIncome, `A income category setup failed: ${catAIncomeError?.message}`);
    archiveFixtures.push({ client: clientA, table: 'categories', id: catAIncome.id });

    const { data: accountA, error: accountAError } = await clientA
      .from('accounts')
      .insert({
        user_id: uidA,
        name: `P4_${suffix}_A_VND`,
        type: 'CASH',
        currency_code: 'VND',
        opening_balance: '1000000.0000',
        color: '#2563eb',
      })
      .select('*')
      .single();
    assert(!accountAError && accountA, `A account setup failed: ${accountAError?.message}`);
    archiveFixtures.push({ client: clientA, table: 'accounts', id: accountA.id });

    const { data: catBExpense, error: catBExpenseError } = await clientB
      .from('categories')
      .insert({
        user_id: uidB,
        name: `P4_${suffix}_B_EXP`,
        type: 'EXPENSE',
        icon: 'Film',
        color: '#7c3aed',
      })
      .select('*')
      .single();
    assert(!catBExpenseError && catBExpense, `B expense category setup failed: ${catBExpenseError?.message}`);
    archiveFixtures.push({ client: clientB, table: 'categories', id: catBExpense.id });

    const { data: catBIncome, error: catBIncomeError } = await clientB
      .from('categories')
      .insert({
        user_id: uidB,
        name: `P4_${suffix}_B_INC`,
        type: 'INCOME',
        icon: 'TrendingUp',
        color: '#059669',
      })
      .select('*')
      .single();
    assert(!catBIncomeError && catBIncome, `B income category setup failed: ${catBIncomeError?.message}`);
    archiveFixtures.push({ client: clientB, table: 'categories', id: catBIncome.id });

    const { data: accountB, error: accountBError } = await clientB
      .from('accounts')
      .insert({
        user_id: uidB,
        name: `P4_${suffix}_B_VND`,
        type: 'BANK',
        currency_code: 'VND',
        opening_balance: '2000000.0000',
        color: '#d97706',
      })
      .select('*')
      .single();
    assert(!accountBError && accountB, `B account setup failed: ${accountBError?.message}`);
    archiveFixtures.push({ client: clientB, table: 'accounts', id: accountB.id });

    const { data: txAExpense, error: txAExpenseError } = await clientA
      .from('transactions')
      .insert({
        user_id: uidA,
        account_id: accountA.id,
        category_id: catAExpense.id,
        type: 'EXPENSE',
        amount: '200000.0000',
        currency_code: 'VND',
        merchant: `P4_${suffix}_A_EXPENSE`,
        note: 'A expense lifecycle',
        occurred_on: today,
      })
      .select('id')
      .single();
    assert(!txAExpenseError && txAExpense, `A expense insert failed: ${txAExpenseError?.message}`);
    transactionFixtures.push({ client: clientA, id: txAExpense.id });

    const detailAExpense = await readDetail(clientA, txAExpense.id);
    assert(detailAExpense.amount === '200000.0000', 'A exact amount read-back mismatch');
    assert((await readBalance(clientA, accountA.id)).current_balance === '800000.0000', 'A first balance mismatch');

    const { data: txAIncome, error: txAIncomeError } = await clientA
      .from('transactions')
      .insert({
        user_id: uidA,
        account_id: accountA.id,
        category_id: catAIncome.id,
        type: 'INCOME',
        amount: '500000.0000',
        currency_code: 'VND',
        merchant: `P4_${suffix}_A_INCOME`,
        occurred_on: today,
      })
      .select('id')
      .single();
    assert(!txAIncomeError && txAIncome, `A income insert failed: ${txAIncomeError?.message}`);
    transactionFixtures.push({ client: clientA, id: txAIncome.id });
    assert((await readBalance(clientA, accountA.id)).current_balance === '1300000.0000', 'A income balance mismatch');

    const { error: updateAError } = await clientA
      .from('transactions')
      .update({ amount: '300000.0000', merchant: `P4_${suffix}_A_UPDATED`, occurred_on: today })
      .eq('id', txAExpense.id)
      .select('id')
      .single();
    assert(!updateAError, `A own update failed: ${updateAError?.message}`);
    const updatedA = await readDetail(clientA, txAExpense.id);
    assert(updatedA.amount === '300000.0000' && updatedA.merchant.endsWith('_A_UPDATED'), 'A update read-back failed');
    assert((await readBalance(clientA, accountA.id)).current_balance === '1200000.0000', 'A updated balance mismatch');

    const { error: voidAError } = await clientA
      .from('transactions')
      .update({ is_voided: true })
      .eq('id', txAExpense.id)
      .select('id')
      .single();
    assert(!voidAError, `A void failed: ${voidAError?.message}`);
    assert((await readDetail(clientA, txAExpense.id)).is_voided === true, 'A void read-back failed');
    assert((await readBalance(clientA, accountA.id)).current_balance === '1500000.0000', 'A void balance mismatch');

    const { error: restoreAError } = await clientA
      .from('transactions')
      .update({ is_voided: false })
      .eq('id', txAExpense.id)
      .select('id')
      .single();
    assert(!restoreAError, `A restore failed: ${restoreAError?.message}`);
    assert((await readDetail(clientA, txAExpense.id)).is_voided === false, 'A restore read-back failed');
    assert((await readBalance(clientA, accountA.id)).current_balance === '1200000.0000', 'A restore balance mismatch');
    pass('USER_A_OWN_TRANSACTION_LIFECYCLE');

    const { data: txBExpense, error: txBExpenseError } = await clientB
      .from('transactions')
      .insert({
        user_id: uidB,
        account_id: accountB.id,
        category_id: catBExpense.id,
        type: 'EXPENSE',
        amount: '400000.0000',
        currency_code: 'VND',
        merchant: `P4_${suffix}_B_EXPENSE`,
        occurred_on: today,
      })
      .select('id')
      .single();
    assert(!txBExpenseError && txBExpense, `B expense insert failed: ${txBExpenseError?.message}`);
    transactionFixtures.push({ client: clientB, id: txBExpense.id });
    assert((await readDetail(clientB, txBExpense.id)).amount === '400000.0000', 'B exact amount read-back mismatch');
    assert((await readBalance(clientB, accountB.id)).current_balance === '1600000.0000', 'B first balance mismatch');

    const { error: updateBError } = await clientB
      .from('transactions')
      .update({ amount: '450000.0000', merchant: `P4_${suffix}_B_UPDATED`, occurred_on: today })
      .eq('id', txBExpense.id)
      .select('id')
      .single();
    assert(!updateBError, `B own update failed: ${updateBError?.message}`);
    const updatedB = await readDetail(clientB, txBExpense.id);
    assert(updatedB.amount === '450000.0000' && updatedB.merchant.endsWith('_B_UPDATED'), 'B update read-back failed');
    assert((await readBalance(clientB, accountB.id)).current_balance === '1550000.0000', 'B updated balance mismatch');

    const { error: voidBError } = await clientB
      .from('transactions')
      .update({ is_voided: true })
      .eq('id', txBExpense.id)
      .select('id')
      .single();
    assert(!voidBError, `B void failed: ${voidBError?.message}`);
    assert((await readDetail(clientB, txBExpense.id)).is_voided === true, 'B void read-back failed');
    assert((await readBalance(clientB, accountB.id)).current_balance === '2000000.0000', 'B void balance mismatch');

    const { error: restoreBError } = await clientB
      .from('transactions')
      .update({ is_voided: false })
      .eq('id', txBExpense.id)
      .select('id')
      .single();
    assert(!restoreBError, `B restore failed: ${restoreBError?.message}`);
    assert((await readDetail(clientB, txBExpense.id)).is_voided === false, 'B restore read-back failed');
    assert((await readBalance(clientB, accountB.id)).current_balance === '1550000.0000', 'B restore balance mismatch');
    pass('USER_B_OWN_TRANSACTION_LIFECYCLE');

    const { error: aOwnsBInsertError } = await clientA.from('transactions').insert({
      user_id: uidB,
      account_id: accountB.id,
      category_id: catBExpense.id,
      type: 'EXPENSE',
      amount: '10000.0000',
      currency_code: 'VND',
      merchant: 'A_CANNOT_OWN_B',
      occurred_on: today,
    });
    assert(aOwnsBInsertError, 'A inserted a transaction owned by B');

    const { error: bOwnsAInsertError } = await clientB.from('transactions').insert({
      user_id: uidA,
      account_id: accountA.id,
      category_id: catAExpense.id,
      type: 'EXPENSE',
      amount: '10000.0000',
      currency_code: 'VND',
      merchant: 'B_CANNOT_OWN_A',
      occurred_on: today,
    });
    assert(bOwnsAInsertError, 'B inserted a transaction owned by A');
    pass('CROSS_USER_OWNED_INSERT_BLOCKED');

    const crossReferenceCases = [
      [clientA, uidA, accountB.id, catAExpense.id, 'A->B account'],
      [clientA, uidA, accountA.id, catBExpense.id, 'A->B category'],
      [clientB, uidB, accountA.id, catBExpense.id, 'B->A account'],
      [clientB, uidB, accountB.id, catAExpense.id, 'B->A category'],
    ];
    for (const [client, userId, accountId, categoryId, label] of crossReferenceCases) {
      const { error } = await client.from('transactions').insert({
        user_id: userId,
        account_id: accountId,
        category_id: categoryId,
        type: 'EXPENSE',
        amount: '10000.0000',
        currency_code: 'VND',
        merchant: `BLOCK_${suffix}`,
        occurred_on: today,
      });
      assert(error, `${label}: composite ownership FK did not block insert`);
    }
    pass('CROSS_USER_ACCOUNT_CATEGORY_REFERENCES_BLOCKED');

    await assertCrossSelectEmpty(clientB, txAExpense.id, 'B->A');
    await assertCrossSelectEmpty(clientA, txBExpense.id, 'A->B');
    pass('CROSS_USER_SELECT_BLOCKED');

    await clientB.from('transactions').update({ merchant: 'HACKED_BY_B' }).eq('id', txAExpense.id);
    await clientA.from('transactions').update({ merchant: 'HACKED_BY_A' }).eq('id', txBExpense.id);
    assert((await readDetail(clientA, txAExpense.id)).merchant !== 'HACKED_BY_B', 'B updated A transaction');
    assert((await readDetail(clientB, txBExpense.id)).merchant !== 'HACKED_BY_A', 'A updated B transaction');
    pass('CROSS_USER_UPDATE_BLOCKED');

    const { error: ownershipMutationA } = await clientA
      .from('transactions')
      .update({ user_id: uidB })
      .eq('id', txAExpense.id);
    const { error: ownershipMutationB } = await clientB
      .from('transactions')
      .update({ user_id: uidA })
      .eq('id', txBExpense.id);
    assert(ownershipMutationA && ownershipMutationB, 'transaction user_id mutation was not blocked for both users');
    pass('OWNERSHIP_CHANGE_BLOCKED');

    const invalidCases = [
      {
        label: 'EXPENSE->INCOME category',
        client: clientA,
        row: { user_id: uidA, account_id: accountA.id, category_id: catAIncome.id, type: 'EXPENSE', amount: '10000.0000', currency_code: 'VND', merchant: 'BAD_TYPE_1', occurred_on: today },
      },
      {
        label: 'INCOME->EXPENSE category',
        client: clientA,
        row: { user_id: uidA, account_id: accountA.id, category_id: catAExpense.id, type: 'INCOME', amount: '10000.0000', currency_code: 'VND', merchant: 'BAD_TYPE_2', occurred_on: today },
      },
      {
        label: 'currency mismatch',
        client: clientA,
        row: { user_id: uidA, account_id: accountA.id, category_id: catAExpense.id, type: 'EXPENSE', amount: '10.0000', currency_code: 'USD', merchant: 'BAD_CURRENCY', occurred_on: today },
      },
      {
        label: 'zero amount',
        client: clientA,
        row: { user_id: uidA, account_id: accountA.id, category_id: catAExpense.id, type: 'EXPENSE', amount: '0.0000', currency_code: 'VND', merchant: 'BAD_ZERO', occurred_on: today },
      },
      {
        label: 'negative amount',
        client: clientA,
        row: { user_id: uidA, account_id: accountA.id, category_id: catAExpense.id, type: 'EXPENSE', amount: '-1.0000', currency_code: 'VND', merchant: 'BAD_NEGATIVE', occurred_on: today },
      },
      {
        label: 'TRANSFER type',
        client: clientA,
        row: { user_id: uidA, account_id: accountA.id, category_id: catAExpense.id, type: 'TRANSFER', amount: '10000.0000', currency_code: 'VND', merchant: 'BAD_TRANSFER', occurred_on: today },
      },
    ];
    for (const testCase of invalidCases) {
      const { error } = await testCase.client.from('transactions').insert(testCase.row);
      assert(error, `${testCase.label}: invalid transaction was accepted`);
    }
    pass('DOMAIN_INTEGRITY_CONSTRAINTS');

    const { error: deleteOwnA } = await clientA.from('transactions').delete().eq('id', txAExpense.id);
    const { error: deleteOwnB } = await clientB.from('transactions').delete().eq('id', txBExpense.id);
    assert(deleteOwnA && deleteOwnB, 'normal clients received DELETE capability');
    assert((await readDetail(clientA, txAExpense.id)).id === txAExpense.id, 'A transaction disappeared after blocked DELETE');
    assert((await readDetail(clientB, txBExpense.id)).id === txBExpense.id, 'B transaction disappeared after blocked DELETE');
    pass('DELETE_BLOCKED');

    const { data: allViewA, error: allViewAError } = await clientA.from('transaction_details').select('id,user_id');
    const { data: allViewB, error: allViewBError } = await clientB.from('transaction_details').select('id,user_id');
    assert(!allViewAError && allViewA?.every((row) => row.user_id === uidA), 'transaction_details leaked rows to A');
    assert(!allViewBError && allViewB?.every((row) => row.user_id === uidB), 'transaction_details leaked rows to B');

    const { data: crossDetailBA, error: crossDetailBAError } = await clientB.from('transaction_details').select('id').eq('id', txAExpense.id);
    const { data: crossDetailAB, error: crossDetailABError } = await clientA.from('transaction_details').select('id').eq('id', txBExpense.id);
    assert(!crossDetailBAError && crossDetailBA?.length === 0, 'transaction_details leaked A row to B');
    assert(!crossDetailABError && crossDetailAB?.length === 0, 'transaction_details leaked B row to A');

    const { data: crossBalanceBA, error: crossBalanceBAError } = await clientB.from('account_balances').select('account_id').eq('account_id', accountA.id);
    const { data: crossBalanceAB, error: crossBalanceABError } = await clientA.from('account_balances').select('account_id').eq('account_id', accountB.id);
    assert(!crossBalanceBAError && crossBalanceBA?.length === 0, 'account_balances leaked A row to B');
    assert(!crossBalanceABError && crossBalanceAB?.length === 0, 'account_balances leaked B row to A');
    pass('SECURITY_INVOKER_VIEW_ISOLATION');

    const { error: deliberateDatabaseError } = await clientA
      .from('transactions')
      .select('id')
      .eq('id', 'not-a-valid-uuid');
    assert(deliberateDatabaseError, 'deliberate normal database error was not distinguishable from an RLS-empty result');
    pass('DELIBERATE_DATABASE_ERROR');
  } finally {
    cleanupStarted = true;

    for (const fixture of transactionFixtures) {
      await voidFixture(fixture.client, fixture.id);
    }
    for (const fixture of archiveFixtures) {
      await archiveFixture(fixture.client, fixture.table, fixture.id);
    }

    if (cleanupStarted) pass('TEST_RECORD_CLEANUP');
  }

  pass('PHASE_4_TWO_USER_RLS');
  console.log('PROCESS_EXIT_CODE=0');
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`PHASE_4_TWO_USER_RLS=FAIL\n${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
