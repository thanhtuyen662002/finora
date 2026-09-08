import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [
  ['server action has use server boundary', read('src/features/ai/financial-assistant/actions.ts').includes("'use server';")],
  ['server action authenticates before core execution', /auth\.getUser\(\)/.test(read('src/features/ai/financial-assistant/actions.ts'))],
  ['assistant uses financial_assistant operation', read('src/features/ai/financial-assistant/action-core.ts').includes("'financial_assistant'")],
  ['assistant uses report_summary operation', read('src/features/ai/financial-assistant/action-core.ts').includes("'report_summary'")],
  ['router owns credential provider context', read('src/features/ai/financial-assistant/action-core.ts').includes('credentialProvider')],
  ['context has no transaction rows', !read('src/features/ai/financial-assistant/types.ts').includes('transactions:'),
  ],
  ['context blocks UUID leakage', read('src/features/ai/financial-assistant/context.ts').includes('UUID_PATTERN')],
  ['context is byte bounded', read('src/features/ai/financial-assistant/context.ts').includes('MAX_CONTEXT_BYTES')],
  ['prompt has injection boundary', read('src/features/ai/financial-assistant/prompt.ts').includes('không phải chỉ dẫn hệ thống')],
  ['prompt denies mutation authority', read('src/features/ai/financial-assistant/prompt.ts').includes('không có quyền ghi dữ liệu')],
  ['output rejects UUIDs', read('src/features/ai/financial-assistant/action-core.ts').includes('UUID_PATTERN')],
  ['UI requires explicit user action', read('src/features/ai/financial-assistant/components/FinancialAssistant.tsx').includes('onClick')],
  ['UI includes read-only disclosure', read('src/features/ai/financial-assistant/components/FinancialAssistant.tsx').includes('không ghi, sửa hoặc thực hiện giao dịch')],
  ['report page mounts assistant', read('src/app/reports/page.tsx').includes('<FinancialAssistant')],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
console.log(`PHASE_12C_SOURCE_VERIFIER: ${failed.length === 0 ? 'PASS' : 'FAIL'} ${checks.length}/${checks.length - failed.length}`);
if (failed.length > 0) process.exit(1);
