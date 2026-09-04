#!/usr/bin/env node

/**
 * Finora AI Receipt Vision — Source Code & Architectural Compliance Verifier
 * Phase 12B — Automated Source Rule Verification
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

const ROOT_DIR = process.cwd();

console.log('--- Finora Phase 12B Source Verification Starting ---');

function readFile(relPath) {
  const fullPath = path.join(ROOT_DIR, relPath);
  assert.ok(fs.existsSync(fullPath), `File must exist: ${relPath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

// 1. Check package.json dependencies
{
  console.log('[1/7] Verifying package.json dependencies...');
  const pkgJson = JSON.parse(readFile('package.json'));
  assert.ok(pkgJson.dependencies?.sharp, 'sharp must be present in dependencies');
  assert.match(pkgJson.dependencies.sharp, /0\.35\.4/, 'sharp must be pinned to 0.35.4');
  console.log('  ✓ sharp is pinned to 0.35.4');
}

// 2. Verifying server-only vs client-safe boundaries
{
  console.log('[2/7] Verifying server vs client boundaries...');
  const serverFiles = [
    'src/features/ai/receipt-vision/server.ts',
    'src/features/ai/receipt-vision/categories.ts',
    'src/features/ai/receipt-vision/prompt.ts',
    'src/features/ai/receipt-vision/money.ts',
    'src/features/ai/receipt-vision/action-core.ts',
  ];

  for (const file of serverFiles) {
    const content = readFile(file);
    assert.ok(
      content.includes("import 'server-only'") || content.includes("'use server'"),
      `${file} must import 'server-only' or specify 'use server'`
    );
  }

  const clientFiles = [
    'src/features/ai/receipt-vision/domain.ts',
    'src/features/ai/receipt-vision/form-state.ts',
    'src/features/ai/receipt-vision/types.ts',
    'src/features/ai/receipt-vision/constants.ts',
    'src/features/ai/receipt-vision/components/ReceiptDraftPreview.tsx',
    'src/features/ai/receipt-vision/components/ReceiptPicker.tsx',
  ];

  for (const file of clientFiles) {
    const content = readFile(file);
    assert.ok(
      !content.includes("import 'server-only'"),
      `${file} must NOT import 'server-only' (must remain client-safe)`
    );
  }
  console.log('  ✓ Server-only and client-safe boundaries are properly isolated');
}

// 3. Verifying category isolation & candidate policy
{
  console.log('[3/7] Verifying category candidate constraints and prompt security...');
  const categoriesCode = readFile('src/features/ai/receipt-vision/categories.ts');
  assert.ok(categoriesCode.includes('PHASE_12B_MAX_CATEGORY_CANDIDATES'), 'Must reference candidate cap');
  assert.ok(categoriesCode.includes('PHASE_12B_MAX_CATEGORY_CANDIDATES + 1'), 'Must use limit 51 for overflow detection');
  assert.ok(categoriesCode.includes('categoriesOmitted: true'), 'Must omit all candidates when count > 50');
  assert.ok(categoriesCode.includes('sanitizeCategoryLabel'), 'Must sanitize candidate labels');
  assert.ok(categoriesCode.includes('CAT_'), 'Must use opaque CAT_n tokens');

  const promptCode = readFile('src/features/ai/receipt-vision/prompt.ts');
  assert.ok(!promptCode.includes('uuid'), 'Prompt builder must not use UUIDs');
  assert.ok(promptCode.includes('buildReceiptVisionPrompt'), 'Must export buildReceiptVisionPrompt');
  assert.ok(promptCode.includes('CATEGORY CANDIDATES'), 'Must include category prompt block');
  console.log('  ✓ Category candidate bounds, sanitization, overflow failsafe, and prompt safety verified');
}

// 4. Verifying token resolution and post-provider RLS revalidation
{
  console.log('[4/7] Verifying token resolution and RLS revalidation...');
  const actionCoreCode = readFile('src/features/ai/receipt-vision/action-core.ts');
  assert.ok(actionCoreCode.includes('candidateResult.candidateMap.has'), 'Must check candidate map for returned token');
  assert.ok(actionCoreCode.includes('AI_STRUCTURED_OUTPUT_INVALID'), 'Must fail closed with invalid output on fabricated token');
  assert.ok(actionCoreCode.includes('revalidateCategory'), 'Must call post-provider revalidation');
  assert.ok(actionCoreCode.includes("categoryStatus = 'STALE'"), 'Must mark deleted/archived category as STALE');
  assert.ok(actionCoreCode.includes("categoryStatus = 'RESOLVED'"), 'Must mark valid category as RESOLVED');
  assert.ok(actionCoreCode.includes("categoryStatus = 'UNRESOLVED'"), 'Must mark missing/null category as UNRESOLVED');
  console.log('  ✓ Category token resolution and post-provider revalidation verified');
}

// 5. Verifying warning taxonomy & deterministic order
{
  console.log('[5/7] Verifying warning taxonomy and stable order...');
  const typesCode = readFile('src/features/ai/receipt-vision/types.ts');
  const domainCode = readFile('src/features/ai/receipt-vision/domain.ts');

  const expectedWarnings = [
    'DOCUMENT_UNSUPPORTED',
    'TOTAL_MISSING',
    'TOTAL_AMBIGUOUS',
    'CURRENCY_MISSING',
    'CURRENCY_AMBIGUOUS',
    'CURRENCY_UNSUPPORTED',
    'DATE_MISSING',
    'DATE_AMBIGUOUS',
    'DATE_INVALID',
    'MERCHANT_MISSING',
    'CATEGORY_UNRESOLVED',
    'CATEGORY_STALE',
    'ACCOUNT_REQUIRED',
    'IMAGE_QUALITY_LOW',
  ];

  for (const w of expectedWarnings) {
    assert.ok(typesCode.includes(w), `types.ts must define ${w}`);
    assert.ok(domainCode.includes(w), `domain.ts must handle ${w}`);
  }

  assert.ok(domainCode.includes('RECEIPT_WARNING_ORDER'), 'Must define canonical RECEIPT_WARNING_ORDER');
  console.log('  ✓ All 14 warning codes and deterministic ordering verified');
}

// 6. Verifying can_apply and pure form application
{
  console.log('[6/7] Verifying can_apply and zero-default form application...');
  const domainCode = readFile('src/features/ai/receipt-vision/domain.ts');
  assert.ok(domainCode.includes('computeReceiptCanApply'), 'Must export computeReceiptCanApply');
  assert.ok(domainCode.includes('PURCHASE_RECEIPT'), 'can_apply must check PURCHASE_RECEIPT');

  const formStateCode = readFile('src/features/ai/receipt-vision/form-state.ts');
  assert.ok(formStateCode.includes('applyReceiptDraftToFormState'), 'Must export applyReceiptDraftToFormState');
  assert.ok(formStateCode.includes("type: 'EXPENSE'"), 'Form state must set type to EXPENSE');
  assert.ok(formStateCode.includes("accountId: ''"), 'Form state must reset accountId');
  assert.ok(!formStateCode.includes('new Date()'), 'Form state must not leak new Date()');
  console.log('  ✓ can_apply gate and zero-default form application verified');
}

// 7. Verifying unmounted isolation from live UI
{
  console.log('[7/7] Verifying unmounted isolation in live UI...');
  const addTransactionModal = readFile('src/components/finance/AddTransactionModal.tsx');
  assert.ok(!addTransactionModal.includes('analyzeReceiptAction'), 'Must NOT mount analyzeReceiptAction in live modal');
  assert.ok(!addTransactionModal.includes('executeAnalyzeReceiptAction'), 'Must NOT mount executeAnalyzeReceiptAction in live modal');
  console.log('  ✓ Live UI isolation verified');
}

console.log('--- ALL FINORA PHASE 12B SOURCE VERIFICATIONS PASSED ---');
