# Phase 13B-3 — Debt Reminders Contract

## Scope

Phase 13B-3 adds an on-demand, in-app reminder for active debts whose next configured due date is today or within the next three calendar days. It extends the existing Phase 13C notification center and does not introduce email, push, cron, queue, or automatic financial mutations.

## Rules

- Only the authenticated user's `debt_details` rows are read through the existing RLS-protected client.
- Archived debts, settled debts, and debts without `first_due_date` are excluded.
- Supported frequencies are `ONE_TIME`, `WEEKLY`, `MONTHLY`, `QUARTERLY`, and `YEARLY`.
- Monthly and quarterly schedules use `due_day` when present and clamp safely to the last day of a shorter month.
- The reminder window is inclusive: due today through three days ahead.
- Amounts remain exact decimal strings and are displayed in the debt's own currency. No currency conversion or balance mutation occurs.
- Each notification links to `/debts` and has a deterministic id based on debt id and due date.
- `notification_preferences.debt_reminders_enabled` defaults to `true` and follows the same authenticated owner RLS boundary as the existing preferences.

## Non-goals

Background scheduling, email/push delivery, read/unread persistence, interest accrual, automatic payment creation, and cross-currency calculations are outside this phase.
