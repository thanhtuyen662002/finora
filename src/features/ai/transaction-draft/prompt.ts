import 'server-only';

/**
 * Finora AI Feature Module — Prompt & System Instruction Builder
 * Phase 12A — Data Minimization & Adversarial Defense
 *
 * Invariants:
 * 1. Supplies server-trusted temporal context (server_today_iso, timezone, locale).
 * 2. Provides bounded candidate token maps (ACC_1, CAT_1, SRC_1, STR_1).
 *    Zero database UUIDs or user authentication IDs in prompt.
 * 3. Enforces strict JSON output with exact 11-key schema and zero tool authority.
 */

import type { OpaqueCandidateContext } from './types';

export interface BuildPromptParams {
  readonly promptText: string;
  readonly candidates: OpaqueCandidateContext;
  readonly userSettings: {
    readonly baseCurrency?: string;
    readonly timezone?: string;
    readonly locale?: string;
  };
  readonly now?: Date;
}

export function buildTransactionParserPrompt(params: BuildPromptParams): {
  prompt: string;
  systemInstruction: string;
} {
  const now = params.now ?? new Date();
  const timezone = params.userSettings.timezone || 'Asia/Ho_Chi_Minh';
  const locale = params.userSettings.locale || 'vi-VN';
  const baseCurrency = params.userSettings.baseCurrency || 'VND';

  // Format today's date in user's timezone YYYY-MM-DD
  const serverTodayIso = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);

  const { candidates } = params;

  // Build candidate string representations
  const accountsText = candidates.accountsOmitted
    ? '[CANDIDATES_OMITTED_DUE_TO_VOLUME]'
    : candidates.accounts.length === 0
    ? 'None available'
    : candidates.accounts
        .map((a) => `${a.token}: "${a.label}" (${a.currency_code})`)
        .join(', ');

  const categoriesText = candidates.categoriesOmitted
    ? '[CANDIDATES_OMITTED_DUE_TO_VOLUME]'
    : candidates.categories.length === 0
    ? 'None available'
    : candidates.categories
        .map((c) => `${c.token}: "${c.label}" [${c.type}]`)
        .join(', ');

  const sourcesText = candidates.incomeSourcesOmitted
    ? '[CANDIDATES_OMITTED_DUE_TO_VOLUME]'
    : candidates.incomeSources.length === 0
    ? 'None available'
    : candidates.incomeSources
        .map((s) => `${s.token}: "${s.label}"`)
        .join(', ');

  const streamsText = candidates.incomeStreamsOmitted
    ? '[CANDIDATES_OMITTED_DUE_TO_VOLUME]'
    : candidates.incomeStreams.length === 0
    ? 'None available'
    : candidates.incomeStreams
        .map((st) => {
          const parentSource = candidates.incomeSources.find((s) => s.id === st.source_id);
          const parentToken = parentSource?.token || 'UNKNOWN';
          return `${st.token}: "${st.label}" (source: ${parentToken})`;
        })
        .join(', ');

  const systemInstruction = `You are Finora's deterministic financial transaction parser.
Your task is to parse a single user transaction text into a strict JSON object with EXACTLY 11 properties.

SECURITY & ARCHITECTURAL INVARIANTS:
1. OUTPUT FORMAT: Output valid, raw JSON only. Do NOT output markdown fences like \`\`\`json or backticks.
2. EXACT 11 KEYS REQUIRED:
   "type": "INCOME" | "EXPENSE" | null
   "amount": string | null
   "currency_code": string | null
   "account_token": string | null
   "category_token": string | null
   "income_source_token": string | null
   "income_source_stream_token": string | null
   "merchant": string | null
   "note": string | null
   "occurred_on": string | null
   "unmatched_text": string | null

3. MONEY HANDLING (ZERO JAVASCRIPT NUMBERS):
   - The "amount" property MUST BE a string decimal or null. NEVER output a JavaScript number.
   - Resolve colloquial multipliers:
     * "85k", "85 nghìn", "85 ngàn" -> "85000"
     * "1tr", "1 triệu", "1.5tr", "1.5 triệu", "2m" -> "1000000", "1500000", "2000000"
     * "1 tỷ", "1.2 tỷ", "1b" -> "1000000000", "1200000000"
     * Dot-thousands: "50.000 VND" -> "50000"
     * International decimal: "4.50 USD" -> "4.50"
   - If amount <= 0, negative, or not found, set "amount": null.

4. CANDIDATE TOKENS:
   - Use ONLY candidate tokens from the provided candidate list (e.g. ACC_1, CAT_1, SRC_1, STR_1).
   - If no confident match is found, or if candidates are omitted, output null.
   - NEVER invent or fabricate tokens. NEVER output database UUIDs.
   - If type is "EXPENSE", set "income_source_token": null and "income_source_stream_token": null.

5. CURRENCY:
   - If the user explicitly mentions a currency (e.g. "USD", "VND", "EUR", "$", "đ"), output the 3-letter uppercase ISO code (e.g. "USD", "VND").
   - If unspecified in the text, output null.

6. TEMPORAL ANCHORS:
   - "server_today_iso": "${serverTodayIso}"
   - "hôm nay", "today" -> "${serverTodayIso}"
   - "hôm qua", "yesterday" -> 1 day before server_today_iso
   - "hôm kia" -> 2 days before server_today_iso
   - Format: "YYYY-MM-DD" or null if unparseable.

7. TEXT LIMITS:
   - "merchant": cleaned merchant/store/counterparty, max 100 chars or null.
   - "note": descriptive details, max 255 chars or null.
   - "unmatched_text": unparsed leftovers, max 255 chars or null.`;

  const prompt = `Context:
- Server Today: ${serverTodayIso} (Timezone: ${timezone}, Locale: ${locale}, Base Currency: ${baseCurrency})
- Candidate Accounts: ${accountsText}
- Candidate Categories: ${categoriesText}
- Candidate Income Sources: ${sourcesText}
- Candidate Income Streams: ${streamsText}

Transaction text to parse:
"${params.promptText}"`;

  return { prompt, systemInstruction };
}
