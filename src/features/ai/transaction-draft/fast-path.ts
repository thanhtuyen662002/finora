import 'server-only';

/**
 * Finora AI Feature Module — Deterministic Transaction Fast Path
 * Phase 12A — Corrective Pass 1: Conservative Deterministic Parser with Gemini Fallback
 *
 * Invariants:
 * 1. Zero Gemini / AI Provider Usage:
 *    Executes purely deterministic string and regex parsing. No external network or LLM calls.
 * 2. Conservative Eligibility Gate:
 *    Any ambiguity, multiple amounts, range amounts, correction markers, multi-transaction markers,
 *    conflicting income/expense semantics, currency conflicts, or invalid dates returns eligible: false (falls back to Gemini).
 * 3. Exact 11-Key Output Boundary:
 *    When eligible, returns the exact AiTransactionParseOutput shape, which converges through
 *    aiTransactionParseOutputValidator.validate, crossValidateTransactionDraft, candidate revalidation, and user preview.
 * 4. Zero Financial Mutation:
 *    Pure read-only parsing function. Absolutely no database mutations.
 * 5. Pure String Decimal Arithmetic & No Silent Truncation:
 *    Colloquial multipliers (k, tr, triệu, tỷ, etc.) are computed via pure string manipulations.
 *    Canonical exact scale is numeric(20,4). Never silently truncates non-zero fractional digits.
 *    NEVER uses Number(), parseFloat(), or JavaScript floating-point arithmetic for money.
 */

import {
  type AiTransactionParseOutput,
  type OpaqueCandidateContext,
  isSupportedCurrencyCode,
  SUPPORTED_CURRENCY_CODES,
} from './types';
import { isValidCalendarDate } from './validator';

export interface FastPathResult {
  readonly eligible: boolean;
  readonly output: AiTransactionParseOutput | null;
}

export interface FastPathParams {
  readonly text: string;
  readonly candidates: OpaqueCandidateContext;
  readonly baseCurrency: string;
  readonly timezone: string;
  readonly locale: string;
  readonly now?: Date;
}

/**
 * Normalize Vietnamese text for case-insensitive matching without diacritics.
 */
export function removeVietnameseAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Compute ISO date string (YYYY-MM-DD) for trusted server relative day offsets.
 */
export function getIsoDateWithOffset(now: Date, timezone: string, dayOffset: number): string {
  const todayIso = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  if (dayOffset === 0) {
    return todayIso;
  }

  const parts = todayIso.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  const offsetDate = new Date(Date.UTC(y, m - 1, d + dayOffset));
  const yearStr = String(offsetDate.getUTCFullYear());
  const monthStr = String(offsetDate.getUTCMonth() + 1).padStart(2, '0');
  const dayStr = String(offsetDate.getUTCDate()).padStart(2, '0');
  return `${yearStr}-${monthStr}-${dayStr}`;
}

/**
 * Format string decimal to exact canonical numeric(20,4) without silent truncation.
 * Returns exact string decimal (e.g. "85000.0000", "4.5000") or null if invalid / non-zero truncation needed / zero.
 */
function formatExactMoneyDecimal(intPartRaw: string, fracPartRaw: string): string | null {
  const intPart = intPartRaw.replace(/^0+/, '') || '0';
  // Maximum integer precision consistent with numeric(20,4) authority (max 16 integer digits)
  if (intPart.length > 16) {
    return null;
  }

  // Check fractional precision: never silently truncate non-zero digits
  if (fracPartRaw.length > 4) {
    const excessDigits = fracPartRaw.slice(4);
    if (/[1-9]/.test(excessDigits)) {
      // Non-zero excess precision -> ineligible -> fallback
      return null;
    }
  }

  const frac4 = fracPartRaw.slice(0, 4).padEnd(4, '0');

  // Check if amount is zero
  if (intPart === '0' && frac4 === '0000') {
    return null;
  }

  return `${intPart}.${frac4}`;
}

/**
 * Parses monetary amount using string manipulations with ZERO floating point arithmetic.
 * Returns exact string decimal (e.g. "85000.0000", "4.5000") or null if invalid / ambiguous / non-zero truncated.
 */
