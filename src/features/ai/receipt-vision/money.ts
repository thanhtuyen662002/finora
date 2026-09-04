import 'server-only';

/**
 * Finora AI Receipt Vision — Exact Money Validation & Canonicalization
 * Phase 12B — Server-Only Money Layer
 *
 * Strict string-only monetary validation and canonicalization.
 * Floating-point arithmetic and Number()/parseFloat() coercion are strictly forbidden.
 */

const POSITIVE_PLAIN_DECIMAL_REGEX = /^[0-9]{1,16}(\.[0-9]{1,4})?$/;

/**
 * Validates whether a raw string conforms to POSITIVE_PLAIN_DECIMAL_STRING_MAX_SCALE_4.
 *
 * Requirements:
 * - 1..16 integer digits
 * - Optional fraction of 1..4 digits
 * - Strictly positive non-zero
 * - No grouping separators, signs, exponents, currency symbols, or whitespace
 */
export function isValidReceiptLexicalAmount(val: unknown): val is string {
  if (typeof val !== 'string' || val.trim() === '') {
    return false;
  }

  // Exact match required without trimming
  if (!POSITIVE_PLAIN_DECIMAL_REGEX.test(val)) {
    return false;
  }

  // Ensure value is strictly non-zero without using float parsing
  const isAllZeros = val.replace('.', '').split('').every((char) => char === '0');
  if (isAllZeros) {
    return false;
  }

  return true;
}

/**
 * Canonicalizes a valid positive lexical amount string into a 4-decimal canonical string.
 * e.g. "85000" -> "85000.0000", "4.5" -> "4.5000", "4.50" -> "4.5000", "4.5000" -> "4.5000".
 *
 * @throws Error if input is not a valid lexical amount string.
 */
export function canonicalizeReceiptAmount(val: string): string {
  if (!isValidReceiptLexicalAmount(val)) {
    throw new Error(`Invalid receipt lexical amount string for canonicalization: '${val}'`);
  }

  const dotIndex = val.indexOf('.');
  if (dotIndex === -1) {
    return `${val}.0000`;
  }

  const integerPart = val.slice(0, dotIndex);
  const fractionalPart = val.slice(dotIndex + 1);

  return `${integerPart}.${fractionalPart.padEnd(4, '0')}`;
}
