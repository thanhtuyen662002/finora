import test from 'node:test';
import assert from 'node:assert/strict';
import { getDebtReminder, getDebtReminders } from '@/features/debts/reminders';
import type { DebtDetailRow } from '@/types/database';

function debt(overrides: Partial<DebtDetailRow> = {}): DebtDetailRow {
  return {
    id: 'debt-1',
    user_id: 'user-1',
    name: 'Khoản vay thử',
    lender_name: 'Ngân hàng',
    debt_type: 'PERSONAL_LOAN',
    principal_amount: '10000000.0000',
    outstanding_amount: '9000000.0000',
    currency_code: 'VND',
    interest_rate: '10.0000',
    minimum_payment: '1000000.0000',
    payment_frequency: 'MONTHLY',
    first_due_date: '2026-09-12',
    due_day: 12,
    note: null,
    is_archived: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    paid_principal_amount: '1000000.0000',
    paid_interest_amount: '0.0000',
    payment_count: 1,
    ...overrides,
  };
}

test('debt reminder includes a monthly due date within the three-day window', () => {
  const reminder = getDebtReminder(debt(), '2026-09-09');
  assert.equal(reminder?.dueDate, '2026-09-12');
  assert.equal(reminder?.daysUntilDue, 3);
});

test('quarterly due dates respect due_day and month clamping', () => {
  const reminder = getDebtReminder(
    debt({ payment_frequency: 'QUARTERLY', first_due_date: '2026-01-31', due_day: 31 }),
    '2026-04-27'
  );
  assert.equal(reminder?.dueDate, '2026-04-30');
});

test('one-time, archived, settled, and undated debts do not create reminders', () => {
  assert.equal(getDebtReminder(debt({ payment_frequency: 'ONE_TIME' }), '2026-09-13'), null);
  assert.equal(getDebtReminder(debt({ is_archived: true }), '2026-09-09'), null);
  assert.equal(getDebtReminder(debt({ outstanding_amount: '0.0000' }), '2026-09-09'), null);
  assert.equal(getDebtReminder(debt({ first_due_date: null }), '2026-09-09'), null);
});

test('reminders are sorted by urgency and then name', () => {
  const reminders = getDebtReminders([
    debt({ id: 'later', name: 'B', first_due_date: '2026-09-12' }),
    debt({ id: 'today', name: 'Z', first_due_date: '2026-09-09' }),
    debt({ id: 'same', name: 'A', first_due_date: '2026-09-12' }),
  ], '2026-09-09');
  assert.deepEqual(reminders.map((item) => item.debt.id), ['today', 'same', 'later']);
});
