import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertPrincipalWithinOutstanding,
  normalizeDebtPaymentCurrency,
} from '../src/features/debts/payment-domain';
import { aggregateDebtRepaymentBreakdown } from '../src/features/reports/engine';

test('normalizes a same-currency repayment with a 1:1 rate', () => {
  const result = normalizeDebtPaymentCurrency({
    accountAmount: '850000',
    debtAmount: '850000',
    principalAmount: '800000',
    interestAmount: '50000',
    accountCurrencyCode: 'vnd',
    debtCurrencyCode: 'VND',
    exchangeRate: '1',
    exchangeRateSource: 'SAME_CURRENCY',
    exchangeRateEffectiveDate: '2026-09-09',
    paidOn: '2026-09-09',
  });

  assert.equal(result.accountAmount, '850000.0000');
  assert.equal(result.debtAmount, '850000.0000');
  assert.equal(result.exchangeRate, '1.000000000000');
  assert.equal(result.accountCurrencyCode, 'VND');
});

test('reconciles a cross-currency account amount into debt currency', () => {
  const result = normalizeDebtPaymentCurrency({
    accountAmount: '100',
    debtAmount: '2500000',
    principalAmount: '2400000',
    interestAmount: '100000',
    accountCurrencyCode: 'USD',
    debtCurrencyCode: 'VND',
    exchangeRate: '25000',
    exchangeRateSource: 'MANUAL',
    exchangeRateEffectiveDate: '2026-09-08',
    paidOn: '2026-09-09',
  });

  assert.equal(result.accountAmount, '100.0000');
  assert.equal(result.debtAmount, '2500000.0000');
  assert.equal(result.exchangeRate, '25000.000000000000');
  assert.equal(result.debtCurrencyCode, 'VND');
});

test('rejects cross-currency amounts that do not reconcile with the rate', () => {
  assert.throws(
    () => normalizeDebtPaymentCurrency({
      accountAmount: '100',
      debtAmount: '2499999',
      principalAmount: '2499999',
      interestAmount: '0',
      accountCurrencyCode: 'USD',
      debtCurrencyCode: 'VND',
      exchangeRate: '25000',
      exchangeRateSource: 'MANUAL',
      exchangeRateEffectiveDate: '2026-09-09',
      paidOn: '2026-09-09',
    }),
    /chưa khớp/
  );
});

test('rejects non-1 same-currency rates and future FX effective dates', () => {
  assert.throws(
    () => normalizeDebtPaymentCurrency({
      accountAmount: '100',
      debtAmount: '100',
      principalAmount: '100',
      interestAmount: '0',
      accountCurrencyCode: 'USD',
      debtCurrencyCode: 'USD',
      exchangeRate: '1.01',
      exchangeRateSource: 'MANUAL',
      exchangeRateEffectiveDate: '2026-09-10',
      paidOn: '2026-09-09',
    }),
    /không được sau/
  );
});

test('rejects unsupported monetary or rate precision instead of rounding silently', () => {
  assert.throws(
    () => normalizeDebtPaymentCurrency({
      accountAmount: '100.00001',
      debtAmount: '2500.0000',
      principalAmount: '2500',
      interestAmount: '0',
      accountCurrencyCode: 'USD',
      debtCurrencyCode: 'VND',
      exchangeRate: '25',
      exchangeRateSource: 'MANUAL',
      exchangeRateEffectiveDate: '2026-09-09',
      paidOn: '2026-09-09',
    }),
    /at most 4 fractional digits/
  );
});

test('rejects principal that exceeds the authoritative outstanding balance', () => {
  assert.throws(
    () => assertPrincipalWithinOutstanding('100.0000', '99.9999'),
    /vượt quá dư nợ/
  );
});

test('aggregates repayment cash, principal, and interest by currency pair', () => {
  const rows = [
    {
      amount: '100.0000',
      currency_code: 'USD',
      debt_amount: '2500000.0000',
      debt_currency_code: 'VND',
      principal_amount: '2400000.0000',
      interest_amount: '100000.0000',
      paid_on: '2026-09-08',
    },
    {
      amount: '40.0000',
      currency_code: 'USD',
      debt_amount: '1000000.0000',
      debt_currency_code: 'VND',
      principal_amount: '900000.0000',
      interest_amount: '100000.0000',
      paid_on: '2026-09-09',
    },
    {
      amount: '500.0000',
      currency_code: 'USD',
      debt_amount: '500.0000',
      debt_currency_code: 'USD',
      principal_amount: '500.0000',
      interest_amount: '0.0000',
      paid_on: '2026-09-09',
    },
  ] as any;

  const result = aggregateDebtRepaymentBreakdown(rows, 'USD', '2026-09-08', '2026-09-09');
  assert.equal(result.length, 2);

  const cross = result.find((item) => item.debtCurrency === 'VND');
  assert.ok(cross);
  assert.equal(cross.cashOutflow, '140.0000');
  assert.equal(cross.debtAmount, '3500000.0000');
  assert.equal(cross.principalAmount, '3300000.0000');
  assert.equal(cross.interestAmount, '200000.0000');
  assert.equal(cross.paymentCount, 2);
});

test('report aggregation never includes another account currency', () => {
  const result = aggregateDebtRepaymentBreakdown([
    {
      amount: '1000000.0000',
      currency_code: 'VND',
      debt_amount: '1000000.0000',
      debt_currency_code: 'VND',
      principal_amount: '1000000.0000',
      interest_amount: '0.0000',
      paid_on: '2026-09-09',
    },
  ] as any, 'USD');

  assert.deepEqual(result, []);
});

test('source contract keeps the new RPC and FX snapshot boundary explicit', async () => {
  const fs = await import('node:fs/promises');
  const migration = await fs.readFile(
    new URL('../supabase/migrations/20260909071009_phase_13b2_cross_currency_repayments.sql', import.meta.url),
    'utf8'
  );

  assert.match(migration, /record_debt_payment_v2/);
  assert.match(migration, /round\(p_account_amount \* p_exchange_rate, 4\)/);
  assert.match(migration, /transaction_fx_snapshots/);
  assert.match(migration, /SET search_path = ''/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.record_debt_payment_v2/);
});
