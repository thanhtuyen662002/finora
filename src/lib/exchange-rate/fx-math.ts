import { toExactDecimal } from '../money';

/**
 * Validates and normalizes a rate string to exactly 12 decimal places without floating-point math.
 */
export function toExactRate(rate: string): string {
  if (typeof rate !== 'string') {
    throw new Error('Invalid rate: must be a string');
  }
  const raw = rate.trim();
  const DECIMAL_PATTERN = /^\d+(?:\.\d+)?$/;

  if (!DECIMAL_PATTERN.test(raw)) {
    throw new Error('Invalid decimal rate: must be positive numeric string');
  }

  let [integerPart, fractionalPart = ''] = raw.split('.');

  if (fractionalPart.length > 12) {
    throw new Error(`Rate exceeds 12 fractional digits precision: ${raw}`);
  }

  integerPart = integerPart.replace(/^0+(?=\d)/, '') || '0';
  fractionalPart = fractionalPart.padEnd(12, '0');

  const normalized = `${integerPart}.${fractionalPart}`;

  if (normalized === '0.000000000000') {
    throw new Error('Rate must be greater than zero');
  }

  if (integerPart.length > 18) {
    throw new Error('Decimal value exceeds numeric(30,12) precision');
  }

  return normalized;
}

/**
 * Converts an exact amount (up to 4 decimals) using an exact rate (up to 12 decimals),
 * producing an exact amount (4 decimals) without thousands grouping.
 * Uses BigInt scaling and "round half away from zero".
 */
export function convertExactAmount(amountStr: string, rateStr: string): string {
  const exactAmount = toExactDecimal(amountStr);
  const exactRate = toExactRate(rateStr);

  const isNegativeAmount = exactAmount.startsWith('-');
  const amountUnsigned = isNegativeAmount ? exactAmount.slice(1) : exactAmount;

  // amount is scaled by 10^4
  const amountScaled = BigInt(amountUnsigned.replace('.', ''));
  // rate is scaled by 10^12
  const rateScaled = BigInt(exactRate.replace('.', ''));

  // product is scaled by 10^16
  const productScaled = amountScaled * rateScaled;

  // We want to reduce it to 10^4. We need to divide by 10^12.
  // To round half away from zero, we add 10^12 / 2 = 5 * 10^11
  const divisor = 1000000000000n; // 10^12
  const halfDivisor = 500000000000n; // 5 * 10^11

  let roundedScaledAmount = (productScaled + halfDivisor) / divisor;

  let resultInt = roundedScaledAmount / 10000n;

  if (resultInt.toString().length > 16) { // 20-4=16 for numeric(20,4)
    throw new Error('Conversion result exceeds numeric(20,4) precision');
  }

  let resultFrac = (roundedScaledAmount % 10000n).toString().padStart(4, '0');
  let result = `${resultInt}.${resultFrac}`;

  if (isNegativeAmount && result !== '0.0000') {
    result = '-' + result;
  }

  return result;
}

export function matchSnapshotVersion(existingSnapshots: any[], tx: any, targetCurrency: string) {
  const exactTxAmount = tx.amount.includes('.') ? tx.amount.padEnd(tx.amount.indexOf('.') + 5, '0').slice(0, tx.amount.indexOf('.') + 5) : `${tx.amount}.0000`;

  return existingSnapshots.find(s =>
    s.transaction_id === tx.id &&
    s.source_currency_code === tx.currency_code &&
    s.target_currency_code === targetCurrency &&
    s.source_amount === exactTxAmount &&
    s.requested_date === (tx.occurred_on || tx.occurred_at?.split('T')[0])
  );
}
