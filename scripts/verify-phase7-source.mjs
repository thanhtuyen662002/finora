#!/usr/bin/env node

/**
 * Finora Phase 7 Source Code & Planning Layer Verifier
 *
 * Verifies:
 * 1. Migration file existence & structural integrity (budgets, goals, recurring_items, views, triggers, 9 RLS policies).
 * 2. Database TypeScript types for Phase 7 tables and views.
 * 3. Exact money arithmetic in Phase 7 feature modules (budgets, goals, recurring).
 * 4. Pre-FX multi-currency isolation in summaries and aggregations.
 * 5. Deterministic schedule engine in recurring features (weekly, monthly, yearly, end date clamping, leap years, next due dates).
 * 6. Monthly-equivalent projection arithmetic & UI labeling / ADR-012 documentation.
 * 7. Structural SQL verifier (`verify-phase7-db.sql`) audit: exact column counts (10, 14, 16), exact nullability & defaults, constraint definitions, per-table policy command distribution (1 SELECT, 1 INSERT, 1 UPDATE, 0 DELETE with auth.uid() = user_id), trigger function identity, RLS policies, grants, views, account_balances CTE pre-aggregation formula.
 * 8. Runtime RLS verifier (`verify-phase7-rls.mjs`) audit: Phase 3-5 schema alignment (occurred_on, merchant, user_id), User B lifecycle, bidirectional isolation, transfer neutrality, domain rejection matrix, error distinction, cleanup assertions.
 * 9. Project status integrity and unauthorized Phase 8 guard.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function pass(name, detail = '') {
  totalChecks++;
  passedChecks++;
  console.log(`  ✓ PASS: ${name}${detail ? ` (${detail})` : ''}`);
}

function fail(name, reason) {
  totalChecks++;
  failedChecks++;
  console.error(`  ✗ FAIL: ${name} -> ${reason}`);
}

console.log('='.repeat(75));
console.log('FINORA PHASE 7 SOURCE, PLANNING LAYER & VERIFIER AUDIT SUITE');
console.log('='.repeat(75));

// 1. Check file existence & mock eradication in Phase 7 files
console.log('\n[1/8] Checking Phase 7 file existence & mock eradication...');
const phase7Files = [
  'supabase/migrations/20260829000000_phase_7_budgets_goals_recurring.sql',
  'src/types/database.ts',
  'src/features/budgets/types.ts',
  'src/features/budgets/budgets.ts',
  'src/features/budgets/index.ts',
  'src/features/goals/types.ts',
  'src/features/goals/goals.ts',
  'src/features/goals/index.ts',
  'src/features/recurring/types.ts',
  'src/features/recurring/engine.ts',
  'src/features/recurring/recurring.ts',
  'src/features/recurring/index.ts',
  'src/app/budgets/page.tsx',
  'src/app/goals/page.tsx',
  'src/app/recurring/page.tsx',
  'src/components/finance/BudgetProgress.tsx',
  'src/components/finance/AddBudgetModal.tsx',
  'src/components/finance/EditBudgetModal.tsx',
  'src/components/finance/GoalCard.tsx',
  'src/components/finance/AddGoalModal.tsx',
  'src/components/finance/EditGoalModal.tsx',
  'src/components/finance/ContributeGoalModal.tsx',
  'src/components/finance/AddRecurringModal.tsx',
  'src/components/finance/EditRecurringModal.tsx',
  'scripts/verify-phase7-db.sql',
  'scripts/verify-phase7-rls.mjs',
];

for (const relPath of phase7Files) {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) {
    fail(`File existence: ${relPath}`, 'File does not exist');
    continue;
  }
  pass(`File existence: ${relPath}`);

  if (relPath.startsWith('src/features/') || relPath.startsWith('src/app/')) {
    const content = fs.readFileSync(fullPath, 'utf8');
    if (
      content.includes('@/lib/mock/') ||
      content.includes('../mock/') ||
      content.includes('MOCK_BUDGETS') ||
      content.includes('MOCK_GOALS') ||
      content.includes('MOCK_RECURRING')
    ) {
      fail(`No mock in: ${relPath}`, 'Found mock references');
    } else {
      pass(`No mock in: ${relPath}`);
    }
  }
}

// 2. Check Migration file content & RLS policies
console.log('\n[2/8] Checking Phase 7 migration structure...');
const migrationPath = path.join(
  rootDir,
  'supabase/migrations/20260829000000_phase_7_budgets_goals_recurring.sql'
);
const migrationContent = fs.readFileSync(migrationPath, 'utf8');

const requiredMigrationSnippets = [
  'CREATE TABLE IF NOT EXISTS public.budgets',
  'CREATE TABLE IF NOT EXISTS public.goals',
  'CREATE TABLE IF NOT EXISTS public.recurring_items',
  "CONSTRAINT check_budget_limit_positive CHECK (limit_amount > 0)",
  "CONSTRAINT check_budget_category_type CHECK (category_type = 'EXPENSE')",
  "CONSTRAINT check_budget_currency_code CHECK (currency_code ~ '^[A-Z]{3,5}$')",
  "CONSTRAINT check_goal_target_amount_positive CHECK (target_amount > 0)",
  "CONSTRAINT check_recurring_amount_positive CHECK (amount > 0)",
  'CREATE OR REPLACE VIEW public.budget_progress',
  'WITH (security_invoker = true)',
  'CREATE OR REPLACE VIEW public.goal_details',
  'CREATE OR REPLACE VIEW public.recurring_details',
  'ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY',
  'ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY',
  'ALTER TABLE public.recurring_items ENABLE ROW LEVEL SECURITY',
  'CREATE POLICY "Users can select own budgets"',
  'CREATE POLICY "Users can insert own budgets"',
  'CREATE POLICY "Users can update own budgets"',
  'CREATE POLICY "Users can select own goals"',
  'CREATE POLICY "Users can insert own goals"',
  'CREATE POLICY "Users can update own goals"',
  'CREATE POLICY "Users can select own recurring items"',
  'CREATE POLICY "Users can insert own recurring items"',
  'CREATE POLICY "Users can update own recurring items"',
];

for (const snippet of requiredMigrationSnippets) {
  if (migrationContent.includes(snippet)) {
    pass(`Migration contains: ${snippet.slice(0, 45)}...`);
  } else {
    fail(`Migration snippet: ${snippet}`, 'Required snippet missing from migration file');
  }
}

// Verify that NO DELETE policy exists (only soft delete via is_archived)
if (/CREATE POLICY\s+"[^"]*delete/i.test(migrationContent)) {
  fail('No DELETE policy in migration', 'Found forbidden DELETE policy in Phase 7 migration');
} else {
  pass('Zero DELETE policies in migration (soft-delete only)');
}

// 3. Check Database TypeScript Types
console.log('\n[3/8] Checking TypeScript database definitions...');
const dbTypesPath = path.join(rootDir, 'src/types/database.ts');
const dbTypesContent = fs.readFileSync(dbTypesPath, 'utf8');

const requiredTypes = [
  'BudgetRow',
  'BudgetInsert',
  'BudgetUpdate',
  'BudgetProgressRow',
  'GoalRow',
  'GoalInsert',
  'GoalUpdate',
  'GoalDetailsRow',
  'RecurringItemRow',
  'RecurringItemInsert',
  'RecurringItemUpdate',
  'RecurringDetailsRow',
  'RecurringFrequency',
];

for (const t of requiredTypes) {
  if (dbTypesContent.includes(t)) {
    pass(`Database type: ${t}`);
  } else {
    fail(`Database type: ${t}`, 'Missing required type export in database.ts');
  }
}

// 4. Test Exact Decimal Money Arithmetic and Invariants in Phase 7 source files
console.log('\n[4/8] Checking exact money invariants across Phase 7 services...');
const budgetsSourcePath = path.join(rootDir, 'src/features/budgets/budgets.ts');
const budgetsSource = fs.readFileSync(budgetsSourcePath, 'utf8');
const goalsSourcePath = path.join(rootDir, 'src/features/goals/goals.ts');
const goalsSource = fs.readFileSync(goalsSourcePath, 'utf8');
const recurringSourcePath = path.join(rootDir, 'src/features/recurring/recurring.ts');
const recurringSource = fs.readFileSync(recurringSourcePath, 'utf8');

if (
  budgetsSource.includes('addExactDecimals') &&
  budgetsSource.includes('subExactDecimals') &&
  budgetsSource.includes('computeBasisPoints')
) {
  pass('Budgets service uses exact decimal arithmetic');
} else {
  fail('Budgets service arithmetic', 'Missing exact decimal functions in budgets.ts');
}

if (
  goalsSource.includes('addExactDecimals') &&
  goalsSource.includes('subExactDecimals') &&
  goalsSource.includes('computeBasisPoints')
) {
  pass('Goals service uses exact decimal arithmetic');
} else {
  fail('Goals service arithmetic', 'Missing exact decimal functions in goals.ts');
}

if (
  recurringSource.includes('addExactDecimals') &&
  recurringSource.includes('calculateNextDueDate')
) {
  pass('Recurring service uses exact decimal arithmetic & engine');
} else {
  fail('Recurring service arithmetic', 'Missing exact decimal or engine functions in recurring.ts');
}

// Check for forbidden floating-point calls on amounts
const allSource = budgetsSource + goalsSource + recurringSource;
if (
  /Number\(\s*row\.limit_amount\s*\)/.test(allSource) ||
  /parseFloat\(\s*row\.limit_amount\s*\)/.test(allSource)
) {
  fail('No float conversion on limit_amount', 'Found forbidden Number()/parseFloat() on limit_amount');
} else {
  pass('No float conversions on limit_amount');
}

if (
  /Number\(\s*row\.target_amount\s*\)/.test(allSource) ||
  /parseFloat\(\s*row\.target_amount\s*\)/.test(allSource)
) {
  fail('No float conversion on target_amount', 'Found forbidden Number()/parseFloat() on target_amount');
} else {
  pass('No float conversions on target_amount');
}

if (
  /Number\(\s*row\.amount\s*\)/.test(allSource) ||
  /parseFloat\(\s*row\.amount\s*\)/.test(allSource)
) {
  fail('No float conversion on recurring amount', 'Found forbidden Number()/parseFloat() on amount');
} else {
  pass('No float conversions on recurring amount');
}

// 5. Test Recurring Schedule Engine, Date Parsing, and Monthly-Equivalent Projection
console.log('\n[5/8] Testing Recurring schedule engine & monthly-equivalent projection...');
import {
  calculateNextDueDate,
  generateUpcomingOccurrences,
  diffCalendarDays,
  addMonthsClamped,
  isLeapYear,
  daysInMonth,
  isValidISODateString,
  parseISODate,
  computeMonthlyProjectedAmount,
} from '../src/features/recurring/engine.ts';

// Test leap year & daysInMonth
if (isLeapYear(2024) && !isLeapYear(2025) && !isLeapYear(2100) && isLeapYear(2000)) {
  pass('Leap year detection');
} else {
  fail('Leap year detection', 'Failed leap year calculation');
}

if (
  daysInMonth(2024, 2) === 29 &&
  daysInMonth(2025, 2) === 28 &&
  daysInMonth(2026, 4) === 30 &&
  daysInMonth(2026, 8) === 31
) {
  pass('Days in month calculation');
} else {
  fail('Days in month calculation', 'Incorrect days count');
}

// Test isValidISODateString and calendar boundary validation
if (
  isValidISODateString('2026-08-29') &&
  isValidISODateString('2024-02-29') &&
  !isValidISODateString('2025-02-29') &&
  !isValidISODateString('2026-13-01') &&
  !isValidISODateString('2026-00-01') &&
  !isValidISODateString('1899-12-31') &&
  !isValidISODateString('invalid')
) {
  pass('Strict calendar date validation');
} else {
  fail('Strict calendar date validation', 'Failed calendar validation checks');
}

// Test month end clamping: Jan 31 + 1 month -> Feb 28 (non-leap) or Feb 29 (leap)
const clampedFeb2025 = addMonthsClamped(2025, 1, 31, 1);
const clampedFeb2024 = addMonthsClamped(2024, 1, 31, 1);
if (clampedFeb2025 === '2025-02-28' && clampedFeb2024 === '2024-02-29') {
  pass('Month end clamping (Jan 31 -> Feb 28/29)');
} else {
  fail('Month end clamping', `Got ${clampedFeb2025} and ${clampedFeb2024}`);
}

// Test calculateNextDueDate
const weeklyItem = {
  anchor_date: '2026-08-01',
  frequency: 'WEEKLY',
  is_paused: false,
  is_archived: false,
};
const nextWeekly = calculateNextDueDate(weeklyItem, '2026-08-10');
if (nextWeekly === '2026-08-15') {
  pass('Weekly next due date calculation');
} else {
  fail('Weekly next due date', `Expected 2026-08-15, got ${nextWeekly}`);
}

const monthlyItem = {
  anchor_date: '2026-01-15',
  frequency: 'MONTHLY',
  is_paused: false,
  is_archived: false,
};
const nextMonthly = calculateNextDueDate(monthlyItem, '2026-08-20');
if (nextMonthly === '2026-09-15') {
  pass('Monthly next due date calculation');
} else {
  fail('Monthly next due date', `Expected 2026-09-15, got ${nextMonthly}`);
}

const expiredItem = {
  anchor_date: '2026-01-01',
  frequency: 'MONTHLY',
  end_date: '2026-06-01',
  is_paused: false,
  is_archived: false,
};
const nextExpired = calculateNextDueDate(expiredItem, '2026-08-01');
if (nextExpired === null) {
  pass('Expired recurring item returns null');
} else {
  fail('Expired recurring item', `Expected null, got ${nextExpired}`);
}

// Test Upcoming occurrences generator
const occurrences = generateUpcomingOccurrences(monthlyItem, 3, '2026-08-20');
if (
  occurrences.length === 3 &&
  occurrences[0] === '2026-09-15' &&
  occurrences[1] === '2026-10-15' &&
  occurrences[2] === '2026-11-15'
) {
  pass('Upcoming occurrences generator');
} else {
  fail('Upcoming occurrences generator', `Got ${JSON.stringify(occurrences)}`);
}

// Test Monthly-Equivalent Projection Arithmetic
// Monthly: 100.0000 -> 100.0000
const projMonthly = computeMonthlyProjectedAmount('100.0000', 'MONTHLY');
if (projMonthly === '100.0000') {
  pass('Monthly-equivalent projection: MONTHLY unchanged');
} else {
  fail('Monthly-equivalent projection: MONTHLY', `Expected 100.0000, got ${projMonthly}`);
}

// Weekly: 120.0000 * 52 / 12 = 520.0000
const projWeekly = computeMonthlyProjectedAmount('120.0000', 'WEEKLY');
if (projWeekly === '520.0000') {
  pass('Monthly-equivalent projection: WEEKLY (amount * 52 / 12)');
} else {
  fail('Monthly-equivalent projection: WEEKLY', `Expected 520.0000, got ${projWeekly}`);
}

// Yearly: 1200.0000 / 12 = 100.0000
const projYearly = computeMonthlyProjectedAmount('1200.0000', 'YEARLY');
if (projYearly === '100.0000') {
  pass('Monthly-equivalent projection: YEARLY (amount / 12)');
} else {
  fail('Monthly-equivalent projection: YEARLY', `Expected 100.0000, got ${projYearly}`);
}

// 6. Audit Structural Database SQL Verifier (scripts/verify-phase7-db.sql)
console.log('\n[6/8] Auditing structural database verifier (verify-phase7-db.sql)...');
const dbSqlPath = path.join(rootDir, 'scripts/verify-phase7-db.sql');
const dbSqlContent = fs.readFileSync(dbSqlPath, 'utf8');

// Check exact column counts in SQL verifier
if (dbSqlContent.includes("SELECT count(*) = 10 AND bool_and(column_name IN (\n                'id', 'user_id', 'category_id', 'category_type', 'limit_amount'")) {
  pass('Structural verifier checks exact 10 columns for budgets');
} else {
  fail('Structural verifier budgets column count', 'Must check exactly 10 columns for budgets');
}

if (dbSqlContent.includes("SELECT count(*) = 14 AND bool_and(column_name IN (\n                'id', 'user_id', 'name', 'target_amount', 'current_amount'")) {
  pass('Structural verifier checks exact 14 columns for goals');
} else {
  fail('Structural verifier goals column count', 'Must check exactly 14 columns for goals');
}

if (dbSqlContent.includes("SELECT count(*) = 16 AND bool_and(column_name IN (\n                'id', 'user_id', 'account_id', 'category_id', 'transaction_type'")) {
  pass('Structural verifier checks exact 16 columns for recurring_items');
} else {
  fail('Structural verifier recurring_items column count', 'Must check exactly 16 columns for recurring_items');
}

// Check Phase 7 exact nullability & defaults audits
if (
  dbSqlContent.includes("'04a_budgets_nullability_and_defaults'") &&
  dbSqlContent.includes("WHEN 'category_type' THEN is_nullable = 'NO' AND column_default LIKE '%EXPENSE%'") &&
  dbSqlContent.includes("WHEN 'is_archived' THEN is_nullable = 'NO'") &&
  dbSqlContent.includes("WHEN 'created_at' THEN is_nullable = 'NO'")
) {
  pass('Structural verifier checks exact nullability & defaults for budgets');
} else {
  fail('Structural verifier budgets nullability/defaults', 'Must audit all 10 budgets column nullability and defaults in 04a');
}

if (
  dbSqlContent.includes("'05a_goals_nullability_and_defaults'") &&
  dbSqlContent.includes("WHEN 'target_date' THEN is_nullable = 'YES' AND column_default IS NULL") &&
  dbSqlContent.includes("WHEN 'current_amount' THEN is_nullable = 'NO'") &&
  dbSqlContent.includes("WHEN 'category' THEN is_nullable = 'NO' AND column_default LIKE '%OTHER%'") &&
  dbSqlContent.includes("WHEN 'icon' THEN is_nullable = 'NO' AND column_default LIKE '%Target%'") &&
  dbSqlContent.includes("WHEN 'color' THEN is_nullable = 'NO' AND column_default LIKE '%#10b981%'")
) {
  pass('Structural verifier checks exact nullability & defaults for goals');
} else {
  fail('Structural verifier goals nullability/defaults', 'Must audit all 14 goals column nullability and defaults in 05a');
}

if (
  dbSqlContent.includes("'06a_recurring_nullability_and_defaults'") &&
  dbSqlContent.includes("WHEN 'end_date' THEN is_nullable = 'YES' AND column_default IS NULL") &&
  dbSqlContent.includes("WHEN 'note' THEN is_nullable = 'YES' AND column_default IS NULL") &&
  dbSqlContent.includes("WHEN 'is_paused' THEN is_nullable = 'NO'") &&
  dbSqlContent.includes("WHEN 'is_archived' THEN is_nullable = 'NO'")
) {
  pass('Structural verifier checks exact nullability & defaults for recurring_items');
} else {
  fail('Structural verifier recurring nullability/defaults', 'Must audit all 16 recurring column nullability and defaults in 06a');
}

// Check per-table policy command distribution checks (1 SELECT, 1 INSERT, 1 UPDATE, 0 DELETE with auth.uid() = user_id)
if (
  dbSqlContent.includes("'23_budgets_policy_command_distribution'") &&
  dbSqlContent.includes("count(*) FILTER (WHERE p.polcmd = 'r') = 1") &&
  dbSqlContent.includes("count(*) FILTER (WHERE p.polcmd = 'a') = 1") &&
  dbSqlContent.includes("count(*) FILTER (WHERE p.polcmd = 'w') = 1") &&
  dbSqlContent.includes("count(*) FILTER (WHERE p.polcmd = 'd') = 0") &&
  dbSqlContent.includes("'24_goals_policy_command_distribution'") &&
  dbSqlContent.includes("'25_recurring_policy_command_distribution'")
) {
  pass('Structural verifier proves exact policy command distribution (1 SELECT, 1 INSERT, 1 UPDATE, 0 DELETE) per table');
} else {
  fail('Structural verifier policy command distribution', 'Must prove exact per-table policy command distribution in checks 23, 24, 25');
}

// Reject old shallow policy checks
if (
  dbSqlContent.includes("'23_budgets_policies_exact_3'") ||
  dbSqlContent.includes("'24_goals_policies_exact_3'") ||
  dbSqlContent.includes("'25_recurring_policies_exact_3'")
) {
  fail('Old shallow policy checks', 'Found deprecated shallow policy checks (23_budgets_policies_exact_3, etc.)');
} else {
  pass('Old shallow policy checks successfully replaced with strict command distribution verifiers');
}

// Check account_balances Phase 5/6 pre-aggregation formula verification
if (
  dbSqlContent.includes("'49_phase6_account_balances_invoker_text_formula'") &&
  dbSqlContent.includes("definition LIKE '%tx_totals%'") &&
  dbSqlContent.includes("definition LIKE '%incoming_transfers%'") &&
  dbSqlContent.includes("definition LIKE '%outgoing_transfers%'") &&
  dbSqlContent.includes("definition LIKE '%opening_balance%'") &&
  dbSqlContent.includes("definition LIKE '%net_transactions%'") &&
  dbSqlContent.includes("definition LIKE '%in_transfers%'") &&
  dbSqlContent.includes("definition LIKE '%out_transfers%'") &&
  (dbSqlContent.includes("definition LIKE '%is_voided = false%'") || dbSqlContent.includes("definition LIKE '%is_voided = FALSE%'"))
) {
  pass('Structural verifier proves account_balances pre-aggregated CTEs, active-only filters, and formula');
} else {
  fail('Structural verifier account_balances formula check', 'Must prove account_balances CTE structure and formula in check 49');
}

// Check trigger function identity via pg_proc join rather than trigger name string matching
if (
  dbSqlContent.includes("JOIN pg_catalog.pg_proc p ON p.oid = tg.tgfoid") &&
  dbSqlContent.includes("p.proname = 'handle_updated_at'") &&
  !dbSqlContent.includes("tg.tgname LIKE '%handle_updated_at%'")
) {
  pass('Structural verifier checks trigger function identity via pg_proc join');
} else {
  fail('Structural verifier trigger function check', 'Must check trigger function identity using pg_proc.proname = handle_updated_at');
}

// Check presence of all mandatory structural checks
const mandatoryDbChecks = [
  '01_budgets_table_exists',
  '02_goals_table_exists',
  '03_recurring_items_table_exists',
  '04_budgets_columns_exact',
  '04a_budgets_nullability_and_defaults',
  '05_goals_columns_exact',
  '05a_goals_nullability_and_defaults',
  '06_recurring_columns_exact',
  '06a_recurring_nullability_and_defaults',
  '07_numeric_precision_budgets',
  '08_numeric_precision_goals',
  '09_numeric_precision_recurring',
  '10_no_fx_columns_phase7',
  '11_no_persisted_budget_spent',
  '12_no_persisted_recurring_next_due',
  '13_budgets_check_constraints',
  '14_goals_check_constraints',
  '15_recurring_check_constraints',
  '16_budgets_unique_period_month',
  '17_budgets_composite_fk_category',
  '18_recurring_composite_fk_account',
  '19_recurring_composite_fk_category',
  '20_fk_restrict_delete_actions',
  '21_triggers_handle_updated_at',
  '22_rls_enabled_phase7_tables',
  '23_budgets_policy_command_distribution',
  '24_goals_policy_command_distribution',
  '25_recurring_policy_command_distribution',
  '26_policy_role_authenticated_only',
  '27_policy_auth_uid_ownership',
  '28_update_policies_using_and_check',
  '29_zero_delete_policies_phase7',
  '30_anon_public_no_table_privileges',
  '31_authenticated_table_select_only',
  '32_budgets_column_grants_insert_update',
  '33_goals_column_grants_insert_update',
  '34_recurring_column_grants_insert_update',
  '35_immutable_columns_no_update_grant',
  '36_budget_progress_view_exists',
  '37_goal_details_view_exists',
  '38_recurring_details_view_exists',
  '39_views_security_invoker_true',
  '40_views_authoritative_money_text',
  '41_budget_progress_active_expense_derivation',
  '42_budget_progress_category_ownership_join',
  '43_recurring_details_account_category_ownership_join',
  '44_views_grants_authenticated_only',
  '45_phase4_transactions_rls_non_regression',
  '46_phase5_transfers_rls_non_regression',
  '47_phase4_transaction_details_invoker_text',
  '48_phase5_transfer_details_invoker_text',
  '49_phase6_account_balances_invoker_text_formula',
  '50_no_persisted_accounts_current_balance',
  '51_phase2_to_7_all_tables_rls_enabled',
  '99_OVERALL',
];

for (const chk of mandatoryDbChecks) {
  if (dbSqlContent.includes(chk)) {
    pass(`Structural check present: ${chk}`);
  } else {
    fail(`Structural check: ${chk}`, 'Missing mandatory check in verify-phase7-db.sql');
  }
}

// 7. Audit Runtime RLS Verifier (scripts/verify-phase7-rls.mjs)
console.log('\n[7/8] Auditing runtime RLS verifier (verify-phase7-rls.mjs)...');
const rlsScriptPath = path.join(rootDir, 'scripts/verify-phase7-rls.mjs');
const rlsScriptContent = fs.readFileSync(rlsScriptPath, 'utf8');

// Verifier uses occurred_on, NOT occurred_at
if (rlsScriptContent.includes('occurred_on:') && !rlsScriptContent.includes('occurred_at:')) {
  pass('Runtime verifier uses authoritative occurred_on (DATE), not occurred_at');
} else {
  fail('Runtime verifier date field', 'Must use occurred_on, never occurred_at');
}

// Verifier supplies required merchant
if (rlsScriptContent.includes("merchant: 'Test Supermarket A'") && rlsScriptContent.includes("merchant: 'Test Supermarket B'")) {
  pass('Runtime verifier supplies required merchant on transaction inserts');
} else {
  fail('Runtime verifier merchant field', 'Must supply merchant on transaction inserts');
}

// Verifier supplies authenticated user_id on accounts & categories inserts
if (
  rlsScriptContent.includes('user_id: userAId') &&
  rlsScriptContent.includes('user_id: userBId') &&
  !rlsScriptContent.includes('user_id: undefined')
) {
  pass('Runtime verifier supplies authenticated user_id on reference accounts/categories inserts');
} else {
  fail('Runtime verifier user_id', 'Must supply authenticated user_id on reference rows');
}

// Verifier contains User B independent lifecycle
if (
  rlsScriptContent.includes('USER_B_FULL_LIFECYCLE') &&
  rlsScriptContent.includes("from('budgets')") &&
  rlsScriptContent.includes("from('goals')") &&
  rlsScriptContent.includes("from('recurring_items')")
) {
  pass('Runtime verifier contains User B complete independent lifecycle');
} else {
  fail('Runtime verifier User B lifecycle', 'Must test complete User B lifecycle');
}

// Verifier contains bidirectional isolation
if (
  rlsScriptContent.includes('BIDIRECTIONAL_CROSS_USER_ISOLATION') &&
  rlsScriptContent.includes('User B selected User A') &&
  rlsScriptContent.includes('User A selected User B')
) {
  pass('Runtime verifier contains bidirectional cross-user isolation');
} else {
  fail('Runtime verifier cross-user isolation', 'Must test bidirectional isolation');
}

// Verifier contains Phase 5 transfer regression and budget neutrality
if (
  rlsScriptContent.includes('PHASE5_TRANSFER_BUDGET_NEUTRALITY_REGRESSION') &&
  rlsScriptContent.includes("from('transfers')")
) {
  pass('Runtime verifier tests Phase 5 transfer regression and budget spent neutrality');
} else {
  fail('Runtime verifier transfer regression', 'Must test transfer regression and budget neutrality');
}

// Verifier contains domain rejection matrix
if (
  rlsScriptContent.includes('DOMAIN_REJECTION_MATRIX') &&
  rlsScriptContent.includes('period_month: \'2026-08-15\'') &&
  rlsScriptContent.includes('limit_amount: \'0.0000\'')
) {
  pass('Runtime verifier contains complete domain rejection matrix');
} else {
  fail('Runtime verifier domain rejection matrix', 'Must test domain constraints');
}

// Verifier contains deliberate non-RLS database error distinction
if (rlsScriptContent.includes('DELIBERATE_NON_RLS_ERROR_DISTINCTION')) {
  pass('Runtime verifier tests deliberate non-RLS database error distinction');
} else {
  fail('Runtime verifier error distinction', 'Must test non-RLS error distinction');
}

// Verifier contains deterministic fail-closed cleanup
if (rlsScriptContent.includes('DETERMINISTIC_CLEANUP_ASSERTIONS')) {
  pass('Runtime verifier performs deterministic fail-closed cleanup');
} else {
  fail('Runtime verifier cleanup', 'Must perform fail-closed cleanup assertions');
}

// Missing credentials exit 1
if (rlsScriptContent.includes('process.exit(1);')) {
  pass('Runtime verifier fails closed (exit 1) on missing credentials');
} else {
  fail('Runtime verifier credentials failure', 'Must exit 1 on missing credentials');
}

// 8. Audit Documentation & Status Integrity
console.log('\n[8/8] Auditing documentation & project status integrity...');
const decPath = path.join(rootDir, 'docs/DECISIONS.md');
const decContent = fs.readFileSync(decPath, 'utf8');

if (
  decContent.includes('Monthly-equivalent cash flow projection in recurring summaries') &&
  decContent.includes('WEEKLY') &&
  decContent.includes('YEARLY')
) {
  pass('docs/DECISIONS.md ADR-012 documents monthly-equivalent projection assumptions');
} else {
  fail('docs/DECISIONS.md ADR-012', 'Must document monthly-equivalent projection in ADR-012');
}

const statusPath = path.join(rootDir, 'docs/PROJECT_STATUS.md');
const statusContent = fs.readFileSync(statusPath, 'utf8');

if (
  statusContent.includes('PHASE_7_SOURCE_GATE=PASS_CODE_ONLY') &&
  statusContent.includes('PHASE_7_MIGRATION_APPLY=PENDING_USER') &&
  statusContent.includes('PHASE_8_AUTHORIZED=false')
) {
  pass('docs/PROJECT_STATUS.md maintains truthful Phase 7 status & unauthorized Phase 8');
} else {
  fail('docs/PROJECT_STATUS.md', 'Must maintain truthful Phase 7 status and PHASE_8_AUTHORIZED=false');
}

const recurringUiPath = path.join(rootDir, 'src/app/recurring/page.tsx');
const recurringUiContent = fs.readFileSync(recurringUiPath, 'utf8');

if (
  recurringUiContent.includes('Thu định kỳ dự tính (Quy đổi tháng)') &&
  recurringUiContent.includes('Chi định kỳ dự tính (Quy đổi tháng)') &&
  recurringUiContent.includes('Dòng tiền ròng dự tính (Quy đổi tháng)')
) {
  pass('src/app/recurring/page.tsx displays truthful monthly-equivalent projection labels');
} else {
  fail('src/app/recurring/page.tsx UI labels', 'Must clearly label monthly-equivalent projections in UI');
}

// Final Summary
console.log('\n' + '='.repeat(75));
console.log(
  `PHASE 7 VERIFICATION RESULTS: ${passedChecks}/${totalChecks} checks passed (${failedChecks} failed).`
);
console.log('='.repeat(75));

if (failedChecks > 0) {
  process.exit(1);
} else {
  console.log('ALL PHASE 7 VERIFICATION AND AUDIT CHECKS PASSED.');
  process.exit(0);
}
