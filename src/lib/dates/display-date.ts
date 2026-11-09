/**
 * Conversions between the stored ISO calendar date (yyyy-MM-dd) and the
 * Vietnamese display format (dd/MM/yyyy). Pure string logic: no Date objects
 * or time zones, so a calendar date never shifts by a day.
 */

const ISO_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DISPLAY_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isValidParts(year: number, month: number, day: number): boolean {
  return year >= 1900 && year <= 2999 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

/** "2026-11-09" -> "09/11/2026"; returns "" for empty or malformed input. */
export function isoToDisplayDate(iso: string | null | undefined): string {
  const match = ISO_PATTERN.exec((iso || '').slice(0, 10));
  if (!match) return '';
  return `${match[3]}/${match[2]}/${match[1]}`;
}

/** "09/11/2026" -> "2026-11-09"; returns null unless it is a real calendar date. */
export function displayToIsoDate(display: string): string | null {
  const match = DISPLAY_PATTERN.exec(display.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!isValidParts(year, month, day)) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

/**
 * Formats free typing into dd/MM/yyyy as the user types: keeps digits only
 * (max 8) and inserts the slashes. "0911" -> "09/11", "09112026" -> "09/11/2026".
 */
export function maskDisplayDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}