export function parseFastPathAmount(rawAmountStr: string): string | null {
  const trimmed = rawAmountStr.trim().toLowerCase();
  if (!trimmed) return null;

  // Clean currency symbols / suffixes if present at start or end
  let cleaned = trimmed;
  cleaned = cleaned.replace(/^[\$€¥]/, '').trim();
  cleaned = cleaned.replace(/\s*(?:vnd|usd|eur|jpy|cny|krw|dong|đồng|đ|d|\$|€|¥)$/iu, '').trim();
  if (!cleaned) return null;

  // 1. Dot-thousands standard Vietnamese formatted number e.g. "85.000", "120.000", "1.000.000"
  const dotThousandsMatch = cleaned.match(/^(\d{1,3}(?:\.\d{3})+)$/);
  if (dotThousandsMatch) {
    const intStr = dotThousandsMatch[1].replace(/\./g, '');
    return formatExactMoneyDecimal(intStr, '');
  }

  // 2. Comma-thousands standard Western formatted number e.g. "1,000" or "1,000.50"
  const commaThousandsMatch = cleaned.match(/^(\d{1,3}(?:,\d{3})+)(?:\.(\d+))?$/);
  if (commaThousandsMatch) {
    const intStr = commaThousandsMatch[1].replace(/,/g, '');
    const fracStr = commaThousandsMatch[2] || '';
    return formatExactMoneyDecimal(intStr, fracStr);
  }

  // 3. Pattern: <digits_with_dot_or_comma><optional_space><multiplier>
  const match = cleaned.match(
    /^(\d+(?:[.,]\d+)?)\s*(k|nghin|ngan|nghìn|ngàn|tr|triệu|trieu|m|ty|tỷ|b)?$/iu
  );

  if (!match) {
    return null;
  }

  const numberPart = match[1].replace(',', '.');
  const multiplierPart = (match[2] || '').toLowerCase();

  let zerosToAdd = 0;
  if (
    multiplierPart === 'k' ||
    multiplierPart === 'nghin' ||
    multiplierPart === 'ngan' ||
    multiplierPart === 'nghìn' ||
    multiplierPart === 'ngàn'
  ) {
    zerosToAdd = 3;
  } else if (
    multiplierPart === 'tr' ||
    multiplierPart === 'triệu' ||
    multiplierPart === 'trieu' ||
    multiplierPart === 'm'
  ) {
    zerosToAdd = 6;
  } else if (multiplierPart === 'ty' || multiplierPart === 'tỷ' || multiplierPart === 'b') {
    zerosToAdd = 9;
  }

  const parts = numberPart.split('.');
  const intPartRaw = parts[0] || '0';
  const fracPartRaw = parts[1] || '';

  const intPart = intPartRaw.replace(/^0+/, '') || '0';

  let resultInt: string;
  let resultFrac: string;

  if (zerosToAdd > 0) {
    if (fracPartRaw.length === 0) {
      resultInt = intPart === '0' ? '0' : intPart + '0'.repeat(zerosToAdd);
      resultFrac = '';
    } else if (fracPartRaw.length <= zerosToAdd) {
      const combined = intPart === '0' ? fracPartRaw : intPart + fracPartRaw;
      resultInt = combined + '0'.repeat(zerosToAdd - fracPartRaw.length);
      resultFrac = '';
    } else {
      const combinedInt =
        intPart === '0'
          ? fracPartRaw.slice(0, zerosToAdd)
          : intPart + fracPartRaw.slice(0, zerosToAdd);
      resultInt = combinedInt;
      resultFrac = fracPartRaw.slice(zerosToAdd);
    }
  } else {
    resultInt = intPart;
    resultFrac = fracPartRaw;
  }

  return formatExactMoneyDecimal(resultInt, resultFrac);
}

/**
 * Detect explicit currencies mentioned in text.
 */
