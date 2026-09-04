import 'server-only';

/**
 * Finora AI Feature Module — Deterministic Transaction Fast Path
 * Phase 12A — Conservative Deterministic Parser with Gemini Fallback
 *
 * Invariants:
 * 1. Zero Gemini / AI Provider Usage:
 *    Executes purely deterministic string and regex parsing. No external network or LLM calls.
 * 2. Conservative Eligibility Gate:
 *    Any ambiguity, multiple amounts, range amounts, correction markers, multi-transaction markers,
 *    or conflicting income/expense semantics immediately returns eligible: false (falls back to Gemini).
 * 3. Exact 11-Key Output Boundary:
 *    When eligible, returns the exact AiTransactionParseOutput shape, which converges identically
 *    into crossValidateTransactionDraft, candidate revalidation, and user preview.
 * 4. Zero Financial Mutation:
 *    Pure read-only parsing function. Absolutely no database mutations.
 * 5. Pure String Decimal Arithmetic:
 *    Colloquial multipliers (k, tr, triệu, tỷ, etc.) are computed via pure string manipulations.
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

  const [y, m, d] = todayIso.split('-').map((v) => parseInt(v, 10));
  const offsetDate = new Date(Date.UTC(y, m - 1, d + dayOffset));
  const yearStr = String(offsetDate.getUTCFullYear());
  const monthStr = String(offsetDate.getUTCMonth() + 1).padStart(2, '0');
  const dayStr = String(offsetDate.getUTCDate()).padStart(2, '0');
  return `${yearStr}-${monthStr}-${dayStr}`;
}

/**
 * Parses monetary amount using string manipulations with ZERO floating point arithmetic.
 * Returns exact string decimal (e.g. "85000.0000", "4.5000") or null if invalid / ambiguous.
 */
export function parseFastPathAmount(rawAmountStr: string): string | null {
  const trimmed = rawAmountStr.trim().toLowerCase();
  if (!trimmed) return null;

  // Dot-thousands standard Vietnamese formatted number e.g. "85.000", "1.000.000"
  const dotThousandsMatch = trimmed.match(/^(\d{1,3}(?:\.\d{3})+)$/);
  if (dotThousandsMatch) {
    const intStr = dotThousandsMatch[1].replace(/\./g, '');
    if (/^0+$/.test(intStr)) return null;
    return `${intStr}.0000`;
  }

  // Comma-thousands standard Western formatted number e.g. "1,000" or "1,000.50"
  const commaThousandsMatch = trimmed.match(/^(\d{1,3}(?:,\d{3})+)(?:\.(\d+))?$/);
  if (commaThousandsMatch) {
    const intStr = commaThousandsMatch[1].replace(/,/g, '');
    const fracStr = (commaThousandsMatch[2] || '').padEnd(4, '0').slice(0, 4);
    if (/^0+$/.test(intStr) && /^0+$/.test(fracStr)) return null;
    return `${intStr}.${fracStr}`;
  }

  // Pattern: <digits_with_dot_or_comma><optional_space><multiplier>
  const match = trimmed.match(
    /^(\d+(?:[.,]\d+)?)\s*(k|nghin|ngan|nghìn|ngàn|tr|triệu|trieu|m|ty|tỷ|b)?$/i
  );

  if (!match) {
    return null;
  }

  const numberPart = match[1].replace(',', '.');
  const multiplierPart = (match[2] || '').toLowerCase();

  let zerosToAdd = 0;
  if (multiplierPart === 'k' || multiplierPart === 'nghin' || multiplierPart === 'ngan' || multiplierPart === 'nghìn' || multiplierPart === 'ngàn') {
    zerosToAdd = 3;
  } else if (multiplierPart === 'tr' || multiplierPart === 'triệu' || multiplierPart === 'trieu' || multiplierPart === 'm') {
    zerosToAdd = 6;
  } else if (multiplierPart === 'ty' || multiplierPart === 'tỷ' || multiplierPart === 'b') {
    zerosToAdd = 9;
  }

  const [intPartRaw, fracPartRaw = ''] = numberPart.split('.');
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
      const combinedInt = intPart === '0' ? fracPartRaw.slice(0, zerosToAdd) : intPart + fracPartRaw.slice(0, zerosToAdd);
      resultInt = combinedInt;
      resultFrac = fracPartRaw.slice(zerosToAdd);
    }
  } else {
    resultInt = intPart;
    resultFrac = fracPartRaw;
  }

  resultInt = resultInt.replace(/^0+/, '') || '0';

  // Check if zero
  const isZeroInt = resultInt === '0';
  const isZeroFrac = !resultFrac || /^0+$/.test(resultFrac);
  if (isZeroInt && isZeroFrac) {
    return null;
  }

  // Format to 4 decimal places
  const formattedFrac = resultFrac.padEnd(4, '0').slice(0, 4);
  return `${resultInt}.${formattedFrac}`;
}

/**
 * Scan text for potential amounts and fallback triggers.
 */
