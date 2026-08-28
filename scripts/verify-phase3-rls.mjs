import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const USER_A_EMAIL = process.env.FINORA_TEST_USER_A_EMAIL;
const USER_A_PASSWORD = process.env.FINORA_TEST_USER_A_PASSWORD;

const USER_B_EMAIL = process.env.FINORA_TEST_USER_B_EMAIL;
const USER_B_PASSWORD = process.env.FINORA_TEST_USER_B_PASSWORD;

console.log('=== FINORA PHASE 3 — TWO-USER RLS VERIFICATION ===');

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.error('❌ FAIL: Missing required environment variables.');
  process.exit(1);
}

if (!USER_A_EMAIL || !USER_A_PASSWORD || !USER_B_EMAIL || !USER_B_PASSWORD) {
  console.error('❌ BLOCKED: Missing test user credentials.');
  process.exit(1);
}

function isMissingTableError(err) {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const code = err.code || '';
  return code === '42P01' || code === 'PGRST200' || code === 'PGRST205' || msg.includes('does not exist');
}

async function run() {
  const clientA = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const clientB = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

  console.log('Authenticating users...');
  const { data: authA, error: errAuthA } = await clientA.auth.signInWithPassword({ email: USER_A_EMAIL, password: USER_A_PASSWORD });
  const { data: authB, error: errAuthB } = await clientB.auth.signInWithPassword({ email: USER_B_EMAIL, password: USER_B_PASSWORD });

  if (errAuthA || errAuthB) {
    console.error('❌ FAIL: Auth failed', errAuthA, errAuthB);
    process.exit(1);
  }

  const userIdA = authA.user.id;
  const userIdB = authB.user.id;
  console.log(`User A: ${userIdA}`);
  console.log(`User B: ${userIdB}\n`);

  let hasError = false;
  let testAccountA = null;
  let testAccountB = null;
  let testCategoryA = null;
  let testCategoryB = null;

  try {
    // ---------------------------------------------------------
    // 0. DELIBERATE ERROR TEST
    // ---------------------------------------------------------
    console.log('[1/5] Testing deliberate normal database error...');
    const { error: errDeliberate } = await clientA.from('accounts').insert({
      user_id: userIdA,
      name: 'Test',
      type: 'INVALID_TYPE', // this will violate check constraint
      currency_code: 'VND'
    });
    if (!errDeliberate) {
       console.error('❌ FAIL: Deliberate check-constraint violation did not error!');
       hasError = true;
    } else if (errDeliberate.code === '23514' || errDeliberate.message.includes('check_constraint') || errDeliberate.message.includes('type')) {
       console.log('✔ Correctly caught normal database error (check constraint).');
    } else {
       console.error('❌ FAIL: Deliberate error returned unexpected type:', errDeliberate);
       hasError = true;
    }

    // ---------------------------------------------------------
    // 1. ACCOUNTS TESTS
    // ---------------------------------------------------------
    console.log('\n[2/5] Testing Accounts RLS...');

    // A insert own account
    const { data: newAccA, error: errNewAccA } = await clientA.from('accounts').insert({
      user_id: userIdA,
      name: 'Test Account A',
      type: 'CASH',
      currency_code: 'VND',
      opening_balance: 1000000,
      color: '#111111'
    }).select('*').single();

    if (errNewAccA) {
      if (isMissingTableError(errNewAccA)) {
        console.error('❌ BLOCKED: Remote database not migrated yet. Please apply migration to Supabase.');
        process.exit(2);
      }
      console.error('❌ FAIL: User A could not insert own account.', errNewAccA);
      hasError = true;
    } else {
      console.log('✔ User A successfully inserted own account.');
      testAccountA = newAccA.id;
    }

    // B insert own account
    const { data: newAccB, error: errNewAccB } = await clientB.from('accounts').insert({
      user_id: userIdB,
      name: 'Test Account B',
      type: 'BANK',
      currency_code: 'USD',
      opening_balance: 500,
      color: '#222222'
    }).select('*').single();

    if (errNewAccB) {
      console.error('❌ FAIL: User B could not insert own account.', errNewAccB);
      hasError = true;
    } else {
      console.log('✔ User B successfully inserted own account.');
      testAccountB = newAccB.id;
    }

    if (testAccountA) {
      // A update own account
      const { data: aUpdateA, error: errAUpdateA } = await clientA.from('accounts').update({ name: 'Test Account A Updated' }).eq('id', testAccountA).select();
      if (errAUpdateA || aUpdateA.length === 0) {
        console.error('❌ FAIL: User A could not update own account.', errAUpdateA);
        hasError = true;
      } else {
        console.log('✔ User A successfully updated own account.');
      }

      // A cannot update A's account to be owned by B
      const { data: aUpdateAOwner, error: errAUpdateAOwner } = await clientA.from('accounts').update({ user_id: userIdB }).eq('id', testAccountA).select();
      if (errAUpdateAOwner || aUpdateAOwner.length === 0) {
        console.log('✔ User A correctly blocked from changing ownership of own account.');
      } else {
        console.error('❌ FAIL: User A successfully changed ownership of own account! RLS violation.');
        hasError = true;
      }

      // B read A's account
      const { data: bReadA, error: errBReadA } = await clientB.from('accounts').select('*').eq('id', testAccountA);
      if (!errBReadA && bReadA.length > 0) {
        console.error('❌ FAIL: User B successfully read User A account! RLS violation.');
        hasError = true;
      } else {
        console.log('✔ User B correctly blocked from reading User A account.');
      }

      // B update A's account
      const { data: bUpdateA, error: errBUpdateA } = await clientB.from('accounts').update({ name: 'Hacked by B' }).eq('id', testAccountA).select();
      if (!errBUpdateA && bUpdateA.length > 0) {
        console.error('❌ FAIL: User B successfully updated User A account! RLS violation.');
        hasError = true;
      } else {
        console.log('✔ User B correctly blocked from updating User A account.');
      }
    }

    if (testAccountB) {
      // A read B's account
      const { data: aReadB, error: errAReadB } = await clientA.from('accounts').select('*').eq('id', testAccountB);
      if (!errAReadB && aReadB.length > 0) {
        console.error('❌ FAIL: User A successfully read User B account! RLS violation.');
        hasError = true;
      } else {
        console.log('✔ User A correctly blocked from reading User B account.');
      }

      // A update B's account
      const { data: aUpdateB, error: errAUpdateB } = await clientA.from('accounts').update({ name: 'Hacked by A' }).eq('id', testAccountB).select();
      if (!errAUpdateB && aUpdateB.length > 0) {
        console.error('❌ FAIL: User A successfully updated User B account! RLS violation.');
        hasError = true;
      } else {
        console.log('✔ User A correctly blocked from updating User B account.');
      }
    }

    // A insert for B
    const { error: errAInsertB } = await clientA.from('accounts').insert({
      user_id: userIdB,
      name: 'A inserting for B',
      type: 'CASH',
      currency_code: 'VND'
    });
    if (!errAInsertB) {
      console.error('❌ FAIL: User A successfully inserted an account for User B! RLS violation.');
      hasError = true;
    } else {
      console.log('✔ User A correctly blocked from inserting an account for User B.');
    }


    // ---------------------------------------------------------
    // 2. CATEGORIES TESTS
    // ---------------------------------------------------------
    console.log('\n[3/5] Testing Categories RLS...');
    
    // Check seeded categories visibility
    const { data: catsA, error: errCatsA } = await clientA.from('categories').select('*');
    if (errCatsA) {
      console.error('❌ FAIL: User A could not read categories.', errCatsA);
      hasError = true;
    } else {
      const foreignCats = catsA.filter(c => c.user_id !== userIdA);
      if (foreignCats.length > 0) {
        console.error('❌ FAIL: User A can see foreign categories! RLS violation.');
        hasError = true;
      } else {
        const hasAllDefaults = catsA.length >= 12;
        if (!hasAllDefaults) {
           console.error('❌ FAIL: User A does not see all 12 baseline categories. Found: ' + catsA.length);
           hasError = true;
        } else {
           console.log(`✔ User A successfully read own categories (count: ${catsA.length}, no foreign).`);
        }
      }
    }

    const { data: catsB, error: errCatsB } = await clientB.from('categories').select('*');
    if (errCatsB) {
      console.error('❌ FAIL: User B could not read categories.', errCatsB);
      hasError = true;
    } else {
      const foreignCats = catsB.filter(c => c.user_id !== userIdB);
      if (foreignCats.length > 0) {
        console.error('❌ FAIL: User B can see foreign categories! RLS violation.');
        hasError = true;
      } else {
        const hasAllDefaults = catsB.length >= 12;
        if (!hasAllDefaults) {
           console.error('❌ FAIL: User B does not see all 12 baseline categories. Found: ' + catsB.length);
           hasError = true;
        } else {
           console.log(`✔ User B successfully read own categories (count: ${catsB.length}, no foreign).`);
        }
      }
    }

    // A insert own category
    const { data: newCatA, error: errNewCatA } = await clientA.from('categories').insert({
      user_id: userIdA,
      name: 'Test Category A Verifier',
      type: 'EXPENSE',
      icon: 'Test',
      color: '#222222'
    }).select('*').single();

    if (errNewCatA) {
      console.error('❌ FAIL: User A could not insert own category.', errNewCatA);
      hasError = true;
    } else {
      console.log('✔ User A successfully inserted own category.');
      testCategoryA = newCatA.id;
    }

    // B insert own category
    const { data: newCatB, error: errNewCatB } = await clientB.from('categories').insert({
      user_id: userIdB,
      name: 'Test Category B Verifier',
      type: 'INCOME',
      icon: 'Test',
      color: '#333333'
    }).select('*').single();

    if (errNewCatB) {
      console.error('❌ FAIL: User B could not insert own category.', errNewCatB);
      hasError = true;
    } else {
      console.log('✔ User B successfully inserted own category.');
      testCategoryB = newCatB.id;
    }

    if (testCategoryA) {
       // A update own category
       const { data: aUpdateCatA, error: errAUpdateCatA } = await clientA.from('categories').update({ name: 'Test Category A Verifier Updated' }).eq('id', testCategoryA).select();
       if (errAUpdateCatA || aUpdateCatA.length === 0) {
         console.error('❌ FAIL: User A could not update own category.', errAUpdateCatA);
         hasError = true;
       } else {
         console.log('✔ User A successfully updated own category.');
       }
 
       // B read A's category
       const { data: bReadCatA, error: errBReadCatA } = await clientB.from('categories').select('*').eq('id', testCategoryA);
       if (!errBReadCatA && bReadCatA.length > 0) {
         console.error('❌ FAIL: User B successfully read User A category! RLS violation.');
         hasError = true;
       } else {
         console.log('✔ User B correctly blocked from reading User A category.');
       }
 
       // B update A's category
       const { data: bUpdateCatA, error: errBUpdateCatA } = await clientB.from('categories').update({ name: 'Hacked by B' }).eq('id', testCategoryA).select();
       if (!errBUpdateCatA && bUpdateCatA.length > 0) {
         console.error('❌ FAIL: User B successfully updated User A category! RLS violation.');
         hasError = true;
       } else {
         console.log('✔ User B correctly blocked from updating User A category.');
       }
    }

    if (testCategoryB) {
        // A read B's category
        const { data: aReadCatB, error: errAReadCatB } = await clientA.from('categories').select('*').eq('id', testCategoryB);
        if (!errAReadCatB && aReadCatB.length > 0) {
          console.error('❌ FAIL: User A successfully read User B category! RLS violation.');
          hasError = true;
        } else {
          console.log('✔ User A correctly blocked from reading User B category.');
        }
  
        // A update B's category
        const { data: aUpdateCatB, error: errAUpdateCatB } = await clientA.from('categories').update({ name: 'Hacked by A' }).eq('id', testCategoryB).select();
        if (!errAUpdateCatB && aUpdateCatB.length > 0) {
          console.error('❌ FAIL: User A successfully updated User B category! RLS violation.');
          hasError = true;
        } else {
          console.log('✔ User A correctly blocked from updating User B category.');
        }
    }

    // A insert for B
    const { error: errAInsertCatB } = await clientA.from('categories').insert({
      user_id: userIdB,
      name: 'A inserting for B',
      type: 'EXPENSE',
      icon: 'Test',
      color: '#333333'
    });
    if (!errAInsertCatB) {
      console.error('❌ FAIL: User A successfully inserted a category for User B! RLS violation.');
      hasError = true;
    } else {
      console.log('✔ User A correctly blocked from inserting a category for User B.');
    }

    // ---------------------------------------------------------
    // 3. CLEANUP
    // ---------------------------------------------------------
    console.log('\n[4/5] Cleanup (Archive test records)...');
    if (testAccountA) {
      const { data: cleanA1Data, error: cleanA1 } = await clientA.from('accounts').update({ is_archived: true, name: 'Test Account A Updated (Archived)' }).eq('id', testAccountA).select('*');
      if (cleanA1 || cleanA1Data.length === 0) { console.error('❌ Cleanup failed for A account'); hasError = true; } else console.log('✔ Archived test account A.');
    }
    if (testAccountB) {
      const { data: cleanB1Data, error: cleanB1 } = await clientB.from('accounts').update({ is_archived: true, name: 'Test Account B (Archived)' }).eq('id', testAccountB).select('*');
      if (cleanB1 || cleanB1Data.length === 0) { console.error('❌ Cleanup failed for B account'); hasError = true; } else console.log('✔ Archived test account B.');
    }
    if (testCategoryA) {
      const { data: cleanA2Data, error: cleanA2 } = await clientA.from('categories').update({ is_archived: true, name: 'Test Category A Verifier (Archived)' }).eq('id', testCategoryA).select('*');
      if (cleanA2 || cleanA2Data.length === 0) { console.error('❌ Cleanup failed for A category'); hasError = true; } else console.log('✔ Archived test category A.');
    }
    if (testCategoryB) {
      const { data: cleanB2Data, error: cleanB2 } = await clientB.from('categories').update({ is_archived: true, name: 'Test Category B Verifier (Archived)' }).eq('id', testCategoryB).select('*');
      if (cleanB2 || cleanB2Data.length === 0) { console.error('❌ Cleanup failed for B category'); hasError = true; } else console.log('✔ Archived test category B.');
    }

  } catch (err) {
    console.error('❌ Unexpected error during tests:', err);
    hasError = true;
  }

  console.log('\n[5/5] Summary');
  if (hasError) {
    console.error('❌ FAIL: One or more two-user RLS isolation tests failed.');
    process.exit(1);
  } else {
    console.log('✅ PASS: Two-user runtime RLS isolation passed for accounts and categories.');
  }
}

run();
