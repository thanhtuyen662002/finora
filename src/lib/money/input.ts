/**
 * Money Input & Formatting Utilities
 *
 * Provides string-based, BigInt-safe parsing and formatting for user monetary inputs.
 * Strictly avoids floating-point math.
 */

import { groupThousands } from './index';

export function isZeroDecimalCurrency(currency: string = 'VND'): boolean {
  const norm = (currency || 'VND').toUpperCase();
  return norm === 'VND' || norm === 'JPY' || norm === 'KRW';
}

/**
 * Formats a canonical decimal string or raw digits string into a localized input display.
 * For VND: integer-only, dot-separated thousands (e.g. "1000000" or "1000000.0000" -> "1.000.000").
 * For JPY/KRW: integer-only, comma-separated thousands (e.g. "1000" -> "1,000").
 * For USD/EUR/others: comma-separated thousands with dot decimal (e.g. "1000.50" -> "1,000.50").
 */
export function formatMoneyInputDisplay(
  value: string,
  currency: string = 'VND'
): string {
  if (!value || typeof value !== 'string') return '';
  const raw = value.trim();
  if (!raw) return '';

  const normCurrency = (currency || 'VND').toUpperCase();
  const isNegative = raw.startsWith('-');
  const unsigned = isNegative ? raw.slice(1) : raw;

  if (normCurrency === 'VND') {
    // VND is strictly integer-only with dot thousands separator
    const integerPart = unsigned.split('.')[0].replace(/\D/g, '');
    const cleanInteger = integerPart.replace(/^0+(?=\d)/, '');
    if (!cleanInteger) {
      return integerPart === '0' || unsigned.startsWith('0') ? (isNegative ? '-0' : '0') : '';
    }
    const grouped = groupThousands(cleanInteger, '.');
    return isNegative ? `-${grouped}` : grouped;
  }

  if (normCurrency === 'JPY' || normCurrency === 'KRW') {
    // Zero-decimal currencies with comma thousands separator
    const integerPart = unsigned.split('.')[0].replace(/\D/g, '');
    const cleanInteger = integerPart.replace(/^0+(?=\d)/, '');
    if (!cleanInteger) {
      return integerPart === '0' || unsigned.startsWith('0') ? (isNegative ? '-0' : '0') : '';
    }
    const grouped = groupThousands(cleanInteger, ',');
    return isNegative ? `-${grouped}` : grouped;
  }

  // General currencies (USD, EUR, etc.) supporting up to 4 decimals
  const hasDot = unsigned.includes('.');
  const [intPartRaw = '', fracPartRaw = ''] = unsigned.split('.');
  const intDigits = intPartRaw.replace(/\D/g, '');
  const cleanInt = intDigits.replace(/^0+(?=\d)/, '');
  const effectiveInt = cleanInt || (intDigits === '0' || unsigned.startsWith('0') ? '0' : '');

  if (!effectiveInt && !hasDot) return '';

  const groupedInt = effectiveInt ? groupThousands(effectiveInt, ',') : '0';
  const fracDigits = fracPartRaw.replace(/\D/g, '').slice(0, 4);

  let formatted = groupedInt;
  if (hasDot) {
    formatted = `${groupedInt}.${fracDigits}`;
  }

  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Parses user input text into a clean decimal string suitable for toExactDecimal.
 * For VND: returns integer string (e.g. "1000000" or "0").
 * For other currencies: returns clean decimal string (e.g. "1000.50" or "0.5").
 */
export function parseMoneyInputValue(
  inputText: string,
  currency: string = 'VND'
): string {
  if (!inputText || typeof inputText !== 'string') return '';
  const raw = inputText.trim();
  if (!raw) return '';

  const normCurrency = (currency || 'VND').toUpperCase();
  const isNegative = raw.startsWith('-');
  const unsigned = isNegative ? raw.slice(1) : raw;

  if (normCurrency === 'VND' || normCurrency === 'JPY' || normCurrency === 'KRW') {
    // Integer only: strip non-digits, truncate to 16 integer digits
    const digits = unsigned.replace(/\D/g, '').slice(0, 16);
    const cleaned = digits.replace(/^0+(?=\d)/, '');
    if (!cleaned) {
      return digits === '0' ? '0' : '';
    }
    return isNegative ? `-${cleaned}` : cleaned;
  }

  // Find the last separator (dot or comma) to determine the decimal point
  const lastDot = unsigned.lastIndexOf('.');
  const lastComma = unsigned.lastIndexOf(',');

  let decimalIndex = -1;

  if (lastDot !== -1 && lastComma !== -1) {
    decimalIndex = Math.max(lastDot, lastComma);
  } else if (lastDot !== -1) {
    decimalIndex = lastDot;
  } else if (lastComma !== -1) {
    const digitsAfterLastComma = unsigned.length - 1 - lastComma;
    if (digitsAfterLastComma === 3) {
      decimalIndex = -1;
    } else {
      decimalIndex = lastComma;
    }
  }

  let intPart = '';
  let fracPart = '';

  if (decimalIndex !== -1) {
    const rawInt = unsigned.slice(0, decimalIndex);
    const rawFrac = unsigned.slice(decimalIndex + 1);
    intPart = rawInt.replace(/\D/g, '').slice(0, 16);
    fracPart = rawFrac.replace(/\D/g, '').slice(0, 4);
  } else {
    intPart = unsigned.replace(/\D/g, '').slice(0, 16);
  }

  const cleanInt = intPart.replace(/^0+(?=\d)/, '');
  const effectiveInt = cleanInt || (intPart === '0' || unsigned.startsWith('0') ? '0' : '');

  if (!effectiveInt && !fracPart && decimalIndex === -1) {
    return '';
  }

  const resultInt = effectiveInt || '0';
  const result = decimalIndex !== -1 ? `${resultInt}.${fracPart}` : resultInt;
  return isNegative && result !== '0' && result !== '0.0000' ? `-${result}` : result;
}
