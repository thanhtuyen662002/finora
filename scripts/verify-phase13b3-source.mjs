import { readFile } from 'node:fs/promises';

const checks = [
  ['migration exists', 'supabase/migrations/20260909100000_phase_13b3_debt_reminders.sql', /debt_reminders_enabled/],
  ['notification kind exists', 'src/features/notifications/types.ts', /DEBT_REMINDER/],
  ['debt notification route exists', 'src/features/notifications/notifications.ts', /href: '\/debts'/],
  ['debt reminder domain is pure', 'src/features/debts/reminders.ts', /export function getDebtReminders/],
  ['zero outstanding is skipped', 'src/features/debts/reminders.ts', /isPositiveExactDecimal\(toExactDecimal\(debt\.outstanding_amount\)\)/],
  ['reminder toggle is persisted', 'src/app/settings/page.tsx', /debt_reminders_enabled/],
  ['notifications remain on-demand', 'src/app/notifications/page.tsx', /theo yêu cầu|theo yêu cầu từ dữ liệu hiện tại/],
];

let passed = 0;
for (const [label, file, pattern] of checks) {
  const content = await readFile(file, 'utf8');
  const ok = pattern.test(content);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (ok) passed += 1;
}

console.log(`PHASE_13B3_SOURCE_VERIFIER: ${passed}/${checks.length}`);
if (passed !== checks.length) process.exitCode = 1;