export function detectExplicitCurrencies(text: string): readonly string[] {
  const currencies = new Set<string>();
  const upper = text.toUpperCase();

  // Check 3-letter codes
  for (const code of SUPPORTED_CURRENCY_CODES) {
    const regex = new RegExp(`(?:^|[\\s,;!?()[\\]{}])${code}(?=$|[\\s,;!?()[\\]{}])`, 'i');
    if (regex.test(upper)) {
      currencies.add(code);
    }
  }

  // Check currency names and symbols
  if (/(?:^|[\s,;!?()[\]{}])(?:dollar|dollars)(?=$|[\s,;!?()[\]{}])/i.test(text) || /\$\s*\d|\d\s*\$/.test(text)) {
    currencies.add('USD');
  }
  if (/(?:^|[\s,;!?()[\]{}])(?:euro|euros)(?=$|[\s,;!?()[\]{}])/i.test(text) || /€\s*\d|\d\s*€/.test(text)) {
    currencies.add('EUR');
  }
  if (/(?:^|[\s,;!?()[\]{}])(?:yen)(?=$|[\s,;!?()[\]{}])/i.test(text) || /¥\s*\d|\d\s*¥/.test(text)) {
    currencies.add('JPY');
  }
  if (/(?:^|[\s,;!?()[\]{}])(?:yuan|tệ)(?=$|[\s,;!?()[\]{}])/iu.test(text)) {
    currencies.add('CNY');
  }
  if (/(?:^|[\s,;!?()[\]{}])(?:won)(?=$|[\s,;!?()[\]{}])/i.test(text)) {
    currencies.add('KRW');
  }
  if (
    /(?:^|[\s,;!?()[\]{}])(?:dong|đồng|đ)(?=$|[\s,;!?()[\]{}])/iu.test(text) ||
    /\d+\s*(?:d|đ|dong|đồng)(?=$|[\s,;!?()[\]{}])/iu.test(text)
  ) {
    currencies.add('VND');
  }

  return Array.from(currencies);
}

/**
 * Checks if text contains Vietnamese shorthand multipliers (which inherently carry VND semantics).
 */
export function hasVietnameseMultiplier(text: string): boolean {
  return /(?:^|[\s,;!?()[\]{}])\d+(?:[.,]\d+)?\s*(?:k|nghìn|ngàn|nghin|ngan|tr|triệu|trieu|tỷ|ty)(?=$|[\s,;!?()[\]{}])/iu.test(
    text
  );
}

/**
 * Scan text for date patterns, validate them, and mask date spans out of text
 * so date components are never interpreted as monetary amounts.
 */
