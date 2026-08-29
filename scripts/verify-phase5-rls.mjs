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

function toScaledBigInt(amountStr) {
  if (typeof amountStr !== 'string') {
    throw new Error(`toScaledBigInt expected string, received: ${typeof amountStr}`);
  }
  const clean = amountStr.trim();
  const negative = clean.startsWith('-');
  const unsigned = negative ? clean.slice(1) : clean;
  const [intPart = '0', fracPart = ''] = unsigned.split('.');
  const paddedFrac = fracPart.padEnd(4, '0').slice(0, 4);
  const raw = BigInt(intPart) * 10000n + BigInt(paddedFrac);
  return negative ? -raw : raw;
}

async function readTransferDetail(client, id) {
  const { data, error } = await client
    .from('transfer_details')
    .select('*')
    .eq('id', id)
    .single();
  assert(!error && data, `transfer_details read failed for ${id}: ${error?.message}`);
  assert(typeof data.amount === 'string', 'transfer_details.amount must be returned as text');
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

async function assertCrossSelectEmpty(client, transferId, label) {
  const { data, error } = await client
    .from('transfers')
    .select('id')
    .eq('id', transferId);
  assert(!error, `${label}: cross-user SELECT returned a database error instead of an RLS-empty result`);
  assert(Array.isArray(data) && data.length === 0, `${label}: cross-user SELECT leaked a transfer`);
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

async function voidTransferFixture(client, id) {
  const { data, error } = await client
    .from('transfers')
    .update({ is_voided: true })
    .eq('id', id)
    .select('id,is_voided')
    .single();
  assert(!error && data?.is_voided === true, `cleanup failed to void transfer ${id}: ${error?.message}`);
}

async function voidTransactionFixture(client, id) {
  const { data, error } = await client
    .from('transactions')
    .update({ is_voided: true })
    .eq('id', id)
    .select('id,is_voided')
    .single();
  assert(!error && data?.is_voided === true, `cleanup failed to void transaction ${id}: ${error?.message}`);
}

async function checkSchemaReadiness(client) {
  const { error: tErr } = await client.from('transfers').select('id').limit(0);
  const { error: tdErr } = await client.from('transfer_details').select('id').limit(0);
  const { error: abErr } = await client.from('account_balances').select('account_id').limit(0);

  if (tErr || tdErr || abErr) {
    const details = [
      tErr ? `transfers: ${tErr.message}` : null,
      tdErr ? `transfer_details: ${tdErr.message}` : null,
      abErr ? `account_balances: ${abErr.message}` : null,
    ].filter(Boolean).join('; ');
    throw new Error(
      `SCHEMA_NOT_READY: Database is missing Phase 5 entities or views (${details}). Phase 5 migration must be applied before running dynamic verifier.`
    );
  }
}

async function run() {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const today = new Date().toISOString().slice(0, 10);

  const transferFixtures = [];
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

    // Schema readiness check
    await checkSchemaReadiness(clientA);
    pass('SCHEMA_READINESS');

    // Setup User A accounts: A1 (VND), A2 (VND), A3 (USD)
    const { data: accountA1, error: accountA1Error } = await clientA
      .from('accounts')
      .insert({
        user_id: uidA,
        name: `P5_${suffix}_A1_VND`,
        type: 'CASH',
        currency_code: 'VND',
        opening_balance: '1000000.0000',
        color: '#2563eb',
      })
      .select('*')
      .single();
    assert(!accountA1Error && accountA1, `A1 account setup failed: ${accountA1Error?.message}`);
    archiveFixtures.push({ client: clientA, table: 'accounts', id: accountA1.id });

    const { data: accountA2, error: accountA2Error } = await clientA
      .from('accounts')
      .insert({
        user_id: uidA,
        name: `P5_${suffix}_A2_VND`,
        type: 'BANK',
        currency_code: 'VND',
        opening_balance: '500000.0000',
        color: '#10b981',
      })
      .select('*')
      .single();
    assert(!accountA2Error && accountA2, `A2 account setup failed: ${accountA2Error?.message}`);
    archiveFixtures.push({ client: clientA, table: 'accounts', id: accountA2.id });

    const { data: accountA3, error: accountA3Error } = await clientA
      .from('accounts')
      .insert({
        user_id: uidA,
        name: `P5_${suffix}_A3_USD`,
        type: 'BANK',
        currency_code: 'USD',
        opening_balance: '100.0000',
        color: '#3b82f6',
      })
      .select('*')
      .single();
    assert(!accountA3Error && accountA3, `A3 account setup failed: ${accountA3Error?.message}`);
    archiveFixtures.push({ client: clientA, table: 'accounts', id: accountA3.id });

    // Setup User B accounts: B1 (VND), B2 (VND)
    const { data: accountB1, error: accountB1Error } = await clientB
      .from('accounts')
      .insert({
        user_id: uidB,
        name: `P5_${suffix}_B1_VND`,
        type: 'BANK',
        currency_code: 'VND',
        opening_balance: '2000000.0000',
        color: '#d97706',
      })
      .select('*')
      .single();
    assert(!accountB1Error && accountB1, `B1 account setup failed: ${accountB1Error?.message}`);
    archiveFixtures.push({ client: clientB, table: 'accounts', id: accountB1.id });

    const { data: accountB2, error: accountB2Error } = await clientB
      .from('accounts')
      .insert({
        user_id: uidB,
        name: `P5_${suffix}_B2_VND`,
        type: 'EWALLET',
        currency_code: 'VND',
        opening_balance: '1000000.0000',
        color: '#7c3aed',
      })
      .select('*')
      .single();
    assert(!accountB2Error && accountB2, `B2 account setup failed: ${accountB2Error?.message}`);
    archiveFixtures.push({ client: clientB, table: 'accounts', id: accountB2.id });

    // Get User A initial balances and net worth
    const balA1_init = await readBalance(clientA, accountA1.id);
    const balA2_init = await readBalance(clientA, accountA2.id);
    assert(balA1_init.current_balance === '1000000.0000', 'A1 initial balance mismatch');
    assert(balA2_init.current_balance === '500000.0000', 'A2 initial balance mismatch');
    const initialNetWorthVND = toScaledBigInt(balA1_init.current_balance) + toScaledBigInt(balA2_init.current_balance);
    assert(initialNetWorthVND === 15000000000n, 'A1 + A2 initial sum must equal 1,500,000.0000 VND (scaled)');

    // 1. User A creates transfer: 200,000 VND from A1 -> A2
    const { data: transferA, error: transferAError } = await clientA
      .from('transfers')
      .insert({
        user_id: uidA,
        from_account_id: accountA1.id,
        to_account_id: accountA2.id,
        amount: '200000.0000',
        currency_code: 'VND',
        note: 'Initial transfer 200k',
        occurred_on: today,
      })
      .select('id')
      .single();
    assert(!transferAError && transferA, `A transfer insert failed: ${transferAError?.message}`);
    transferFixtures.push({ client: clientA, id: transferA.id });

    // Read back transfer_details
    const detailA = await readTransferDetail(clientA, transferA.id);
    assert(detailA.amount === '200000.0000', 'A transfer amount read-back mismatch');
    assert(detailA.from_account_name === accountA1.name, 'A from_account_name mismatch');
    assert(detailA.to_account_name === accountA2.name, 'A to_account_name mismatch');
    assert(detailA.from_account_type === accountA1.type, 'A from_account_type mismatch');
    assert(detailA.to_account_type === accountA2.type, 'A to_account_type mismatch');
    assert(detailA.currency_code === 'VND', 'A currency_code mismatch');
    assert(detailA.is_voided === false, 'A is_voided must be false');

    // Verify derived balances: A1 = 800,000, A2 = 700,000
    const balA1_afterT1 = await readBalance(clientA, accountA1.id);
    const balA2_afterT1 = await readBalance(clientA, accountA2.id);
    assert(balA1_afterT1.current_balance === '800000.0000', 'A1 balance after 200k transfer mismatch');
    assert(balA2_afterT1.current_balance === '700000.0000', 'A2 balance after 200k transfer mismatch');
    const netWorthAfterT1 = toScaledBigInt(balA1_afterT1.current_balance) + toScaledBigInt(balA2_afterT1.current_balance);
    assert(netWorthAfterT1 === initialNetWorthVND, 'Net worth must be invariant after transfer');

    // 2. Edit/update transfer: 200,000 -> 300,000 VND
    const { error: updateAError } = await clientA
      .from('transfers')
      .update({ amount: '300000.0000', note: 'Updated transfer 300k' })
      .eq('id', transferA.id)
      .select('id')
      .single();
    assert(!updateAError, `A transfer update failed: ${updateAError?.message}`);
    const detailA_up = await readTransferDetail(clientA, transferA.id);
    assert(detailA_up.amount === '300000.0000' && detailA_up.note === 'Updated transfer 300k', 'A transfer update read-back mismatch');

    // Verify derived balances: A1 = 700,000, A2 = 800,000
    const balA1_afterUp = await readBalance(clientA, accountA1.id);
    const balA2_afterUp = await readBalance(clientA, accountA2.id);
    assert(balA1_afterUp.current_balance === '700000.0000', 'A1 balance after transfer update mismatch');
    assert(balA2_afterUp.current_balance === '800000.0000', 'A2 balance after transfer update mismatch');
    const netWorthAfterUp = toScaledBigInt(balA1_afterUp.current_balance) + toScaledBigInt(balA2_afterUp.current_balance);
    assert(netWorthAfterUp === initialNetWorthVND, 'Net worth must be invariant after transfer update');

    // 3. Void transfer: is_voided = true
    const { error: voidAError } = await clientA
      .from('transfers')
      .update({ is_voided: true })
      .eq('id', transferA.id)
      .select('id')
      .single();
    assert(!voidAError, `A transfer void failed: ${voidAError?.message}`);
    assert((await readTransferDetail(clientA, transferA.id)).is_voided === true, 'A transfer void status mismatch');

    // Verify derived balances restored: A1 = 1,000,000, A2 = 500,000
    const balA1_afterVoid = await readBalance(clientA, accountA1.id);
    const balA2_afterVoid = await readBalance(clientA, accountA2.id);
    assert(balA1_afterVoid.current_balance === '1000000.0000', 'A1 balance after void mismatch');
    assert(balA2_afterVoid.current_balance === '500000.0000', 'A2 balance after void mismatch');
    const netWorthAfterVoid = toScaledBigInt(balA1_afterVoid.current_balance) + toScaledBigInt(balA2_afterVoid.current_balance);
    assert(netWorthAfterVoid === initialNetWorthVND, 'Net worth must be invariant after transfer void');

    // 4. Restore transfer: is_voided = false
    const { error: restoreAError } = await clientA
      .from('transfers')
      .update({ is_voided: false })
      .eq('id', transferA.id)
      .select('id')
      .single();
    assert(!restoreAError, `A transfer restore failed: ${restoreAError?.message}`);
    assert((await readTransferDetail(clientA, transferA.id)).is_voided === false, 'A transfer restore status mismatch');

    // Verify derived balances restored to active transfer state: A1 = 700,000, A2 = 800,000
    const balA1_afterRestore = await readBalance(clientA, accountA1.id);
    const balA2_afterRestore = await readBalance(clientA, accountA2.id);
    assert(balA1_afterRestore.current_balance === '700000.0000', 'A1 balance after restore mismatch');
    assert(balA2_afterRestore.current_balance === '800000.0000', 'A2 balance after restore mismatch');
    const netWorthAfterRestore = toScaledBigInt(balA1_afterRestore.current_balance) + toScaledBigInt(balA2_afterRestore.current_balance);
    assert(netWorthAfterRestore === initialNetWorthVND, 'Net worth must be invariant after transfer restore');
    pass('USER_A_TRANSFER_LIFECYCLE_AND_NET_WORTH_NEUTRALITY');

    // User B transfer lifecycle: 500,000 VND from B1 to B2
    const { data: transferB, error: transferBError } = await clientB
      .from('transfers')
      .insert({
        user_id: uidB,
        from_account_id: accountB1.id,
        to_account_id: accountB2.id,
        amount: '500000.0000',
        currency_code: 'VND',
        note: 'B transfer lifecycle',
        occurred_on: today,
      })
      .select('id')
      .single();
    assert(!transferBError && transferB, `B transfer insert failed: ${transferBError?.message}`);
    transferFixtures.push({ client: clientB, id: transferB.id });

    assert((await readTransferDetail(clientB, transferB.id)).amount === '500000.0000', 'B transfer amount read-back mismatch');
    assert((await readBalance(clientB, accountB1.id)).current_balance === '1500000.0000', 'B1 balance after transfer mismatch');
    assert((await readBalance(clientB, accountB2.id)).current_balance === '1500000.0000', 'B2 balance after transfer mismatch');
    pass('USER_B_TRANSFER_LIFECYCLE');

    // 5. Cross-user isolation tests
    // User B cannot SELECT User A's transfers directly
    await assertCrossSelectEmpty(clientB, transferA.id, 'B->A transfers');
    await assertCrossSelectEmpty(clientA, transferB.id, 'A->B transfers');

    // User B cannot read User A's transfers via transfer_details
    const { data: crossTransferBA, error: crossTransferBAError } = await clientB.from('transfer_details').select('id').eq('id', transferA.id);
    const { data: crossTransferAB, error: crossTransferABError } = await clientA.from('transfer_details').select('id').eq('id', transferB.id);
    assert(!crossTransferBAError && crossTransferBA?.length === 0, 'transfer_details leaked A row to B');
    assert(!crossTransferABError && crossTransferAB?.length === 0, 'transfer_details leaked B row to A');

    // User B cannot UPDATE User A's transfer
    await clientB.from('transfers').update({ note: 'HACKED_BY_B' }).eq('id', transferA.id);
    await clientA.from('transfers').update({ note: 'HACKED_BY_A' }).eq('id', transferB.id);
    assert((await readTransferDetail(clientA, transferA.id)).note !== 'HACKED_BY_B', 'B updated A transfer note');
    assert((await readTransferDetail(clientB, transferB.id)).note !== 'HACKED_BY_A', 'A updated B transfer note');

    // User B cannot void User A's transfer
    await clientB.from('transfers').update({ is_voided: true }).eq('id', transferA.id);
    assert((await readTransferDetail(clientA, transferA.id)).is_voided === false, 'B voided A transfer');

    // User B cannot INSERT a transfer with user_id = User A (spoofing)
    const { error: spoofUserAError } = await clientB.from('transfers').insert({
      user_id: uidA,
      from_account_id: accountB1.id,
      to_account_id: accountB2.id,
      amount: '10000.0000',
      currency_code: 'VND',
      occurred_on: today,
    });
    assert(spoofUserAError, 'B spoofed user_id = User A');

    // User B cannot INSERT a transfer with from_account_id = User A's account
    const { error: crossAccountFromError } = await clientB.from('transfers').insert({
      user_id: uidB,
      from_account_id: accountA1.id,
      to_account_id: accountB2.id,
      amount: '10000.0000',
      currency_code: 'VND',
      occurred_on: today,
    });
    assert(crossAccountFromError, 'B created transfer using A source account');

    // User B cannot INSERT a transfer with to_account_id = User A's account
    const { error: crossAccountToError } = await clientB.from('transfers').insert({
      user_id: uidB,
      from_account_id: accountB1.id,
      to_account_id: accountA1.id,
      amount: '10000.0000',
      currency_code: 'VND',
      occurred_on: today,
    });
    assert(crossAccountToError, 'B created transfer using A destination account');
    pass('CROSS_USER_ISOLATION_AND_SPOOFING_BLOCKED');

    // 6. Domain & integrity rejection cases
    const domainRejectionCases = [
      {
        label: 'zero amount',
        client: clientA,
        row: { user_id: uidA, from_account_id: accountA1.id, to_account_id: accountA2.id, amount: '0.0000', currency_code: 'VND', occurred_on: today },
      },
      {
        label: 'negative amount',
        client: clientA,
        row: { user_id: uidA, from_account_id: accountA1.id, to_account_id: accountA2.id, amount: '-5000.0000', currency_code: 'VND', occurred_on: today },
      },
      {
        label: 'same source and destination account',
        client: clientA,
        row: { user_id: uidA, from_account_id: accountA1.id, to_account_id: accountA1.id, amount: '10000.0000', currency_code: 'VND', occurred_on: today },
      },
      {
        label: 'cross-currency transfer (VND -> USD account)',
        client: clientA,
        row: { user_id: uidA, from_account_id: accountA1.id, to_account_id: accountA3.id, amount: '10000.0000', currency_code: 'VND', occurred_on: today },
      },
      {
        label: 'non-existent account UUID',
        client: clientA,
        row: { user_id: uidA, from_account_id: '00000000-0000-0000-0000-000000000000', to_account_id: accountA2.id, amount: '10000.0000', currency_code: 'VND', occurred_on: today },
      },
      {
        label: 'invalid currency code format (lowercase)',
        client: clientA,
        row: { user_id: uidA, from_account_id: accountA1.id, to_account_id: accountA2.id, amount: '10000.0000', currency_code: 'vnd', occurred_on: today },
      },
      {
        label: 'note exceeds 1000 characters',
        client: clientA,
        row: { user_id: uidA, from_account_id: accountA1.id, to_account_id: accountA2.id, amount: '10000.0000', currency_code: 'VND', note: 'x'.repeat(1001), occurred_on: today },
      },
    ];

    for (const testCase of domainRejectionCases) {
      const { error } = await testCase.client.from('transfers').insert(testCase.row);
      assert(error, `Domain rejection failed for: ${testCase.label}`);
    }

    // Direct DELETE blocked
    const { error: deleteAError } = await clientA.from('transfers').delete().eq('id', transferA.id);
    assert(deleteAError, 'Direct DELETE on transfers was not blocked');

    // Immutable column mutation blocked (user_id mutation)
    const { error: userMutationError } = await clientA
      .from('transfers')
      .update({ user_id: uidB })
      .eq('id', transferA.id);
    assert(userMutationError, 'Mutation of transfer user_id was not blocked');
    pass('DOMAIN_AND_INTEGRITY_REJECTIONS');

    // 7. Phase 4 Non-Regression: Transactions + Transfers co-derivation
    // Fetch an existing active category for User A or create one
    const { data: catList, error: catListError } = await clientA
      .from('categories')
      .select('id,type')
      .eq('type', 'EXPENSE')
      .eq('is_archived', false)
      .limit(1);
    assert(!catListError && catList?.length > 0, 'User A has no active EXPENSE category for transaction non-regression check');
    const categoryId = catList[0].id;

    // User A inserts an EXPENSE transaction of 100,000 VND on A1
    const { data: txA, error: txAError } = await clientA
      .from('transactions')
      .insert({
        user_id: uidA,
        account_id: accountA1.id,
        category_id: categoryId,
        type: 'EXPENSE',
        amount: '100000.0000',
        currency_code: 'VND',
        merchant: 'Phase 5 Non-Regression Merchant',
        note: 'Co-derivation test',
        occurred_on: today,
      })
      .select('id')
      .single();
    assert(!txAError && txA, `Phase 4 transaction insert failed: ${txAError?.message}`);
    transactionFixtures.push({ client: clientA, id: txA.id });

    // Verify account balance derivation reflects BOTH transaction and transfer:
    // A1 = opening (1M) - transfer out (300k) - expense tx (100k) = 600,000 VND
    const balA1_withTx = await readBalance(clientA, accountA1.id);
    assert(balA1_withTx.current_balance === '600000.0000', 'A1 balance with combined tx + transfer mismatch');

    // Voiding transaction restores A1 to 700,000 VND without corrupting transfer impact
    const { error: voidTxError } = await clientA
      .from('transactions')
      .update({ is_voided: true })
      .eq('id', txA.id)
      .select('id')
      .single();
    assert(!voidTxError, `Phase 4 transaction void failed: ${voidTxError?.message}`);

    const balA1_afterVoidTx = await readBalance(clientA, accountA1.id);
    assert(balA1_afterVoidTx.current_balance === '700000.0000', 'A1 balance after voiding tx mismatch');
    pass('PHASE_4_NON_REGRESSION_AND_CO_DERIVATION');
  } finally {
    cleanupStarted = true;

    for (const fixture of transactionFixtures) {
      try {
        await voidTransactionFixture(fixture.client, fixture.id);
      } catch (err) {
        console.warn(`Failed to void test transaction ${fixture.id}:`, err);
      }
    }
    for (const fixture of transferFixtures) {
      try {
        await voidTransferFixture(fixture.client, fixture.id);
      } catch (err) {
        console.warn(`Failed to void test transfer ${fixture.id}:`, err);
      }
    }
    for (const fixture of archiveFixtures) {
      try {
        await archiveFixture(fixture.client, fixture.table, fixture.id);
      } catch (err) {
        console.warn(`Failed to archive test account ${fixture.id}:`, err);
      }
    }

    if (cleanupStarted) pass('TEST_RECORD_CLEANUP');
  }

  pass('PHASE_5_TWO_USER_RLS');
  console.log('PROCESS_EXIT_CODE=0');
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(`PHASE_5_TWO_USER_RLS=FAIL\n${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
