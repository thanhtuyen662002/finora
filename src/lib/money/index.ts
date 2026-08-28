/**
 * Exact Decimal Money Library
 * 
 * Implements exact decimal arithmetic and formatting using string manipulation
 * and BigInt. Prevents any floating point precision loss for PostgreSQL numeric(20,4).
 */

export function toExactDecimal(amount: number | string): string {
  let str = String(amount).trim();
  if (str === '') return '0.0000';
  let isNeg = str.startsWith('-');
  if (isNeg) str = str.substring(1);
  let [intPart, decPart = ''] = str.split('.');
  intPart = intPart.replace(/^0+(?=\d)/, '') || '0';
  decPart = decPart.padEnd(4, '0').substring(0, 4);
  return (isNeg ? '-' : '') + intPart + '.' + decPart;
}

export function isPositiveExactDecimal(amount: string | number): boolean {
  if (amount === undefined || amount === null) return false;
  const str = String(amount).trim();
  if (!/^\d+(\.\d+)?$/.test(str)) return false;
  const exact = toExactDecimal(str);
  return compareExactDecimals(exact, '0.0000') > 0;
}

export function addExactDecimals(a: string, b: string): string {
  const parse = (s: string) => {
    let str = s.trim();
    let sign = 1n;
    if (str.startsWith('-')) {
      sign = -1n;
      str = str.substring(1);
    }
    const [intP = '0', decP = ''] = str.split('.');
    const ip = BigInt(intP || '0');
    const dp = BigInt((decP || '').padEnd(4, '0').substring(0, 4));
    return sign * (ip * 10000n + dp);
  };
  const sum = parse(a) + parse(b);
  let sign = '';
  let absSum = sum;
  if (sum < 0n) {
    sign = '-';
    absSum = -sum;
  }
  const intStr = (absSum / 10000n).toString();
  const decStr = (absSum % 10000n).toString().padStart(4, '0');
  return sign + intStr + '.' + decStr;
}

export function subExactDecimals(a: string, b: string): string {
  let bNeg = b.trim();
  if (bNeg.startsWith('-')) bNeg = bNeg.substring(1);
  else bNeg = '-' + bNeg;
  return addExactDecimals(a, bNeg);
}

export function compareExactDecimals(a: string, b: string): number {
  const parse = (s: string) => {
    let str = s.trim();
    let sign = 1n;
    if (str.startsWith('-')) {
      sign = -1n;
      str = str.substring(1);
    }
    const [intP = '0', decP = ''] = str.split('.');
    const ip = BigInt(intP || '0');
    const dp = BigInt((decP || '').padEnd(4, '0').substring(0, 4));
    return sign * (ip * 10000n + dp);
  };
  const diff = parse(a) - parse(b);
  if (diff > 0n) return 1;
  if (diff < 0n) return -1;
  return 0;
}

export function groupThousands(intStr: string, separator: string = ','): string {
  let isNeg = false;
  let s = intStr.trim();
  if (s.startsWith('-')) {
    isNeg = true;
    s = s.substring(1);
  }
  s = s.replace(/^0+(?=\d)/, '');
  if (s === '') s = '0';
  
  const parts: string[] = [];
  let len = s.length;
  while (len > 3) {
    parts.unshift(s.substring(len - 3, len));
    len -= 3;
  }
  parts.unshift(s.substring(0, len));
  const grouped = parts.join(separator);
  return isNeg ? '-' + grouped : grouped;
}

export function formatExactDecimal(val: string): string {
  const str = String(val).trim();
  let [intP = '0', decP = '0000'] = str.split('.');
  intP = intP || '0';
  decP = (decP || '').padEnd(4, '0').substring(0, 4);
  
  const trimmedDec = decP.replace(/0+$/, '');
  const hasDecimals = trimmedDec.length > 0;
  const formattedInt = groupThousands(intP, ',');
  
  if (!hasDecimals) return formattedInt;
  return formattedInt + '.' + trimmedDec;
}

export function formatExactMoney(
  amountStr: string,
  currency: string = 'VND',
  options?: { showSign?: boolean }
): string {
  const normCurrency = (currency || 'VND').toUpperCase();
  const str = String(amountStr).trim();
  const isNeg = str.startsWith('-');
  const absStr = isNeg ? str.substring(1) : str;
  
  let [intP = '0', decP = '0000'] = absStr.split('.');
  intP = intP || '0';
  decP = (decP || '').padEnd(4, '0').substring(0, 4);
  const trimmedDec = decP.replace(/0+$/, '');
  const hasDecimals = trimmedDec.length > 0;
  
  const separator = normCurrency === 'VND' ? '.' : ',';
  const decimalSep = normCurrency === 'VND' ? ',' : '.';
  
  const groupedInt = groupThousands(intP, separator);
  
  let formattedNumber = '';
  if (normCurrency === 'VND' || normCurrency === 'JPY' || normCurrency === 'KRW') {
    if (hasDecimals) {
      formattedNumber = `${groupedInt}${decimalSep}${trimmedDec}`;
    } else {
      formattedNumber = groupedInt;
    }
  } else {
    // Show 2 decimal places for USD, EUR, etc. unless more non-zero decimals exist
    const dec2 = decP.substring(0, 2);
    const remaining = decP.substring(2).replace(/0+$/, '');
    const displayDec = remaining.length > 0 ? dec2 + remaining : dec2;
    formattedNumber = `${groupedInt}${decimalSep}${displayDec}`;
  }

  let result = '';
  switch (normCurrency) {
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
      result = `${formattedNumber} ${normCurrency}`;
  }

  if (isNeg) return `-${result}`;
  if (options?.showSign && compareExactDecimals(toExactDecimal(amountStr), '0.0000') > 0) return `+${result}`;
  return result;
}
