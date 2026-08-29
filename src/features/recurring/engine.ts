import type { RecurringFrequency } from './types';

export function parseISODate(dateStr: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) {
    throw new Error(`Invalid ISO date format: expected YYYY-MM-DD, got "${dateStr}"`);
  }
  return {
    year: parseInt(match[1], 10),
    month: parseInt(match[2], 10), // 1-12
    day: parseInt(match[3], 10),
  };
}

export function formatISODate(year: number, month: number, day: number): string {
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  if ([4, 6, 9, 11].includes(month)) {
    return 30;
  }
  return 31;
}

export function getTodayISODate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function diffCalendarDays(dateAStr: string, dateBStr: string): number {
  // Returns (dateA - dateB) in whole days
  const a = parseISODate(dateAStr);
  const b = parseISODate(dateBStr);
  const utcA = Date.UTC(a.year, a.month - 1, a.day);
  const utcB = Date.UTC(b.year, b.month - 1, b.day);
  return Math.round((utcA - utcB) / (1000 * 60 * 60 * 24));
}

export function addDays(dateStr: string, daysToAdd: number): string {
  const { year, month, day } = parseISODate(dateStr);
  const utc = Date.UTC(year, month - 1, day) + daysToAdd * (1000 * 60 * 60 * 24);
  const d = new Date(utc);
  return formatISODate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addMonthsClamped(
  anchorYear: number,
  anchorMonth: number,
  anchorDay: number,
  monthsToAdd: number
): string {
  const totalMonths = anchorMonth - 1 + monthsToAdd;
  const targetYear = anchorYear + Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12 + 12) % 12 + 1; // 1-12
  const maxDay = daysInMonth(targetYear, targetMonth);
  const targetDay = Math.min(anchorDay, maxDay);
  return formatISODate(targetYear, targetMonth, targetDay);
}

export function addYearsClamped(
  anchorYear: number,
  anchorMonth: number,
  anchorDay: number,
  yearsToAdd: number
): string {
  const targetYear = anchorYear + yearsToAdd;
  const targetMonth = anchorMonth;
  const maxDay = daysInMonth(targetYear, targetMonth);
  const targetDay = Math.min(anchorDay, maxDay);
  return formatISODate(targetYear, targetMonth, targetDay);
}

export function calculateNextDueDate(
  item: {
    anchor_date: string;
    frequency: RecurringFrequency;
    end_date?: string | null;
    is_paused?: boolean;
    is_archived?: boolean;
  },
  asOfDateStr: string = getTodayISODate()
): string | null {
  if (item.is_paused || item.is_archived) {
    return null;
  }

  const { anchor_date, frequency, end_date } = item;
  const anchor = parseISODate(anchor_date);
  let nextDateStr = anchor_date;

  if (frequency === 'WEEKLY') {
    let currentStr = anchor_date;
    while (currentStr < asOfDateStr) {
      currentStr = addDays(currentStr, 7);
    }
    nextDateStr = currentStr;
  } else if (frequency === 'MONTHLY') {
    let k = 0;
    let currentStr = addMonthsClamped(anchor.year, anchor.month, anchor.day, k);
    while (currentStr < asOfDateStr) {
      k += 1;
      currentStr = addMonthsClamped(anchor.year, anchor.month, anchor.day, k);
    }
    nextDateStr = currentStr;
  } else if (frequency === 'YEARLY') {
    let k = 0;
    let currentStr = addYearsClamped(anchor.year, anchor.month, anchor.day, k);
    while (currentStr < asOfDateStr) {
      k += 1;
      currentStr = addYearsClamped(anchor.year, anchor.month, anchor.day, k);
    }
    nextDateStr = currentStr;
  }

  if (end_date && nextDateStr > end_date) {
    return null;
  }

  return nextDateStr;
}

export function generateUpcomingOccurrences(
  item: {
    anchor_date: string;
    frequency: RecurringFrequency;
    end_date?: string | null;
    is_paused?: boolean;
    is_archived?: boolean;
  },
  limit: number = 5,
  asOfDateStr: string = getTodayISODate()
): string[] {
  if (item.is_paused || item.is_archived || limit <= 0) {
    return [];
  }

  const occurrences: string[] = [];
  const anchor = parseISODate(item.anchor_date);
  let k = 0;

  while (occurrences.length < limit) {
    let dateStr = '';
    if (item.frequency === 'WEEKLY') {
      dateStr = addDays(item.anchor_date, k * 7);
    } else if (item.frequency === 'MONTHLY') {
      dateStr = addMonthsClamped(anchor.year, anchor.month, anchor.day, k);
    } else if (item.frequency === 'YEARLY') {
      dateStr = addYearsClamped(anchor.year, anchor.month, anchor.day, k);
    }

    if (item.end_date && dateStr > item.end_date) {
      break;
    }

    if (dateStr >= asOfDateStr) {
      occurrences.push(dateStr);
    }

    k += 1;
    if (k > 1000) break; // safeguard
  }

  return occurrences;
}
