import { addDays, addMonthsClamped, addYearsClamped, diffCalendarDays, parseISODate } from '@/features/recurring/engine';
import { isPositiveExactDecimal, toExactDecimal } from '@/lib/money';
import type { DebtDetailRow, DebtPaymentFrequency } from '@/types/database';

export type DebtReminder = {
  debt: DebtDetailRow;
  dueDate: string;
  daysUntilDue: number;
};

function nextDueDate(
  debt: Pick<DebtDetailRow, 'first_due_date' | 'due_day' | 'payment_frequency'>,
  asOfDate: string
): string | null {
  if (!debt.first_due_date) return null;
  const anchor = parseISODate(debt.first_due_date);
  const frequency: DebtPaymentFrequency = debt.payment_frequency;
  if (frequency === 'ONE_TIME') {
    return debt.first_due_date >= asOfDate ? debt.first_due_date : null;
  }
  if (frequency === 'WEEKLY') {
    let current = debt.first_due_date;
    for (let i = 0; i < 520 && current < asOfDate; i += 1) current = addDays(current, 7);
    return current >= asOfDate ? current : null;
  }
  if (frequency === 'YEARLY') {
    for (let years = 0; years <= 100; years += 1) {
      const current = addYearsClamped(anchor.year, anchor.month, anchor.day, years);
      if (current >= asOfDate) return current;
    }
    return null;
  }
  const stepMonths = frequency === 'MONTHLY' ? 1 : 3;
  const day = debt.due_day ?? anchor.day;
  for (let periods = 0; periods <= 400; periods += 1) {
    const current = addMonthsClamped(anchor.year, anchor.month, day, periods * stepMonths);
    if (current >= asOfDate) return current;
  }
  return null;
}

export function getDebtReminder(
  debt: DebtDetailRow,
  asOfDate: string,
  windowDays = 3
): DebtReminder | null {
  if (debt.is_archived || !isPositiveExactDecimal(toExactDecimal(debt.outstanding_amount))) return null;
  const dueDate = nextDueDate(debt, asOfDate);
  if (!dueDate) return null;
  const daysUntilDue = diffCalendarDays(dueDate, asOfDate);
  if (daysUntilDue < 0 || daysUntilDue > windowDays) return null;
  return { debt, dueDate, daysUntilDue };
}

export function getDebtReminders(
  debts: DebtDetailRow[],
  asOfDate: string,
  windowDays = 3
): DebtReminder[] {
  return debts
    .map((debt) => getDebtReminder(debt, asOfDate, windowDays))
    .filter((item): item is DebtReminder => item !== null)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue || a.debt.name.localeCompare(b.debt.name, 'vi'));
}