export function maskDateSpansAndExtractDate(
  text: string,
  timezone: string,
  now: Date
): {
  readonly maskedText: string;
  readonly detectedDate: string | null;
  readonly hasInvalidDate: boolean;
} {
  let workingText = text;
  let detectedDate: string | null = null;
  let hasInvalidDate = false;

  // 1. Check relative date keywords first
  const normalized = removeVietnameseAccents(text.toLowerCase());
  if (/(?:^|[\s,;!?()[\]{}])(hom kia)(?=$|[\s,;!?()[\]{}])/.test(normalized)) {
    detectedDate = getIsoDateWithOffset(now, timezone, -2);
    workingText = workingText.replace(/\bhom\s+kia\b/gi, '        ').replace(/\bhôm\s+kia\b/gi, '        ');
  } else if (/(?:^|[\s,;!?()[\]{}])(hom qua|yesterday)(?=$|[\s,;!?()[\]{}])/.test(normalized)) {
    detectedDate = getIsoDateWithOffset(now, timezone, -1);
    workingText = workingText
      .replace(/\bhom\s+qua\b/gi, '        ')
      .replace(/\bhôm\s+qua\b/gi, '        ')
      .replace(/\byesterday\b/gi, '         ');
  } else if (/(?:^|[\s,;!?()[\]{}])(hom nay|today)(?=$|[\s,;!?()[\]{}])/.test(normalized)) {
    detectedDate = getIsoDateWithOffset(now, timezone, 0);
    workingText = workingText
      .replace(/\bhom\s+nay\b/gi, '        ')
      .replace(/\bhôm\s+nay\b/gi, '        ')
      .replace(/\btoday\b/gi, '     ');
  }

  // 2. Check ISO Date: YYYY-MM-DD
  const isoMatches = Array.from(workingText.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g));
  for (const match of isoMatches) {
    const rawMatch = match[0];
    if (isValidCalendarDate(rawMatch)) {
      if (!detectedDate) {
        detectedDate = rawMatch;
      }
    } else {
      hasInvalidDate = true;
    }
  }

  // 3. Check Slash Date: DD/MM/YYYY
  const slashMatches = Array.from(workingText.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g));
  for (const match of slashMatches) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    const candidateIso = `${year}-${month}-${day}`;
    if (isValidCalendarDate(candidateIso)) {
      if (!detectedDate) {
        detectedDate = candidateIso;
      }
    } else {
      hasInvalidDate = true;
    }
  }

  // 4. Check Dash Date: DD-MM-YYYY
  const dashMatches = Array.from(workingText.matchAll(/\b(\d{1,2})-(\d{1,2})-(\d{4})\b/g));
  for (const match of dashMatches) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    const candidateIso = `${year}-${month}-${day}`;
    if (isValidCalendarDate(candidateIso)) {
      if (!detectedDate) {
        detectedDate = candidateIso;
      }
    } else {
      hasInvalidDate = true;
    }
  }

  // Mask all date patterns from workingText to avoid numbers inside dates becoming amounts
  workingText = workingText.replace(
    /(?:ngày\s+|ngay\s+)?\b\d{4}-\d{2}-\d{2}\b/gi,
    (m) => ' '.repeat(m.length)
  );
  workingText = workingText.replace(
    /(?:ngày\s+|ngay\s+)?\b\d{1,2}\/\d{1,2}\/\d{4}\b/gi,
    (m) => ' '.repeat(m.length)
  );
  workingText = workingText.replace(
    /(?:ngày\s+|ngay\s+)?\b\d{1,2}-\d{1,2}-\d{4}\b/gi,
    (m) => ' '.repeat(m.length)
  );

  // Mask bare day-in-date context e.g. "ngày 4", "ngày 15", "ngay 20"
  workingText = workingText.replace(
    /(?:ngày|ngay)\s+\d{1,2}(?:\s*(?:tháng|thang)\s*\d{1,2})?(?:\s*(?:năm|nam)\s*\d{4})?/gi,
    (m) => ' '.repeat(m.length)
  );

  // If no date was found, default to trusted server today
  if (!detectedDate && !hasInvalidDate) {
    detectedDate = getIsoDateWithOffset(now, timezone, 0);
  }

  return {
    maskedText: workingText,
    detectedDate,
    hasInvalidDate,
  };
}

/**
 * Scan text for potential amounts and fallback triggers.
 * Ensures complete candidate token consumption without partial prefix matching.
 */
