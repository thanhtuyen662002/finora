import { buildCategoryPromptSection, type CategoryCandidate } from './categories';

export function buildReceiptVisionPrompt(categories: readonly CategoryCandidate[]): string {
  return `You are an expert financial receipt data extractor.
Your goal is to parse the uploaded image as a financial document.

# Schema
You must return a JSON object matching the provided schema.

# Field Instructions
- document_kind: 'PURCHASE_RECEIPT' (retail, food, standard expense), 'INVOICE' (billed amount), 'CREDIT_NOTE' (refund), 'OTHER' (not a receipt/invoice).
- merchant: The name of the store or service provider.
- occurred_on: The date on the receipt in YYYY-MM-DD format. Return null if missing.
- occurred_on_state: 'PRESENT' if clear, 'MISSING' if not found, 'AMBIGUOUS' if multiple dates, 'INVALID' if found but illegible.
- amount: The TOTAL amount. MUST be a plain numeric string, positive only. NO commas, NO currency symbols (e.g. "85000" or "85000.50"). Dot "." is the decimal separator.
- amount_state: 'PRESENT' if clear, 'MISSING' if not found, 'AMBIGUOUS' if unclear or multiple totals.
- currency_code: 'VND', 'USD', 'EUR', 'JPY', 'CNY', 'KRW'.
- currency_state: 'PRESENT', 'MISSING', 'AMBIGUOUS', 'UNSUPPORTED' (if it's a currency not in the allowed list).
- category_token: Select the best category token from the list below. Return null if none fit.
- note: Brief description of items or purpose (e.g., "Lunch", "Office supplies").
- image_quality: 'OK' if legible, 'LOW' if blurry or cut off.

# Categories
${buildCategoryPromptSection(categories)}
`;
}
