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

async function run() {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const today = new Date().toISOString().slice(0, 10);

  const transferFixtures = [];
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

    // Setup User A accounts (2 VND accounts)
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

    // Setup User B accounts (2 VND accounts)
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

    // Verify initial balances
    assert((await readBalance(clientA, accountA1.id)).current_balance === '1000000.0000', 'A1 initial balance mismatch');
    assert((await readBalance(clientA, accountA2.id)).current_balance === '500000.0000', 'A2 initial balance mismatch');

    // User A creates a transfer: 300,000 VND from A1 to A2
    const { data: transferA, error: transferAError } = await clientA
      .from('transfers')
      .insert({
        user_id: uidA,
        from_account_id: accountA1.id,
        to_account_id: accountA2.id,
        amount: '300000.0000',
        currency_code: 'VND',
        note: 'A transfer lifecycle test',
        occurred_on: today,
      })
      .select('id')
      .single();
    assert(!transferAError && transferA, `A transfer insert failed: ${transferAError?.message}`);
    transferFixtures.push({ client: clientA, id: transferA.id });

    const detailA = await readTransferDetail(clientA, transferA.id);
    assert(detailA.amount === '300000.0000', 'A exact transfer amount read-back mismatch');
    assert(detailA.from_account_name === accountA1.name, 'A from_account_name mismatch');
    assert(detailA.to_account_name === accountA2.name, 'A to_account_name mismatch');
    assert(detailA.currency_code === 'VND', 'A currency_code mismatch');

    // Balance verification: A1 decreased by 300k, A2 increased by 300k
    assert((await readBalance(clientA, accountA1.id)).current_balance === '700000.0000', 'A1 balance after transfer mismatch');
    assert((await readBalance(clientA, accountA2.id)).current_balance === '800000.0000', 'A2 balance after transfer mismatch');

    // Update transfer: Change amount to 400,000 VND
    const { error: updateAError } = await clientA
      .from('transfers')
      .update({ amount: '400000.0000', note: 'A transfer updated' })
      .eq('id', transferA.id)
      .select('id')
      .single();
    assert(!updateAError, `A own transfer update failed: ${updateAError?.message}`);
    const updatedA = await readTransferDetail(clientA, transferA.id);
    assert(updatedA.amount === '400000.0000' && updatedA.note === 'A transfer updated', 'A transfer update read-back failed');
    assert((await readBalance(clientA, accountA1.id)).current_balance === '600000.0000', 'A1 balance after transfer update mismatch');
    assert((await readBalance(clientA, accountA2.id)).current_balance === '900000.0000', 'A2 balance after transfer update mismatch');

    // Void transfer: is_voided = true
    const { error: voidAError } = await clientA
      .from('transfers')
      .update({ is_voided: true })
      .eq('id', transferA.id)
      .select('id')
      .single();
    assert(!voidAError, `A transfer void failed: ${voidAError?.message}`);
    assert((await readTransferDetail(clientA, transferA.id)).is_voided === true, 'A transfer void read-back failed');
    // Balance restored to original opening balance
    assert((await readBalance(clientA, accountA1.id)).current_balance === '1000000.0000', 'A1 balance after void mismatch');
    assert((await readBalance(clientA, accountA2.id)).current_balance === '500000.0000', 'A2 balance after void mismatch');

    // Restore transfer: is_voided = false
    const { error: restoreAError } = await clientA
      .from('transfers')
      .update({ is_voided: false })
      .eq('id', transferA.id)
      .select('id')
      .single();
    assert(!restoreAError, `A transfer restore failed: ${restoreAError?.message}`);
    assert((await readTransferDetail(clientA, transferA.id)).is_voided === false, 'A transfer restore read-back failed');
    assert((await readBalance(clientA, accountA1.id)).current_balance === '600000.0000', 'A1 balance after restore mismatch');
    assert((await readBalance(clientA, accountA2.id)).current_balance === '900000.0000', 'A2 balance after restore mismatch');
    pass('USER_A_OWN_TRANSFER_LIFECYCLE');

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

    assert((await readTransferDetail(clientB, transferB.id)).amount === '500000.0000', 'B exact transfer amount read-back mismatch');
    assert((await readBalance(clientB, accountB1.id)).current_balance === '1500000.0000', 'B1 balance after transfer mismatch');
    assert((await readBalance(clientB, accountB2.id)).current_balance === '1500000.0000', 'B2 balance after transfer mismatch');

    const { error: updateBError } = await clientB
      .from('transfers')
      .update({ amount: '600000.0000', note: 'B updated' })
      .eq('id', transferB.id)
      .select('id')
      .single();
    assert(!updateBError, `B own transfer update failed: ${updateBError?.message}`);
    assert((await readBalance(clientB, accountB1.id)).current_balance === '1400000.0000', 'B1 balance after update mismatch');
    assert((await readBalance(clientB, accountB2.id)).current_balance === '1600000.0000', 'B2 balance after update mismatch');

    const { error: voidBError } = await clientB
      .from('transfers')
      .update({ is_voided: true })
      .eq('id', transferB.id)
      .select('id')
      .single();
    assert(!voidBError, `B transfer void failed: ${voidBError?.message}`);
    assert((await readBalance(clientB, accountB1.id)).current_balance === '2000000.0000', 'B1 balance after void mismatch');
    assert((await readBalance(clientB, accountB2.id)).current_balance === '1000000.0000', 'B2 balance after void mismatch');

    const { error: restoreBError } = await clientB
      .from('transfers')
      .update({ is_voided: false })
      .eq('id', transferB.id)
      .select('id')
      .single();
    assert(!restoreBError, `B transfer restore failed: ${restoreBError?.message}`);
    assert((await readBalance(clientB, accountB1.id)).current_balance === '1400000.0000', 'B1 balance after restore mismatch');
    assert((await readBalance(clientB, accountB2.id)).current_balance === '1600000.0000', 'B2 balance after restore mismatch');
    pass('USER_B_OWN_TRANSFER_LIFECYCLE');

    // Cross-user owned insert attempts
    const { error: aOwnsBInsertError } = await clientA.from('transfers').insert({
      user_id: uidB,
      from_account_id: accountB1.id,
      to_account_id: accountB2.id,
      amount: '10000.0000',
      currency_code: 'VND',
      occurred_on: today,
    });
    assert(aOwnsBInsertError, 'A inserted a transfer owned by B');

    const { error: bOwnsAInsertError } = await clientB.from('transfers').insert({
      user_id: uidA,
      from_account_id: accountA1.id,
      to_account_id: accountA2.id,
      amount: '10000.0000',
      currency_code: 'VND',
      occurred_on: today,
    });
    assert(bOwnsAInsertError, 'B inserted a transfer owned by A');
    pass('CROSS_USER_OWNED_INSERT_BLOCKED');

    // Cross-user account reference attempts
    const crossAccountCases = [
      [clientA, uidA, accountA1.id, accountB1.id, 'A uses B as destination'],
      [clientA, uidA, accountB1.id, accountA1.id, 'A uses B as source'],
      [clientA, uidA, accountB1.id, accountB2.id, 'A uses B for both source and destination'],
      [clientB, uidB, accountB1.id, accountA1.id, 'B uses A as destination'],
      [clientB, uidB, accountA1.id, accountB1.id, 'B uses A as source'],
      [clientB, uidB, accountA1.id, accountA2.id, 'B uses A for both source and destination'],
    ];
    for (const [client, userId, fromId, toId, label] of crossAccountCases) {
      const { error } = await client.from('transfers').insert({
        user_id: userId,
        from_account_id: fromId,
        to_account_id: toId,
        amount: '10000.0000',
        currency_code: 'VND',
        occurred_on: today,
      });
      assert(error, `${label}: composite ownership FK did not block transfer insert`);
    }
    pass('CROSS_USER_ACCOUNT_REFERENCES_BLOCKED');

    // Cross-user SELECT blocked
    await assertCrossSelectEmpty(clientB, transferA.id, 'B->A');
    await assertCrossSelectEmpty(clientA, transferB.id, 'A->B');
    pass('CROSS_USER_SELECT_BLOCKED');

    // Cross-user UPDATE blocked
    await clientB.from('transfers').update({ note: 'HACKED_BY_B' }).eq('id', transferA.id);
    await clientA.from('transfers').update({ note: 'HACKED_BY_A' }).eq('id', transferB.id);
    assert((await readTransferDetail(clientA, transferA.id)).note !== 'HACKED_BY_B', 'B updated A transfer');
    assert((await readTransferDetail(clientB, transferB.id)).note !== 'HACKED_BY_A', 'A updated B transfer');
    pass('CROSS_USER_UPDATE_BLOCKED');

    // Ownership change blocked
    const { error: ownershipMutationA } = await clientA
      .from('transfers')
      .update({ user_id: uidB })
      .eq('id', transferA.id);
    const { error: ownershipMutationB } = await clientB
      .from('transfers')
      .update({ user_id: uidA })
      .eq('id', transferB.id);
    assert(ownershipMutationA && ownershipMutationB, 'transfer user_id mutation was not blocked for both users');
    pass('OWNERSHIP_CHANGE_BLOCKED');

    // Domain integrity constraints
    const invalidCases = [
      {
        label: 'same from and to account',
        client: clientA,
        row: { user_id: uidA, from_account_id: accountA1.id, to_account_id: accountA1.id, amount: '10000.0000', currency_code: 'VND', occurred_on: today },
      },
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
        label: 'currency mismatch',
        client: clientA,
        row: { user_id: uidA, from_account_id: accountA1.id, to_account_id: accountA2.id, amount: '10.0000', currency_code: 'USD', occurred_on: today },
      },
    ];
    for (const testCase of invalidCases) {
      const { error } = await testCase.client.from('transfers').insert(testCase.row);
      assert(error, `${testCase.label}: invalid transfer was accepted`);
    }
    pass('DOMAIN_INTEGRITY_CONSTRAINTS');

    // Direct DELETE blocked
    const { error: deleteOwnA } = await clientA.from('transfers').delete().eq('id', transferA.id);
    const { error: deleteOwnB } = await clientB.from('transfers').delete().eq('id', transferB.id);
    assert(deleteOwnA && deleteOwnB, 'normal clients received DELETE capability');
    assert((await readTransferDetail(clientA, transferA.id)).id === transferA.id, 'A transfer disappeared after blocked DELETE');
    assert((await readTransferDetail(clientB, transferB.id)).id === transferB.id, 'B transfer disappeared after blocked DELETE');
    pass('DELETE_BLOCKED');

    // Security invoker view isolation
    const { data: allTransfersA, error: allTransfersAError } = await clientA.from('transfer_details').select('id,user_id');
    const { data: allTransfersB, error: allTransfersBError } = await clientB.from('transfer_details').select('id,user_id');
    assert(!allTransfersAError && allTransfersA?.every((row) => row.user_id === uidA), 'transfer_details leaked rows to A');
    assert(!allTransfersBError && allTransfersB?.every((row) => row.user_id === uidB), 'transfer_details leaked rows to B');

    const { data: crossTransferBA, error: crossTransferBAError } = await clientB.from('transfer_details').select('id').eq('id', transferA.id);
    const { data: crossTransferAB, error: crossTransferABError } = await clientA.from('transfer_details').select('id').eq('id', transferB.id);
    assert(!crossTransferBAError && crossTransferBA?.length === 0, 'transfer_details leaked A row to B');
    assert(!crossTransferABError && crossTransferAB?.length === 0, 'transfer_details leaked B row to A');

    const { data: crossBalanceBA, error: crossBalanceBAError } = await clientB.from('account_balances').select('account_id').eq('account_id', accountA1.id);
    const { data: crossBalanceAB, error: crossBalanceABError } = await clientA.from('account_balances').select('account_id').eq('account_id', accountB1.id);
    assert(!crossBalanceBAError && crossBalanceBA?.length === 0, 'account_balances leaked A row to B');
    assert(!crossBalanceABError && crossBalanceAB?.length === 0, 'account_balances leaked B row to A');
    pass('SECURITY_INVOKER_VIEW_ISOLATION');

    // Deliberate DB error distinction
    const { error: deliberateDatabaseError } = await clientA
      .from('transfers')
      .select('id')
      .eq('id', 'not-a-valid-uuid');
    assert(deliberateDatabaseError, 'deliberate normal database error was not distinguishable from an RLS-empty result');
    pass('DELIBERATE_DATABASE_ERROR');
  } finally {
    cleanupStarted = true;

    for (const fixture of transferFixtures) {
      await voidTransferFixture(fixture.client, fixture.id);
    }
    for (const fixture of archiveFixtures) {
      await archiveFixture(fixture.client, fixture.table, fixture.id);
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