export function extractPotentialAmounts(text: string): {
  readonly amounts: readonly string[];
  readonly hasRange: boolean;
  readonly hasCorrection: boolean;
  readonly hasMultiTransaction: boolean;
  readonly hasUnconsumedToken: boolean;
} {
  const normalized = removeVietnameseAccents(text.toLowerCase());

  // Check range markers
  const hasRange =
    /\b\d+\s*[-~]\s*\d+/.test(text) ||
    /(?:^|[\s,;!?()[\]{}])(khoang|tam|tu)\s+\d+.*(den|-)\s*\d+/.test(normalized) ||
    /(?:^|[\s,;!?()[\]{}])khoang\s+\d+/.test(normalized) ||
    /(?:^|[\s,;!?()[\]{}])tam\s+\d+/.test(normalized);

  // Check correction / conflict markers
  const hasCorrection =
    /(?:^|[\s,;!?()[\]{}])(khong phai|thuc ra|nham|thay vi|sua thanh|doi thanh|chu khong phai|ma la)(?=$|[\s,;!?()[\]{}])/.test(
      normalized
    );

  // Check multi-transaction markers
  const hasMultiTransaction =
    /(?:^|[\s,;!?()[\]{}])(chia.*thanh|chia lam|roi sau do)(?=$|[\s,;!?()[\]{}])/.test(normalized) ||
    /\d+\s*(?:k|tr|trieu|nghin|ngan|vnd|usd|eur|jpy|cny|krw|d|đ)\s+roi\s+\d+/i.test(normalized);

  // Unicode-safe Regex for compound monetary expressions
  // Matches expressions like "25 trieu", "85 nghin", "1.5 tr", "2 tỷ", "85k", "85.000", "120.000d", "120.000 VND", "4.50 USD", "$4.50", "€100"
  const compoundAmountRegex =
    /(?:^|(?<=[\s,;!?()[\]{}]))(?:[\$€¥]\s*)?(?:\d{1,3}(?:\.\d{3})+|\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:[.,]\d+)?)(?:\s*(?:k|nghin|ngan|nghìn|ngàn|tr|triệu|trieu|m|ty|tỷ|b))?(?:\s*(?:vnd|usd|eur|jpy|cny|krw|dong|đồng|đ|d|\$|€|¥))?(?=$|[\s,;!?()[\]{}])/giu;

  const foundAmounts: string[] = [];
  const matchedSpans: Array<{ start: number; end: number; raw: string }> = [];

  const matches = Array.from(text.matchAll(compoundAmountRegex));
  for (const m of matches) {
    const rawMatch = m[0].trim();
    if (!/\d/.test(rawMatch)) continue;

    const parsed = parseFastPathAmount(rawMatch);
    if (parsed) {
      foundAmounts.push(parsed);
      const matchIndex = m.index ?? 0;
      // account for leading boundary offset if any
      const actualStart = text.indexOf(rawMatch, matchIndex);
      matchedSpans.push({
        start: actualStart >= 0 ? actualStart : matchIndex,
        end: (actualStart >= 0 ? actualStart : matchIndex) + rawMatch.length,
        raw: rawMatch,
      });
    }
  }

  // Full token consumption check:
  // Inspect every contiguous word token in the text containing digits.
  // Verify that any digits in the word token belong completely to a valid matched amount span.
  const wordTokens = Array.from(text.matchAll(/[^\s,;!?()[\]{}]+/gu));
  let hasUnconsumedToken = false;

  for (const wt of wordTokens) {
    const word = wt[0];
    if (!/\d/.test(word)) continue;

    const wordStart = wt.index ?? 0;
    const wordEnd = wordStart + word.length;

    // Check if this word was completely covered by one of our matched amount spans
    const isCovered = matchedSpans.some(
      (span) => span.start <= wordStart && span.end >= wordEnd
    );

    if (!isCovered) {
      // Check if it's a standalone valid calendar year
      if (/^\d{4}$/.test(word)) {
        const yr = parseInt(word, 10);
        if (yr >= 1900 && yr <= 2100) {
          continue;
        }
      }
      hasUnconsumedToken = true;
    }
  }

  return {
    amounts: foundAmounts,
    hasRange,
    hasCorrection,
    hasMultiTransaction,
    hasUnconsumedToken,
  };
}

/**
 * Detect transaction type via conservative centralized keyword rules.
 */
export function detectFastPathType(text: string): 'INCOME' | 'EXPENSE' | null {
  const normalized = removeVietnameseAccents(text.toLowerCase());

  const expenseKeywords = [
    'chi',
    'mua',
    'tra',
    'thanh toan',
    'an sang',
    'an trua',
    'an toi',
    'an',
    'coffee',
    'ca phe',
    'xang',
    'do xang',
    'grab',
    'taxi',
    'di cho',
  ];

  const incomeKeywords = [
    'nhan luong',
    'luong',
    'nhan thuong',
    'thuong',
    'thu nhap',
    'duoc tra',
    'nhan tien',
    'tien thuong',
  ];

  let hasExpense = false;
  for (const kw of expenseKeywords) {
    const regex = new RegExp(`(?:^|[\\s,;!?()[\\]{}])${kw}(?=$|[\\s,;!?()[\\]{}])`, 'i');
    if (regex.test(normalized)) {
      hasExpense = true;
      break;
    }
  }

  let hasIncome = false;
  for (const kw of incomeKeywords) {
    const regex = new RegExp(`(?:^|[\\s,;!?()[\\]{}])${kw}(?=$|[\\s,;!?()[\\]{}])`, 'i');
    if (regex.test(normalized)) {
      hasIncome = true;
      break;
    }
  }

  if (hasExpense && hasIncome) {
    return null; // Conflicting semantics -> fallback
  }

  if (hasExpense) return 'EXPENSE';
  if (hasIncome) return 'INCOME';

  return null; // Neither detected -> fallback
}

