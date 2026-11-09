import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeNetWorthByCurrency } from '../src/features/reports/engine';
import type { AccountBalanceSnapshot, CurrencyAccountGroup } from '../src/features/reports/types';

function account(id: string, balance: string, opts: Partial<AccountBalanceSnapshot> = {}): AccountBalanceSnapshot {
  return {
    accountId: id,
    name: id,
    type: 'BANK',
    currency: 'VND',
    currentBalance: balance,
    color: '#000',
    institution: null,
    isArchived: false,
    linkedDebtId: null,
    ...opts,
  };
}

function group(currency: string, accounts: AccountBalanceSnapshot[]): CurrencyAccountGroup {
  return { currency, totalBalance: '0.0000', accounts };
}

test('linked credit accounts are excluded from assets and debts are subtracted', () => {
  // Bank + cash, plus a pay-later wallet and a credit card that are linked to debts.
  const groups = {
    VND: group('VND', [
      account('bank', '500000.0000'),
      account('cash', '100000.0000'),
      account('paylater', '-200000.0000', { type: 'EWALLET', linkedDebtId: 'd-paylater' }),
      account('card', '-300000.0000', { type: 'CREDIT_CARD', linkedDebtId: 'd-card' }),
    ]),
  };
  const result = computeNetWorthByCurrency(groups, [
    { currency_code: 'VND', outstanding_amount: '5200000.0000', is_archived: false },
    { currency_code: 'VND', outstanding_amount: '300000.0000', is_archived: false },
  ]);
  assert.deepEqual(result.VND, {
    currency: 'VND',
    totalAssets: '600000.0000',
    totalDebt: '5500000.0000',
    netWorth: '-4900000.0000',
    debtCount: 2,
  });
});

test('archived and settled debts do not count', () => {
  const result = computeNetWorthByCurrency({ VND: group('VND', [account('a', '1000.0000')]) }, [
    { currency_code: 'VND', outstanding_amount: '500.0000', is_archived: true },
    { currency_code: 'VND', outstanding_amount: '0.0000', is_archived: false },
  ]);
  assert.equal(result.VND.netWorth, '1000.0000');
  assert.equal(result.VND.debtCount, 0);
});

test('currencies are never mixed and debt-only currencies still appear', () => {
  const result = computeNetWorthByCurrency({ VND: group('VND', [account('a', '1000.0000')]) }, [
    { currency_code: 'usd', outstanding_amount: '25.5000', is_archived: false },
  ]);
  assert.equal(result.VND.netWorth, '1000.0000');
  assert.equal(result.USD.totalAssets, '0.0000');
  assert.equal(result.USD.netWorth, '-25.5000');
});

test('archived accounts are not assets', () => {
  const result = computeNetWorthByCurrency(
    { VND: group('VND', [account('a', '1000.0000'), account('b', '700.0000', { isArchived: true })]) },
    []
  );
  assert.equal(result.VND.totalAssets, '1000.0000');
});
