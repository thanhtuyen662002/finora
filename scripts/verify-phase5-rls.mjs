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

async function readTransactionDetail(client, id) {
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

async function assertCrossSelectEmpty(client, table, id, label) {
  const { data, error } = await client
    .from(table)
    .select('*')
    .eq('id', id);
  assert(!error, `${label}: cross-user SELECT returned a database error instead of an RLS-empty result: ${error?.message}`);
  assert(Array.isArray(data) && data.length === 0, `${label}: cross-user SELECT leaked row from ${table}`);
}

async function assertCrossBalanceEmpty(client, accountId, label) {
  const { data, error } = await client
    .from('account_balances')
    .select('*')
    .eq('account_id', accountId);
  assert(!error, `${label}: cross-user account_balances SELECT returned database error: ${error?.message}`);
  assert(Array.isArray(data) && data.length === 0, `${label}: account_balances leaked foreign account balance`);
}

async function archiveAccountDirect(client, id) {
  const { data, error } = await client
    .from('accounts')
    .update({ is_archived: true })
    .eq('id', id)
    .select('id,is_archived')
    .single();
  assert(!error && data?.is_archived === true, `cleanup failed to archive account ${id}: ${error?.message}`);
}

async function voidTransferDirect(client, id) {
  const { data, error } = await client
    .from('transfers')
    .update({ is_voided: true })
    .eq('id', id)
    .select('id,is_voided')
    .single();
  assert(!error && data?.is_voided === true, `cleanup failed to void transfer ${id}: ${error?.message}`);
}

async function voidTransactionDirect(client, id) {
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
  const { error: txdErr } = await client.from('transaction_details').select('id').limit(0);

  if (tErr || tdErr || abErr || txdErr) {
    const details = [
      tErr ? `transfers: ${tErr.message}` : null,
      tdErr ? `transfer_details: ${tdErr.message}` : null,
      abErr ? `account_balances: ${abErr.message}` : null,
      txdErr ? `transaction_details: ${txdErr.message}` : null,
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
  const accountFixtures = [];
  let mainSuiteCompleted = false;

  try {
    // 1. Authentication
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

    // Setup User A accounts: A1 (VND, 1,000,000), A2 (VND, 500,000), A3 (USD, 100)
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
    accountFixtures.push({ client: clientA, id: accountA1.id });

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
    accountFixtures.push({ client: clientA, id: accountA2.id });

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
    accountFixtures.push({ client: clientA, id: accountA3.id });

    // Setup User B accounts: B1 (VND, 2,000,000), B2 (VND, 1,000,000), B3 (USD, 50)
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
    accountFixtures.push({ client: clientB, id: accountB1.id });

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
    accountFixtures.push({ client: clientB, id: accountB2.id });

    const { data: accountB3, error: accountB3Error } = await clientB
      .from('accounts')
      .insert({
        user_id: uidB,
        name: `P5_${suffix}_B3_USD`,
        type: 'BANK',
        currency_code: 'USD',
        opening_balance: '50.0000',
        color: '#ec4899',
      })
      .select('*')
      .single();
    assert(!accountB3Error && accountB3, `B3 account setup failed: ${accountB3Error?.message}`);
    accountFixtures.push({ client: clientB, id: accountB3.id });

    // 2. User A Full Transfer Lifecycle & Combined Net Worth Neutrality
    const balA1_init = await readBalance(clientA, accountA1.id);
    const balA2_init = await readBalance(clientA, accountA2.id);
    assert(balA1_init.current_balance === '1000000.0000', 'A1 initial balance mismatch');
    assert(balA2_init.current_balance === '500000.0000', 'A2 initial balance mismatch');
    const initialNetWorthA_VND = toScaledBigInt(balA1_init.current_balance) + toScaledBigInt(balA2_init.current_balance);
    assert(initialNetWorthA_VND === 15000000000n, 'A1 + A2 initial sum must equal 1,500,000.0000 VND (scaled)');

    // 2a. Create Transfer A: 200,000 VND from A1 -> A2
    const { data: transferA, error: transferAError } = await clientA
      .from('transfers')
      .insert({
        user_id: uidA,
        from_account_id: accountA1.id,
        to_account_id: accountA2.id,
        amount: '200000.0000',
        currency_code: 'VND',
        note: 'User A initial transfer 200k',
        occurred_on: today,
      })
      .select('id')
      .single();
    assert(!transferAError && transferA, `A transfer insert failed: ${transferAError?.message}`);
    transferFixtures.push({ client: clientA, id: transferA.id });

    const detailA = await readTransferDetail(clientA, transferA.id);
    assert(detailA.amount === '200000.0000', 'A transfer amount read-back mismatch');
    assert(detailA.from_account_name === accountA1.name, 'A from_account_name mismatch');
    assert(detailA.to_account_name === accountA2.name, 'A to_account_name mismatch');
    assert(detailA.from_account_type === accountA1.type, 'A from_account_type mismatch');
    assert(detailA.to_account_type === accountA2.type, 'A to_account_type mismatch');
    assert(detailA.currency_code === 'VND', 'A currency_code mismatch');
    assert(detailA.is_voided === false, 'A is_voided must be false');

    const balA1_afterT1 = await readBalance(clientA, accountA1.id);
    const balA2_afterT1 = await readBalance(clientA, accountA2.id);
    assert(balA1_afterT1.current_balance === '800000.0000', 'A1 balance after 200k transfer mismatch');
    assert(balA2_afterT1.current_balance === '700000.0000', 'A2 balance after 200k transfer mismatch');
    const netWorthA_afterT1 = toScaledBigInt(balA1_afterT1.current_balance) + toScaledBigInt(balA2_afterT1.current_balance);
    assert(netWorthA_afterT1 === initialNetWorthA_VND, 'A net worth must be invariant after transfer create');

    // 2b. Edit Transfer A: 200,000 -> 300,000 VND
    const { error: updateAError } = await clientA
      .from('transfers')
      .update({ amount: '300000.0000', note: 'User A updated transfer 300k' })
      .eq('id', transferA.id)
      .select('id')
      .single();
    assert(!updateAError, `A transfer update failed: ${updateAError?.message}`);
    const detailA_up = await readTransferDetail(clientA, transferA.id);
    assert(detailA_up.amount === '300000.0000' && detailA_up.note === 'User A updated transfer 300k', 'A transfer update read-back mismatch');

    const balA1_afterUp = await readBalance(clientA, accountA1.id);
    const balA2_afterUp = await readBalance(clientA, accountA2.id);
    assert(balA1_afterUp.current_balance === '700000.0000', 'A1 balance after transfer update mismatch');
    assert(balA2_afterUp.current_balance === '800000.0000', 'A2 balance after transfer update mismatch');
    const netWorthA_afterUp = toScaledBigInt(balA1_afterUp.current_balance) + toScaledBigInt(balA2_afterUp.current_balance);
    assert(netWorthA_afterUp === initialNetWorthA_VND, 'A net worth must be invariant after transfer update');

    // 2c. Void Transfer A: is_voided = true
    const { error: voidAError } = await clientA
      .from('transfers')
      .update({ is_voided: true })
      .eq('id', transferA.id)
      .select('id')
      .single();
    assert(!voidAError, `A transfer void failed: ${voidAError?.message}`);
    assert((await readTransferDetail(clientA, transferA.id)).is_voided === true, 'A transfer void status mismatch');

    const balA1_afterVoid = await readBalance(clientA, accountA1.id);
    const balA2_afterVoid = await readBalance(clientA, accountA2.id);
    assert(balA1_afterVoid.current_balance === '1000000.0000', 'A1 balance after void mismatch');
    assert(balA2_afterVoid.current_balance === '500000.0000', 'A2 balance after void mismatch');
    const netWorthA_afterVoid = toScaledBigInt(balA1_afterVoid.current_balance) + toScaledBigInt(balA2_afterVoid.current_balance);
    assert(netWorthA_afterVoid === initialNetWorthA_VND, 'A net worth must be invariant after transfer void');

    // 2d. Restore Transfer A: is_voided = false
    const { error: restoreAError } = await clientA
      .from('transfers')
      .update({ is_voided: false })
      .eq('id', transferA.id)
      .select('id')
      .single();
    assert(!restoreAError, `A transfer restore failed: ${restoreAError?.message}`);
    assert((await readTransferDetail(clientA, transferA.id)).is_voided === false, 'A transfer restore status mismatch');

    const balA1_afterRestore = await readBalance(clientA, accountA1.id);
    const balA2_afterRestore = await readBalance(clientA, accountA2.id);
    assert(balA1_afterRestore.current_balance === '700000.0000', 'A1 balance after restore mismatch');
    assert(balA2_afterRestore.current_balance === '800000.0000', 'A2 balance after restore mismatch');
    const netWorthA_afterRestore = toScaledBigInt(balA1_afterRestore.current_balance) + toScaledBigInt(balA2_afterRestore.current_balance);
    assert(netWorthA_afterRestore === initialNetWorthA_VND, 'A net worth must be invariant after transfer restore');
    pass('USER_A_TRANSFER_LIFECYCLE_AND_NET_WORTH_NEUTRALITY');

    // 3. User B Full Transfer Lifecycle & Combined Net Worth Neutrality
    const balB1_init = await readBalance(clientB, accountB1.id);
    const balB2_init = await readBalance(clientB, accountB2.id);
    assert(balB1_init.current_balance === '2000000.0000', 'B1 initial balance mismatch');
    assert(balB2_init.current_balance === '1000000.0000', 'B2 initial balance mismatch');
    const initialNetWorthB_VND = toScaledBigInt(balB1_init.current_balance) + toScaledBigInt(balB2_init.current_balance);
    assert(initialNetWorthB_VND === 30000000000n, 'B1 + B2 initial sum must equal 3,000,000.0000 VND (scaled)');

    // 3a. Create Transfer B: 500,000 VND from B1 -> B2
    const { data: transferB, error: transferBError } = await clientB
      .from('transfers')
      .insert({
        user_id: uidB,
        from_account_id: accountB1.id,
        to_account_id: accountB2.id,
        amount: '500000.0000',
        currency_code: 'VND',
        note: 'User B initial transfer 500k',
        occurred_on: today,
      })
      .select('id')
      .single();
    assert(!transferBError && transferB, `B transfer insert failed: ${transferBError?.message}`);
    transferFixtures.push({ client: clientB, id: transferB.id });

    const detailB = await readTransferDetail(clientB, transferB.id);
    assert(detailB.amount === '500000.0000', 'B transfer amount read-back mismatch');
    assert(detailB.from_account_name === accountB1.name, 'B from_account_name mismatch');
    assert(detailB.to_account_name === accountB2.name, 'B to_account_name mismatch');
    assert(detailB.currency_code === 'VND', 'B currency_code mismatch');
    assert(detailB.is_voided === false, 'B is_voided must be false');

    const balB1_afterT1 = await readBalance(clientB, accountB1.id);
    const balB2_afterT1 = await readBalance(clientB, accountB2.id);
    assert(balB1_afterT1.current_balance === '1500000.0000', 'B1 balance after 500k transfer mismatch');
    assert(balB2_afterT1.current_balance === '1500000.0000', 'B2 balance after 500k transfer mismatch');
    const netWorthB_afterT1 = toScaledBigInt(balB1_afterT1.current_balance) + toScaledBigInt(balB2_afterT1.current_balance);
    assert(netWorthB_afterT1 === initialNetWorthB_VND, 'B net worth must be invariant after transfer create');

    // 3b. Edit Transfer B: 500,000 -> 700,000 VND
    const { error: updateBError } = await clientB
      .from('transfers')
      .update({ amount: '700000.0000', note: 'User B updated transfer 700k' })
      .eq('id', transferB.id)
      .select('id')
      .single();
    assert(!updateBError, `B transfer update failed: ${updateBError?.message}`);
    const detailB_up = await readTransferDetail(clientB, transferB.id);
    assert(detailB_up.amount === '700000.0000' && detailB_up.note === 'User B updated transfer 700k', 'B transfer update read-back mismatch');

    const balB1_afterUp = await readBalance(clientB, accountB1.id);
    const balB2_afterUp = await readBalance(clientB, accountB2.id);
    assert(balB1_afterUp.current_balance === '1300000.0000', 'B1 balance after transfer update mismatch');
    assert(balB2_afterUp.current_balance === '1700000.0000', 'B2 balance after transfer update mismatch');
    const netWorthB_afterUp = toScaledBigInt(balB1_afterUp.current_balance) + toScaledBigInt(balB2_afterUp.current_balance);
    assert(netWorthB_afterUp === initialNetWorthB_VND, 'B net worth must be invariant after transfer update');

    // 3c. Void Transfer B: is_voided = true
    const { error: voidBError } = await clientB
      .from('transfers')
      .update({ is_voided: true })
      .eq('id', transferB.id)
      .select('id')
      .single();
    assert(!voidBError, `B transfer void failed: ${voidBError?.message}`);
    assert((await readTransferDetail(clientB, transferB.id)).is_voided === true, 'B transfer void status mismatch');

    const balB1_afterVoid = await readBalance(clientB, accountB1.id);
    const balB2_afterVoid = await readBalance(clientB, accountB2.id);
    assert(balB1_afterVoid.current_balance === '2000000.0000', 'B1 balance after void mismatch');
    assert(balB2_afterVoid.current_balance === '1000000.0000', 'B2 balance after void mismatch');
    const netWorthB_afterVoid = toScaledBigInt(balB1_afterVoid.current_balance) + toScaledBigInt(balB2_afterVoid.current_balance);
    assert(netWorthB_afterVoid === initialNetWorthB_VND, 'B net worth must be invariant after transfer void');

    // 3d. Restore Transfer B: is_voided = false
    const { error: restoreBError } = await clientB
      .from('transfers')
      .update({ is_voided: false })
      .eq('id', transferB.id)
      .select('id')
      .single();
    assert(!restoreBError, `B transfer restore failed: ${restoreBError?.message}`);
    assert((await readTransferDetail(clientB, transferB.id)).is_voided === false, 'B transfer restore status mismatch');

    const balB1_afterRestore = await readBalance(clientB, accountB1.id);
    const balB2_afterRestore = await readBalance(clientB, accountB2.id);
    assert(balB1_afterRestore.current_balance === '1300000.0000', 'B1 balance after restore mismatch');
    assert(balB2_afterRestore.current_balance === '1700000.0000', 'B2 balance after restore mismatch');
    const netWorthB_afterRestore = toScaledBigInt(balB1_afterRestore.current_balance) + toScaledBigInt(balB2_afterRestore.current_balance);
    assert(netWorthB_afterRestore === initialNetWorthB_VND, 'B net worth must be invariant after transfer restore');
    pass('USER_B_TRANSFER_LIFECYCLE_AND_NET_WORTH_NEUTRALITY');

    // 4. Bidirectional Cross-User Isolation Matrix (A -> B and B -> A)
    // 4a. Spoofed foreign user_id INSERT blocked
    const { error: spoofAfromB } = await clientB.from('transfers').insert({
      user_id: uidA,
      from_account_id: accountB1.id,
      to_account_id: accountB2.id,
      amount: '10000.0000',
      currency_code: 'VND',
      occurred_on: today,
    });
    assert(spoofAfromB, 'B spoofed user_id = User A on insert');

    const { error: spoofBfromA } = await clientA.from('transfers').insert({
      user_id: uidB,
      from_account_id: accountA1.id,
      to_account_id: accountA2.id,
      amount: '10000.0000',
      currency_code: 'VND',
      occurred_on: today,
    });
    assert(spoofBfromA, 'A spoofed user_id = User B on insert');

    // 4b. Foreign source-account reference blocked
    const { error: crossSourceBA } = await clientB.from('transfers').insert({
      user_id: uidB,
      from_account_id: accountA1.id,
      to_account_id: accountB2.id,
      amount: '10000.0000',
      currency_code: 'VND',
      occurred_on: today,
    });
    assert(crossSourceBA, 'B inserted transfer referencing A source account');

    const { error: crossSourceAB } = await clientA.from('transfers').insert({
      user_id: uidA,
      from_account_id: accountB1.id,
      to_account_id: accountA2.id,
      amount: '10000.0000',
      currency_code: 'VND',
      occurred_on: today,
    });
    assert(crossSourceAB, 'A inserted transfer referencing B source account');

    // 4c. Foreign destination-account reference blocked
    const { error: crossDestBA } = await clientB.from('transfers').insert({
      user_id: uidB,
      from_account_id: accountB1.id,
      to_account_id: accountA2.id,
      amount: '10000.0000',
      currency_code: 'VND',
      occurred_on: today,
    });
    assert(crossDestBA, 'B inserted transfer referencing A destination account');

    const { error: crossDestAB } = await clientA.from('transfers').insert({
      user_id: uidA,
      from_account_id: accountA1.id,
      to_account_id: accountB2.id,
      amount: '10000.0000',
      currency_code: 'VND',
      occurred_on: today,
    });
    assert(crossDestAB, 'A inserted transfer referencing B destination account');

    // 4d. Foreign SELECT returns RLS-empty without database error
    await assertCrossSelectEmpty(clientB, 'transfers', transferA.id, 'B querying transfer A');
    await assertCrossSelectEmpty(clientA, 'transfers', transferB.id, 'A querying transfer B');

    // 4e. transfer_details view does not leak foreign transfers
    await assertCrossSelectEmpty(clientB, 'transfer_details', transferA.id, 'B querying transfer_details A');
    await assertCrossSelectEmpty(clientA, 'transfer_details', transferB.id, 'A querying transfer_details B');

    // 4f. account_balances view does not leak foreign accounts
    await assertCrossBalanceEmpty(clientB, accountA1.id, 'B querying account_balances A1');
    await assertCrossBalanceEmpty(clientA, accountB1.id, 'A querying account_balances B1');

    // 4g. Foreign UPDATE cannot change the row (note or void state)
    await clientB.from('transfers').update({ note: 'HACKED_BY_B' }).eq('id', transferA.id);
    await clientA.from('transfers').update({ note: 'HACKED_BY_A' }).eq('id', transferB.id);
    assert((await readTransferDetail(clientA, transferA.id)).note !== 'HACKED_BY_B', 'B mutated A transfer note');
    assert((await readTransferDetail(clientB, transferB.id)).note !== 'HACKED_BY_A', 'A mutated B transfer note');

    await clientB.from('transfers').update({ is_voided: true }).eq('id', transferA.id);
    await clientA.from('transfers').update({ is_voided: true }).eq('id', transferB.id);
    assert((await readTransferDetail(clientA, transferA.id)).is_voided === false, 'B voided A transfer');
    assert((await readTransferDetail(clientB, transferB.id)).is_voided === false, 'A voided B transfer');

    // 4h. Ownership mutation blocked
    const { error: userMutationAtoB } = await clientA
      .from('transfers')
      .update({ user_id: uidB })
      .eq('id', transferA.id);
    assert(userMutationAtoB, 'A mutated transfer user_id to B');

    const { error: userMutationBtoA } = await clientB
      .from('transfers')
      .update({ user_id: uidA })
      .eq('id', transferB.id);
    assert(userMutationBtoA, 'B mutated transfer user_id to A');
    pass('CROSS_USER_ISOLATION_AND_SPOOFING_BLOCKED');

    // 5. Domain & Integrity Rejection Cases
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
    pass('DOMAIN_AND_INTEGRITY_REJECTIONS');

    // 6. Phase 4 Non-Regression: Transactions + Transfers Co-Derivation with Exact View Read
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

    // Read back via transaction_details view and assert exact string amount and semantics
    const txDetail = await readTransactionDetail(clientA, txA.id);
    assert(typeof txDetail.amount === 'string', 'transaction_details.amount must be text');
    assert(txDetail.amount === '100000.0000', 'transaction_details amount mismatch');
    assert(txDetail.type === 'EXPENSE', 'transaction_details type mismatch');
    assert(txDetail.is_voided === false, 'transaction_details is_voided must be false');

    // Verify account balance derivation reflects BOTH transaction and transfer:
    // A1 = opening (1,000,000) - transfer out (300,000) - expense tx (100,000) = 600,000.0000 VND
    const balA1_withTx = await readBalance(clientA, accountA1.id);
    assert(balA1_withTx.current_balance === '600000.0000', 'A1 balance with combined tx + transfer mismatch');

    // A2 balance remains unchanged at 800,000.0000 VND
    const balA2_withTx = await readBalance(clientA, accountA2.id);
    assert(balA2_withTx.current_balance === '800000.0000', 'A2 balance must be unaffected by transaction on A1');

    // Voiding transaction restores A1 to 700,000.0000 VND without corrupting transfer impact
    const { error: voidTxError } = await clientA
      .from('transactions')
      .update({ is_voided: true })
      .eq('id', txA.id)
      .select('id')
      .single();
    assert(!voidTxError, `Phase 4 transaction void failed: ${voidTxError?.message}`);

    const txDetailVoided = await readTransactionDetail(clientA, txA.id);
    assert(txDetailVoided.is_voided === true, 'transaction_details is_voided must be true after void');

    const balA1_afterVoidTx = await readBalance(clientA, accountA1.id);
    assert(balA1_afterVoidTx.current_balance === '700000.0000', 'A1 balance after voiding tx mismatch');
    pass('PHASE_4_NON_REGRESSION_AND_CO_DERIVATION');

    mainSuiteCompleted = true;
  } finally {
    // Fail-closed cleanup: every fixture must succeed or throw
    for (const fixture of transactionFixtures) {
      await voidTransactionDirect(fixture.client, fixture.id);
    }
    for (const fixture of transferFixtures) {
      await voidTransferDirect(fixture.client, fixture.id);
    }
    for (const fixture of accountFixtures) {
      await archiveAccountDirect(fixture.client, fixture.id);
    }

    if (mainSuiteCompleted) {
      pass('TEST_RECORD_CLEANUP');
    }
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