export function extractPotentialAmounts(text: string): {
  readonly amounts: readonly string[];
  readonly hasRange: boolean;
  readonly hasCorrection: boolean;
  readonly hasMultiTransaction: boolean;
} {
  const normalized = removeVietnameseAccents(text.toLowerCase());

  // Check range markers
  const hasRange =
    /\b\d+\s*[-~]\s*\d+/.test(text) ||
    /\b(khoang|tam|tu)\s+\d+.*(den|-)\s*\d+/.test(normalized) ||
    /\bkhoang\s+\d+/.test(normalized) ||
    /\btam\s+\d+/.test(normalized);

  // Check correction / conflict markers
  const hasCorrection =
    /\b(khong phai|thuc ra|nham|thay vi|sua thanh|doi thanh|chu khong phai|ma la)\b/.test(
      normalized
    );

  // Check multi-transaction markers
  const hasMultiTransaction =
    /\b(chia.*thanh|chia lam|roi sau do)\b/.test(normalized) ||
    /\b\d+\s*(?:k|tr|trieu|nghin|ngan|vnd|usd)\s+roi\s+\d+/.test(normalized);

  // Amount extraction regex:
  // Match numbers followed by colloquial multiplier or currency code
  const amountPattern =
    /\b(\d+(?:[.,]\d+)?\s*(?:k|nghìn|ngàn|nghin|ngan|tr|triệu|trieu|m|tỷ|ty|b|vnd|usd|eur|jpy|cny|krw|đ|dong|đồng|\$|€|¥)?)\b/gi;

  const found: string[] = [];
  const matches = text.match(amountPattern) || [];

  for (const raw of matches) {
    const candidate = raw.trim();
    // Exclude plain standalone numbers that might be dates (e.g. 2026, 2025) or day/month
    if (/^\d{4}$/.test(candidate) && parseInt(candidate, 10) >= 2000 && parseInt(candidate, 10) <= 2100) {
      continue;
    }
    // Check if valid amount
    const parsed = parseFastPathAmount(candidate.replace(/(vnd|usd|eur|jpy|cny|krw|đ|dong|đồng|\$|€|¥)/gi, '').trim());
    if (parsed) {
      found.push(parsed);
    }
  }

  return {
    amounts: found,
    hasRange,
    hasCorrection,
    hasMultiTransaction,
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
  ];

  let hasExpense = false;
  for (const kw of expenseKeywords) {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    if (regex.test(normalized)) {
      hasExpense = true;
      break;
    }
  }

  let hasIncome = false;
  for (const kw of incomeKeywords) {
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
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
 * Detect explicit or inferred currency.
 */
export function detectFastPathCurrency(text: string, baseCurrency: string): string {
  const upper = text.toUpperCase();

  for (const code of SUPPORTED_CURRENCY_CODES) {
    const regex = new RegExp(`\\b${code}\\b`);
    if (regex.test(upper)) {
      return code;
    }
  }

  if (/\b(usd|\$|dollar)\b/i.test(text)) return 'USD';
  if (/\b(eur|€|euro)\b/i.test(text)) return 'EUR';
  if (/\b(jpy|¥|yen)\b/i.test(text)) return 'JPY';
  if (/\b(cny|yuan|tệ)\b/i.test(text)) return 'CNY';
  if (/\b(krw|won)\b/i.test(text)) return 'KRW';
  if (/\b(vnd|đ|dong|đồng)\b/i.test(text)) return 'VND';

  // Colloquial Vietnamese units default to VND
  if (/\b\d+[\s]*(k|nghìn|ngàn|nghin|ngan|tr|triệu|trieu|tỷ|ty)\b/i.test(text)) {
    return 'VND';
  }

  return isSupportedCurrencyCode(baseCurrency) ? baseCurrency : 'VND';
}

/**
 * Detect trusted date from text, or default to trusted server today.
 */
export function detectFastPathDate(text: string, timezone: string, now: Date): string | null {
  const normalized = removeVietnameseAccents(text.toLowerCase());

  if (/\b(hom kia)\b/.test(normalized)) {
    return getIsoDateWithOffset(now, timezone, -2);
  }
  if (/\b(hom qua|yesterday)\b/.test(normalized)) {
    return getIsoDateWithOffset(now, timezone, -1);
  }
  if (/\b(hom nay|today)\b/.test(normalized)) {
    return getIsoDateWithOffset(now, timezone, 0);
  }

  // Check YYYY-MM-DD
  const isoMatch = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    const candidate = isoMatch[0];
    if (isValidCalendarDate(candidate)) {
      return candidate;
    }
    return null; // Invalid calendar date
  }

  // Check DD/MM/YYYY
  const slashMatch = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, '0');
    const month = slashMatch[2].padStart(2, '0');
    const year = slashMatch[3];
    const candidate = `${year}-${month}-${day}`;
    if (isValidCalendarDate(candidate)) {
      return candidate;
    }
    return null;
  }

  // Check DD-MM-YYYY
  const dashMatch = text.match(/\b(\d{1,2})-(\d{1,2})-(\d{4})\b/);
  if (dashMatch) {
    const day = dashMatch[1].padStart(2, '0');
    const month = dashMatch[2].padStart(2, '0');
    const year = dashMatch[3];
    const candidate = `${year}-${month}-${day}`;
    if (isValidCalendarDate(candidate)) {
      return candidate;
    }
    return null;
  }

  // Default to server today if no date keyword/pattern found
  return getIsoDateWithOffset(now, timezone, 0);
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
      /\b(tien mat|tiền mặt|cash)\b/i.test(text)
    ) {
      matchedTokens.push(account.token);
      continue;
    }

    // Direct word or phrase matching in text
    // E.g. "MB", "MBBank", "Wise", "Vietcombank", "VCB"
    const labelPattern = new RegExp(`\\b${normalizedLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (labelPattern.test(normalizedText)) {
      matchedTokens.push(account.token);
      continue;
    }

    // Special acronyms (e.g. MB matching MBBank)
    if (normalizedLabel.startsWith('mb') && /\bmb\b/i.test(normalizedText)) {
      matchedTokens.push(account.token);
      continue;
    }
    if (normalizedLabel.startsWith('vcb') && /\bvcb\b/i.test(normalizedText)) {
      matchedTokens.push(account.token);
      continue;
    }
  }

  // Strict invariant: exactly 1 match required; 0 or >1 matches must return null
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
    const labelPattern = new RegExp(`\\b${normalizedLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (labelPattern.test(normalizedText)) {
      matchedTokens.push(category.token);
      continue;
    }

    // Semantic keyword rules
    if (type === 'EXPENSE') {
      // Food / Dining
      if (
        (normalizedLabel.includes('an uong') || normalizedLabel.includes('food') || normalizedLabel.includes('dining')) &&
        /\b(an trua|an toi|an sang|coffee|ca phe|cafe|an|di cho|tra sua|quan an)\b/i.test(normalizedText)
      ) {
        matchedTokens.push(category.token);
        continue;
      }
      // Transport
      if (
        (normalizedLabel.includes('di chuyen') || normalizedLabel.includes('di lai') || normalizedLabel.includes('transport')) &&
        /\b(grab|taxi|xang|do xang)\b/i.test(normalizedText)
      ) {
        matchedTokens.push(category.token);
        continue;
      }
    } else if (type === 'INCOME') {
      // Salary
      if (
        (normalizedLabel.includes('luong') || normalizedLabel.includes('salary')) &&
        /\b(luong|nhan luong)\b/i.test(normalizedText)
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
  const merchantMatch = text.match(/(?:^|\s)(?:tại|ở|tai|o|from)\s+([A-Za-z0-9À-ỹ\s]+?)(?=\s+(?:hôm nay|hôm qua|hôm kia|hom nay|hom qua|hom kia|bằng|bang|qua|vào|vao|tiền mặt|tien mat|\d|$))/i);
  if (merchantMatch && merchantMatch[1].trim()) {
    merchant = merchantMatch[1].trim().slice(0, 100);
  }

  // Extract concise note based on primary intent
  let note: string | null = null;
  if (type === 'EXPENSE') {
    const expenseActionMatch = text.match(/(?:^|[\s,])(ăn trưa|ăn tối|ăn sáng|coffee|cà phê|đổ xăng|xăng|grab|taxi|đi chợ|mua đồ|ăn uống|mua sách)(?=[\s,]|$)/i);
    if (expenseActionMatch) {
      note = expenseActionMatch[1].trim();
    }
  } else if (type === 'INCOME') {
    const incomeActionMatch = text.match(/(?:^|[\s,])(nhận lương|lương tháng|lương|nhận thưởng|thưởng|thu nhập)(?=[\s,]|$)/i);
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

  // 1. Scan amounts and fallback triggers
  const amountAnalysis = extractPotentialAmounts(trimmed);
  if (
    amountAnalysis.hasRange ||
    amountAnalysis.hasCorrection ||
    amountAnalysis.hasMultiTransaction ||
    amountAnalysis.amounts.length !== 1
  ) {
    return { eligible: false, output: null };
  }

  const amount = amountAnalysis.amounts[0];

  // 2. Detect transaction type
  const type = detectFastPathType(trimmed);
  if (!type) {
    return { eligible: false, output: null };
  }

  // 3. Detect currency
  const currencyCode = detectFastPathCurrency(trimmed, baseCurrency);

  // 4. Detect date
  const occurredOn = detectFastPathDate(trimmed, timezone, now);
  if (!occurredOn) {
    return { eligible: false, output: null };
  }

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
      const pattern = new RegExp(`\\b${normSourceLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (pattern.test(normalizedText)) {
        matchedSources.push(source.token);
      }
    }

    if (matchedSources.length === 1) {
      incomeSourceToken = matchedSources[0];
      const matchedSourceObj = candidates.incomeSources.find((s) => s.token === incomeSourceToken);

      // Stream matching
      const matchedStreams: string[] = [];
      for (const stream of candidates.incomeStreams) {
        if (matchedSourceObj && stream.income_source_id === matchedSourceObj.id) {
          const normStreamLabel = removeVietnameseAccents(stream.label.toLowerCase());
          const streamPattern = new RegExp(`\\b${normStreamLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
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
    occurred_on: occurredOn,
    unmatched_text: null,
  };

  return {
    eligible: true,
    output,
  };
}
