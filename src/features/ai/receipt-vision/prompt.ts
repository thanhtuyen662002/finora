import type { CategoryCandidate } from './categories';

export function buildReceiptVisionPrompt(candidates: readonly CategoryCandidate[]): string {
  let prompt = `You are a financial receipt parser. Extract the following information from the provided receipt image.

Return exactly these 11 keys in the JSON response:
1. document_kind: "PURCHASE_RECEIPT", "INVOICE", "CREDIT_NOTE", or "UNKNOWN"
2. merchant: Name of the merchant (max 100 chars), or null if not found.
3. occurred_on: Date in YYYY-MM-DD format, or null.
4. occurred_on_state: "PRESENT", "MISSING", "AMBIGUOUS" (if multiple dates or unclear year), or "INVALID".
5. amount: Total amount as a positive decimal string with max 4 decimal places (e.g. "12.50", "450000"), no commas, or null.
6. amount_state: "PRESENT", "MISSING", "AMBIGUOUS".
7. currency_code: 3-letter uppercase ISO currency code, or null.
8. currency_state: "PRESENT", "MISSING", "AMBIGUOUS", or "UNSUPPORTED".
9. category_token: Select the single best matching category token from the list below, or null if no clear match.
10. note: Short summary or items purchased (max 200 chars), or null.
11. image_quality: "OK" or "LOW" (if the image is too blurry, dark, or cropped to read confidently).

Rules:
- amount must never contain currency symbols or commas. Extract exactly what is on the receipt.
- Do not guess the date if the year is missing. Do not use today's date.
- Only return category_token values exactly as listed below. Do not return the name.
`;

  if (candidates.length > 0) {
    prompt += '\nCategories (select category_token):\n';
    candidates.forEach((cat, index) => {
      prompt += `- CAT_${index + 1}: ${cat.name}\n`;
    });
  } else {
    prompt += '\nCategories: None available.\n';
  }

  return prompt;
}
