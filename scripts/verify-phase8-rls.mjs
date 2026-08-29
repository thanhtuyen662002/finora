import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const userAEmail = process.env.TEST_USER_A_EMAIL;
const userAPassword = process.env.TEST_USER_A_PASSWORD;
const userBEmail = process.env.TEST_USER_B_EMAIL;
const userBPassword = process.env.TEST_USER_B_PASSWORD;

if (!supabaseUrl || !supabaseKey || !userAEmail || !userAPassword || !userBEmail || !userBPassword) {
  console.error("Missing environment variables for testing.");
  process.exit(1);
}

const supabaseA = createClient(supabaseUrl, supabaseKey);
const supabaseB = createClient(supabaseUrl, supabaseKey);

async function runTests() {
  console.log("Authenticating User A...");
  const authA = await supabaseA.auth.signInWithPassword({ email: userAEmail, password: userAPassword });
  if (authA.error) throw authA.error;

  console.log("Authenticating User B...");
  const authB = await supabaseB.auth.signInWithPassword({ email: userBEmail, password: userBPassword });
  if (authB.error) throw authB.error;

  const uidA = authA.data.user.id;
  const uidB = authB.data.user.id;

  if (uidA === uidB) {
    throw new Error("Users must be distinct");
  }

  console.log("Test 2: auto_fx_enabled");
  // User A read
  const { data: setA, error: errSetA } = await supabaseA.from('user_settings').select('*').eq('user_id', uidA).single();
  if (errSetA) throw errSetA;

  const origA = setA.auto_fx_enabled;

  // User A update
  const { error: errUpdateA } = await supabaseA.from('user_settings').update({ auto_fx_enabled: !origA }).eq('user_id', uidA);
  if (errUpdateA) throw errUpdateA;

  // Cross user read
  const { data: crossRead } = await supabaseB.from('user_settings').select('*').eq('user_id', uidA);
  if (crossRead && crossRead.length > 0) throw new Error("B read A settings");

  // Cross user update
  await supabaseB.from('user_settings').update({ auto_fx_enabled: origA }).eq('user_id', uidA);

  // Verify A still has the updated value
  const { data: checkA } = await supabaseA.from('user_settings').select('*').eq('user_id', uidA).single();
  if (checkA.auto_fx_enabled === origA) throw new Error("B updated A settings");

  // Restore
  await supabaseA.from('user_settings').update({ auto_fx_enabled: origA }).eq('user_id', uidA);

  console.log("Test 3-8: snapshot operations");
  const snapInsert = await supabaseA.from('transaction_fx_snapshots').insert({
    user_id: uidA,
    transaction_id: '00000000-0000-0000-0000-000000000000',
    source_currency_code: 'USD',
    target_currency_code: 'VND',
    source_amount: 1,
    rate: 25000,
    converted_amount: 25000,
    requested_date: '2023-01-01',
    effective_date: '2023-01-01',
    provider: 'Test'
  });
  if (!snapInsert.error) throw new Error("Insert should be denied");

  const snapUpdate = await supabaseA.from('transaction_fx_snapshots').update({ rate: 26000 }).eq('user_id', uidA);
  if (!snapUpdate.error) throw new Error("Update should be denied");

  const snapDel = await supabaseA.from('transaction_fx_snapshots').delete().eq('user_id', uidA);
  if (!snapDel.error) throw new Error("Delete should be denied");

  const { data: snapsB } = await supabaseA.from('transaction_fx_snapshots').select('*').eq('user_id', uidB);
  if (snapsB && snapsB.length > 0) throw new Error("A read B snaps");

  console.log("Test 9-11: Phase 4 & 5 non-regression");
  const { data: accountsA } = await supabaseA.from('accounts').select('*').limit(1);
  if (!accountsA) throw new Error("Could not fetch accounts");

  console.log("All RLS tests passed");
}

runTests().catch(e => {
  console.error("Test failed", e);
  process.exit(1);
});
