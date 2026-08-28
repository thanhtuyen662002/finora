export function toExactDecimal(amount: number | string): string {
  // Convert to 4 decimal places exactly without floating point issues
  // Using string manipulation to ensure precision
  let str = String(amount).trim();
  if (str === '') return '0.0000';
  let isNeg = str.startsWith('-');
  if (isNeg) str = str.substring(1);
  let [intPart, decPart] = str.split('.');
  intPart = intPart || '0';
  decPart = (decPart || '').padEnd(4, '0').substring(0, 4);
  return (isNeg ? '-' : '') + intPart + '.' + decPart;
}

export function addExactDecimals(a: string, b: string): string {
  // Add two 4-decimal exact strings using BigInt
  const parse = (s: string) => {
    let sign = 1n;
    if (s.startsWith('-')) {
      sign = -1n;
      s = s.substring(1);
    }
    const [intP, decP] = s.split('.');
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
  let bNeg = b;
  if (b.startsWith('-')) bNeg = b.substring(1);
  else bNeg = '-' + b;
  return addExactDecimals(a, bNeg);
}

export function compareExactDecimals(a: string, b: string): number {
  const parse = (s: string) => {
    let sign = 1n;
    if (s.startsWith('-')) {
      sign = -1n;
      s = s.substring(1);
    }
    const [intP, decP] = s.split('.');
    const ip = BigInt(intP || '0');
    const dp = BigInt((decP || '').padEnd(4, '0').substring(0, 4));
    return sign * (ip * 10000n + dp);
  };
  const diff = parse(a) - parse(b);
  if (diff > 0n) return 1;
  if (diff < 0n) return -1;
  return 0;
}

export function formatExactDecimal(val: string): string {
  // Format for display (e.g. 10000.0000 -> 10,000)
  // Drop .0000 if it's purely integer
  let [intP, decP] = val.split('.');
  intP = intP || '0';
  decP = decP || '0000';
  const hasDecimals = parseInt(decP, 10) > 0;
  
  let formattedInt = parseInt(intP, 10).toLocaleString('en-US');
  if (intP === '-0' && hasDecimals) {
    formattedInt = '-0';
  }
  
  if (!hasDecimals) return formattedInt;
  
  // Trim trailing zeros from decimals
  let trimmedDec = decP.replace(/0+$/, '');
  return formattedInt + '.' + trimmedDec;
}
