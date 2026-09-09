# Finora Phase 13B-2 — Cross-Currency Debt Repayment Contract

## Scope

Phase 13B-2 extends the Phase 13B-1 liability ledger without changing the
meaning of existing account balances or silently converting user values. It
covers:

- repayment from an account whose currency differs from the debt currency;
- explicit principal/interest allocation in the debt currency;
- a cash-flow transaction in the account currency;
- immutable FX provenance for historical reporting;
- report presentation that keeps cash outflow, principal reduction, and
  interest separate.

Debt creation, archive behavior, due-date reminders, automatic FX quote
fetching, and any notification channel are outside this increment.

## Canonical money contract

All persisted monetary values remain PostgreSQL `numeric(20,4)` and all client
inputs remain canonical decimal strings. Rates use `numeric(30,12)` and are
also handled as decimal strings. No JavaScript floating-point arithmetic is
allowed on a mutation path.

For every payment:

```text
account_amount > 0
debt_amount > 0
debt_amount = principal_amount + interest_amount
principal_amount <= debt.outstanding_amount
```

The rate direction is explicit and never inferred:

```text
1 account-currency unit × exchange_rate = debt-currency units
round(account_amount × exchange_rate, 4) = debt_amount
```

If both currencies are equal, the only accepted rate is exactly `1` and the
two amounts must be equal. If currencies differ, the user must provide the
rate, its source label, and an effective date no later than the payment date.
There is no automatic quote lookup or silent amount relabeling.

## Atomic database behavior

`record_debt_payment_v2` is the only new cross-currency mutation path. In one
transaction it:

1. authenticates through `auth.uid()`;
2. locks the active debt row;
3. validates ownership, account/category state, exact money breakdown, and FX
   reconciliation;
4. creates one `EXPENSE` transaction using `account_amount` and the account
   currency;
5. appends one immutable `debt_payments` row with both currency sides;
6. creates one `transaction_fx_snapshots` row only when currencies differ;
7. reduces debt `outstanding_amount` by `principal_amount`.

The existing `record_debt_payment` signature remains as a same-currency
compatibility wrapper. Debt/payment rows remain owner-isolated by RLS and
views remain `security_invoker = true`.

## Reporting contract

The cash-flow transaction continues to count as an expense in the account
currency. Reports additionally expose a repayment breakdown grouped by the
account/debt currency pair:

- cash outflow: account currency;
- principal reduction: debt currency;
- interest paid: debt currency;
- payment count.

Reports never add amounts from different currencies into one total. The
existing BASE report path can only show a converted historical value when a
stored FX snapshot exists; otherwise it remains fail-closed.

## UI contract

The repayment dialog:

- lists all active accounts, not only accounts matching the debt currency;
- shows account amount and debt amount with their respective currency codes;
- shows the rate direction (`account → debt`), source, and effective date;
- validates the exact conversion before submission and repeats all checks in
  the RPC;
- explains that principal reduces the outstanding liability while interest is
  an expense allocation;
- does not create a debt payment until the user explicitly confirms.

## Safety invariants

- Existing Phase 13B-1 same-currency data remains readable and writable.
- No existing rows are rewritten except a deterministic backfill of the new
  provenance columns (`same currency`, rate `1`, effective date `paid_on`).
- No database seed/test rows are inserted by deployment.
- No credentials, raw FX provider payloads, or hidden conversions are exposed
  to the client.