/**
 * Detect currency and check for currency conflicts.
 * Returns currency string or null if currency conflict / unsupported currency detected.
 */
export function resolveFastPathCurrency(
  text: string,
  baseCurrency: string
): { readonly currencyCode: string | null; readonly hasConflict: boolean } {
  const explicit = detectExplicitCurrencies(text);
  const hasMultiplier = hasVietnameseMultiplier(text);

  // Multiple distinct explicit currencies -> conflict!
  if (explicit.length > 1) {
    return { currencyCode: null, hasConflict: true };
  }

  // Vietnamese multiplier (k, tr, triệu, ...) combined with non-VND explicit currency -> conflict!
  if (hasMultiplier && explicit.length === 1 && explicit[0] !== 'VND') {
    return { currencyCode: null, hasConflict: true };
  }

  if (explicit.length === 1) {
    const code = explicit[0];
    if (isSupportedCurrencyCode(code)) {
      return { currencyCode: code, hasConflict: false };
    }
    return { currencyCode: null, hasConflict: true };
  }

  if (hasMultiplier) {
    return { currencyCode: 'VND', hasConflict: false };
  }

  // Fallback to valid base currency
  const safeBase = isSupportedCurrencyCode(baseCurrency) ? baseCurrency : 'VND';
  return { currencyCode: safeBase, hasConflict: false };
}

/**
 * Conservative candidate account matching (unique match only).
 */
export function matchCandidateAccount(
  text: string,
  candidates: OpaqueCandidateContext
): string | null {
  const normalizedText = removeVietnameseAccents(text.toLowerCase());
  const matchedTokens: string[] = [];

  for (const account of candidates.accounts) {
    const normalizedLabel = removeVietnameseAccents(account.label.toLowerCase());

    // Cash matching
    if (
      (normalizedLabel.includes('tien mat') || normalizedLabel.includes('cash')) &&
      /(?:^|[\s,;!?()[\]{}])(tien mat|tiền mặt|cash)(?=$|[\s,;!?()[\]{}])/iu.test(text)
    ) {
      matchedTokens.push(account.token);
      continue;
    }

    // Direct word or phrase matching in text
    const labelPattern = new RegExp(
      `(?:^|[\\s,;!?()[\\]{}])${normalizedLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[\\s,;!?()[\\]{}])`,
      'i'
    );
    if (labelPattern.test(normalizedText)) {
      matchedTokens.push(account.token);
      continue;
    }

    // Special acronyms
    if (
      normalizedLabel.startsWith('mb') &&
      /(?:^|[\s,;!?()[\]{}])mb(?=$|[\s,;!?()[\]{}])/i.test(normalizedText)
    ) {
      matchedTokens.push(account.token);
      continue;
    }
    if (
      normalizedLabel.startsWith('vcb') &&
      /(?:^|[\s,;!?()[\]{}])vcb(?=$|[\s,;!?()[\]{}])/i.test(normalizedText)
    ) {
      matchedTokens.push(account.token);
      continue;
    }
  }

  if (matchedTokens.length === 1) {
    return matchedTokens[0];
  }

  return null;
}

/**
 * Conservative candidate category matching (unique match only).
 */
