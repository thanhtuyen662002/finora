/**
 * Exact Decimal Money Library
 *
 * Monetary arithmetic is performed with normalized decimal strings and BigInt.
 * No native floating-point arithmetic is used for persisted finance values.
 */

const MAX_INTEGER_DIGITS = 16;
const SCALE = 4;
const DECIMAL_PATTERN = /^-?\d+(?:\.\d{1,4})?$/;

export function toExactDecimal(amount: string | number): string {
  const raw = String(amount).trim();
  if (!DECIMAL_PATTERN.test(raw)) {
    throw new Error('Invalid decimal value: expected at most 4 fractional digits');
  }

  const isNegative = raw.startsWith('-');
  const unsigned = isNegative ? raw.slice(1) : raw;
  let [integerPart, fractionalPart = ''] = unsigned.split('.');
  integerPart = integerPart.replace(/^0+(?=\d)/, '') || '0';

  if (integerPart.length > MAX_INTEGER_DIGITS) {
    throw new Error('Decimal value exceeds numeric(20,4) precision');
  }

  fractionalPart = fractionalPart.padEnd(SCALE, '0');
  const normalized = `${integerPart}.${fractionalPart}`;
  if (isNegative && normalized !== '0.0000') return `-${normalized}`;
  return normalized;
}

export function isPositiveExactDecimal(amount: string | number): boolean {
  try {
    return compareExactDecimals(toExactDecimal(amount), '0.0000') > 0;
  } catch {
    return false;
  }
}

function toScaledBigInt(value: string): bigint {
  const normalized = toExactDecimal(value);
  const isNegative = normalized.startsWith('-');
  const unsigned = isNegative ? normalized.slice(1) : normalized;
  const [integerPart, fractionalPart] = unsigned.split('.');
  const scaled = BigInt(integerPart) * 10000n + BigInt(fractionalPart);
  return isNegative ? -scaled : scaled;
}

function fromScaledBigInt(value: bigint): string {
  const isNegative = value < 0n;
  const absolute = isNegative ? -value : value;
  const integerPart = (absolute / 10000n).toString();
  const fractionalPart = (absolute % 10000n).toString().padStart(SCALE, '0');
  const normalized = `${integerPart}.${fractionalPart}`;
  return isNegative && absolute !== 0n ? `-${normalized}` : normalized;
}

export function addExactDecimals(a: string, b: string): string {
  return fromScaledBigInt(toScaledBigInt(a) + toScaledBigInt(b));
}

export function subExactDecimals(a: string, b: string): string {
  return fromScaledBigInt(toScaledBigInt(a) - toScaledBigInt(b));
}

export function compareExactDecimals(a: string, b: string): number {
  const diff = toScaledBigInt(a) - toScaledBigInt(b);
  if (diff > 0n) return 1;
  if (diff < 0n) return -1;
  return 0;
}

export function groupThousands(intStr: string, separator: string = ','): string {
  let isNegative = false;
  let value = intStr.trim();
  if (value.startsWith('-')) {
    isNegative = true;
    value = value.slice(1);
  }

  value = value.replace(/^0+(?=\d)/, '') || '0';
  const groups: string[] = [];
  let end = value.length;
  while (end > 3) {
    groups.unshift(value.slice(end - 3, end));
    end -= 3;
  }
  groups.unshift(value.slice(0, end));

  const grouped = groups.join(separator);
  return isNegative ? `-${grouped}` : grouped;
}

export function formatExactDecimal(value: string): string {
  const normalized = toExactDecimal(value);
  const isNegative = normalized.startsWith('-');
  const unsigned = isNegative ? normalized.slice(1) : normalized;
  const [integerPart, fractionalPart] = unsigned.split('.');
  const trimmedFraction = fractionalPart.replace(/0+$/, '');
  const groupedInteger = groupThousands(integerPart, ',');
  const formatted = trimmedFraction.length > 0
    ? `${groupedInteger}.${trimmedFraction}`
    : groupedInteger;
  return isNegative ? `-${formatted}` : formatted;
}

export function formatExactMoney(
  amountStr: string,
  currency: string = 'VND',
  options?: { showSign?: boolean }
): string {
  const normalizedCurrency = (currency || 'VND').toUpperCase();
  const normalized = toExactDecimal(amountStr);
  const isNegative = normalized.startsWith('-');
  const unsigned = isNegative ? normalized.slice(1) : normalized;
  const [integerPart, fractionalPart] = unsigned.split('.');
  const trimmedFraction = fractionalPart.replace(/0+$/, '');

  const thousandsSeparator = normalizedCurrency === 'VND' ? '.' : ',';
  const decimalSeparator = normalizedCurrency === 'VND' ? ',' : '.';
  const groupedInteger = groupThousands(integerPart, thousandsSeparator);

  let formattedNumber: string;
  if (normalizedCurrency === 'VND' || normalizedCurrency === 'JPY' || normalizedCurrency === 'KRW') {
    formattedNumber = trimmedFraction.length > 0
      ? `${groupedInteger}${decimalSeparator}${trimmedFraction}`
      : groupedInteger;
  } else {
    const firstTwo = fractionalPart.slice(0, 2);
    const remaining = fractionalPart.slice(2).replace(/0+$/, '');
    const displayFraction = remaining.length > 0 ? firstTwo + remaining : firstTwo;
    formattedNumber = `${groupedInteger}${decimalSeparator}${displayFraction}`;
  }

  let result: string;
  switch (normalizedCurrency) {
    case 'VND':
      result = `${formattedNumber} ₫`;
      break;
    case 'USD':
      result = `$${formattedNumber}`;
      break;
    case 'EUR':
      result = `€${formattedNumber}`;
      break;
    case 'JPY':
    case 'CNY':
      result = `¥${formattedNumber}`;
      break;
    case 'KRW':
      result = `₩${formattedNumber}`;
      break;
    default:
      result = `${formattedNumber} ${normalizedCurrency}`;
  }

  if (isNegative) return `-${result}`;
  if (options?.showSign && compareExactDecimals(normalized, '0.0000') > 0) return `+${result}`;
  return result;
}