export function matchCandidateCategory(
  text: string,
  type: 'INCOME' | 'EXPENSE',
  candidates: OpaqueCandidateContext
): string | null {
  const normalizedText = removeVietnameseAccents(text.toLowerCase());
  const matchedTokens: string[] = [];

  const relevantCategories = candidates.categories.filter((c) => c.type === type);

  for (const category of relevantCategories) {
    const normalizedLabel = removeVietnameseAccents(category.label.toLowerCase());

    // Direct label match
    const labelPattern = new RegExp(
      `(?:^|[\\s,;!?()[\\]{}])${normalizedLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[\\s,;!?()[\\]{}])`,
      'i'
    );
    if (labelPattern.test(normalizedText)) {
      matchedTokens.push(category.token);
      continue;
    }

    // Semantic keyword rules
    if (type === 'EXPENSE') {
      // Food / Dining
      if (
        (normalizedLabel.includes('an uong') ||
          normalizedLabel.includes('food') ||
          normalizedLabel.includes('dining')) &&
        /(?:^|[\s,;!?()[\]{}])(an trua|an toi|an sang|coffee|ca phe|cafe|an|di cho|tra sua|quan an)(?=$|[\s,;!?()[\]{}])/i.test(
          normalizedText
        )
      ) {
        matchedTokens.push(category.token);
        continue;
      }
      // Transport
      if (
        (normalizedLabel.includes('di chuyen') ||
          normalizedLabel.includes('di lai') ||
          normalizedLabel.includes('transport')) &&
        /(?:^|[\s,;!?()[\]{}])(grab|taxi|xang|do xang)(?=$|[\s,;!?()[\]{}])/i.test(normalizedText)
      ) {
        matchedTokens.push(category.token);
        continue;
      }
    } else if (type === 'INCOME') {
      // Salary / Bonus
      if (
        (normalizedLabel.includes('luong') ||
          normalizedLabel.includes('salary') ||
          normalizedLabel.includes('thuong')) &&
        /(?:^|[\s,;!?()[\]{}])(luong|nhan luong|thuong|tien thuong)(?=$|[\s,;!?()[\]{}])/i.test(
          normalizedText
        )
      ) {
        matchedTokens.push(category.token);
        continue;
      }
    }
  }

  // Deduplicate matched tokens
  const uniqueMatched = Array.from(new Set(matchedTokens));
  if (uniqueMatched.length === 1) {
    return uniqueMatched[0];
  }

  return null;
}

/**
 * Extract merchant and clean note from text without hallucination.
 */
export function extractMerchantAndNote(
  text: string,
  type: 'INCOME' | 'EXPENSE'
): { readonly merchant: string | null; readonly note: string | null } {
  let merchant: string | null = null;
  const merchantMatch = text.match(
    /(?:^|\s)(?:tại|ở|tai|o|from)\s+([A-Za-z0-9À-ỹ\s]+?)(?=\s+(?:hôm nay|hôm qua|hôm kia|hom nay|hom qua|hom kia|bằng|bang|qua|vào|vao|tiền mặt|tien mat|\d|$))/iu
  );
  if (merchantMatch && merchantMatch[1].trim()) {
    merchant = merchantMatch[1].trim().slice(0, 100);
  }

  let note: string | null = null;
  if (type === 'EXPENSE') {
    const expenseActionMatch = text.match(
      /(?:^|[\s,])(ăn trưa|ăn tối|ăn sáng|coffee|cà phê|đổ xăng|xăng|grab|taxi|đi chợ|mua đồ|ăn uống|mua sách)(?=[\s,]|$)/iu
    );
    if (expenseActionMatch) {
      note = expenseActionMatch[1].trim();
    }
  } else if (type === 'INCOME') {
    const incomeActionMatch = text.match(
      /(?:^|[\s,])(nhận lương|lương tháng|lương|nhận thưởng|thưởng|tiền thưởng|thu nhập)(?=[\s,]|$)/iu
    );
    if (incomeActionMatch) {
      note = incomeActionMatch[1].trim();
    }
  }

  return { merchant, note };
}

/**
 * Main Deterministic Fast Path Entrypoint.
 * Evaluates whether text can be safely, deterministically parsed.
 * Returns { eligible: true, output: AiTransactionParseOutput } on success,
 * or { eligible: false, output: null } to trigger Gemini fallback.
 */
export function tryDeterministicFastPath(params: FastPathParams): FastPathResult {
  const { text, candidates, baseCurrency, timezone, now = new Date() } = params;
  const trimmed = text.trim();

  // Guard: empty or oversized
  if (!trimmed || trimmed.length > 300) {
    return { eligible: false, output: null };
  }

  // 1. Date scanning, calendar validation & date span masking
  const dateScan = maskDateSpansAndExtractDate(trimmed, timezone, now);
  if (dateScan.hasInvalidDate || !dateScan.detectedDate) {
    return { eligible: false, output: null };
  }

  // 2. Scan amounts and fallback triggers on date-masked text
  const amountAnalysis = extractPotentialAmounts(dateScan.maskedText);
  if (
    amountAnalysis.hasRange ||
    amountAnalysis.hasCorrection ||
    amountAnalysis.hasMultiTransaction ||
    amountAnalysis.hasUnconsumedToken ||
    amountAnalysis.amounts.length !== 1
  ) {
    return { eligible: false, output: null };
  }

  const amount = amountAnalysis.amounts[0];

  // 3. Detect transaction type
  const type = detectFastPathType(trimmed);
  if (!type) {
    return { eligible: false, output: null };
  }

  // 4. Resolve currency and check for currency conflicts (e.g. 85k USD, multiple currencies)
  const currencyResolution = resolveFastPathCurrency(trimmed, baseCurrency);
  if (currencyResolution.hasConflict || !currencyResolution.currencyCode) {
    return { eligible: false, output: null };
  }
  const currencyCode = currencyResolution.currencyCode;

  // 5. Candidate account matching
  const accountToken = matchCandidateAccount(trimmed, candidates);

  // 6. Candidate category matching
  const categoryToken = matchCandidateCategory(trimmed, type, candidates);

  // 7. Income source / stream matching (only for INCOME)
  let incomeSourceToken: string | null = null;
  let incomeSourceStreamToken: string | null = null;

  if (type === 'INCOME') {
    const normalizedText = removeVietnameseAccents(trimmed.toLowerCase());
    const matchedSources: string[] = [];

    for (const source of candidates.incomeSources) {
      const normSourceLabel = removeVietnameseAccents(source.label.toLowerCase());
      const pattern = new RegExp(
        `(?:^|[\\s,;!?()[\\]{}])${normSourceLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[\\s,;!?()[\\]{}])`,
        'i'
      );
      if (pattern.test(normalizedText)) {
        matchedSources.push(source.token);
      }
    }

    if (matchedSources.length === 1) {
      incomeSourceToken = matchedSources[0];
      const matchedSourceObj = candidates.incomeSources.find((s) => s.token === incomeSourceToken);

      if (matchedSourceObj) {
        const matchedStreams: string[] = [];
        for (const stream of candidates.incomeStreams) {
          if (stream.income_source_id === matchedSourceObj.id) {
            const normStreamLabel = removeVietnameseAccents(stream.label.toLowerCase());
            const streamPattern = new RegExp(
              `(?:^|[\\s,;!?()[\\]{}])${normStreamLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[\\s,;!?()[\\]{}])`,
              'i'
            );
            if (streamPattern.test(normalizedText)) {
              matchedStreams.push(stream.token);
            }
          }
        }
        if (matchedStreams.length === 1) {
          incomeSourceStreamToken = matchedStreams[0];
        }
      }
    }
  }

  // 8. Extract merchant and note
  const { merchant, note } = extractMerchantAndNote(trimmed, type);

  // Construct exact AiTransactionParseOutput
  const output: AiTransactionParseOutput = {
    type,
    amount,
    currency_code: currencyCode,
    account_token: accountToken,
    category_token: categoryToken,
    income_source_token: incomeSourceToken,
    income_source_stream_token: incomeSourceStreamToken,
    merchant,
    note,
    occurred_on: dateScan.detectedDate,
    unmatched_text: null,
  };

  return {
    eligible: true,
    output,
  };
}
