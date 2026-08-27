# FINORA — PHASE 1 FINAL POLISH

## TASK

Perform one bounded final-polish pass on Finora Phase 1.

Repository:

`thanhtuyen662002/finora`

Authoritative audited implementation commit:

`cf2363141cddf9c2f6ca696c25531c06bc0cce88`

The repository ledger is `CORRECTIVE_REQUIRED` only because of a few remaining presentation/security-truthfulness issues.

Do not rebuild Phase 1.
Do not begin Phase 2.

---

# 1. Mandatory Pre-Work

Before editing:

1. Sync latest remote `main`.
2. Read `AGENTS.md`.
3. Read `docs/PROJECT_STATUS.md` completely.
4. Inspect the exact current implementations of:
   - `src/app/settings/page.tsx`
   - `src/app/admin/page.tsx`
   - `src/components/layout/AppShell.tsx`
5. Treat the repository as authoritative.

Only fix the bounded findings below.

---

# 2. Fix Settings Personal API Key Preview

Current problem:

The Phase 1 Settings Client Component initializes a realistic full-looking Gemini API key in client state while UI copy says that the value is encrypted/server-side and never reaches the client.

That is contradictory and must be removed.

Requirements:

- Remove any realistic/full-looking API key default value from client-side source/state.
- Do not embed a real or realistic complete credential anywhere in the repository.
- If the BYOK field remains visible, either:
  - keep it empty and disabled; or
  - show a fixed masked non-secret placeholder such as `••••••••••••••••` and mark it `Preview only`.
- Prefer a non-editable Phase 1 preview rather than collecting input that cannot be stored safely yet.
- Replace current wording with truthful Phase 1 copy, for example:
  - `UI preview only — Finora does not store API credentials in Phase 1.`
  - `Encrypted server-side credential storage will be implemented in the dedicated AI credential phase.`
- Do not implement credential storage now.
- Do not add environment variables.
- Do not call Gemini.

---

# 3. Correct Admin Security / Backend Wording

The `/admin` route remains a visual preview only.

Correct any statement that presents future backend behavior as operational.

## RLS / Data Isolation card

Do not say that RLS is currently enforcing User A/User B isolation.

Use wording such as:

- `Planned for Phase 2`;
- `Backend not connected`;
- `This card previews the intended RLS invariant.`

## System Gemini Key card

Do not claim an encrypted server secret currently exists.

Use a masked non-secret example only and wording such as:

- `Credential management preview`;
- `Real server-side encrypted storage is not implemented in Phase 1.`

## AI configuration save feedback

Do not say configuration was actually persisted.

Use wording such as:

- `Mock configuration updated locally`;
- `Preview only — not persisted`.

## FX card

Do not describe mock rates as realtime/current provider data.

Use wording such as:

- `Mock FX rates for UI preview`;
- `No live FX provider connected`;
- `Mock refresh complete`.

If source labels look like live provider claims, clearly prefix/suffix them as mock/example source labels or replace them with neutral mock source names.

Do not implement RLS, Gemini, encrypted secrets, or FX APIs in this pass.

---

# 4. Documentation Accuracy

Update `docs/PROJECT_STATUS.md` to describe the actual transaction period presets exactly:

- All time
- This month
- Last month
- Last 30 days

Do not claim `This Year` unless the code actually implements it.

If the implementation is intentionally changed to include `This Year`, that is also acceptable, but keep the scope minimal and ensure code and documentation match exactly.

After the final fixes, set:

- **Current phase:** Phase 1 — UI Foundation
- **Phase status:** COMPLETED
- **Next Recommended Action:** Phase 2 — Authentication + RLS, pending authorization

Only do this after all final-polish gates pass.

---

# 5. Dead Import Cleanup

Inspect `src/components/layout/AppShell.tsx` and remove imports confirmed unused after the Admin navigation removal.

Do not refactor the component otherwise.

Also remove obvious unused imports introduced by this final polish if present.

---

# 6. Strict Scope Boundary

Forbidden:

- Supabase Auth implementation;
- database tables;
- migrations;
- RLS policies;
- server secrets;
- Gemini API calls;
- AI key persistence;
- FX API calls;
- YouTube APIs;
- PWA work;
- Phase 2 implementation.

No database changes are allowed.

---

# 7. Verification

Run and report:

- `npm install`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

Runtime-check at least:

- `/settings`
- `/admin`
- `/transactions`

Verify at minimum:

- 390px
- 768px
- 1024px
- 1440px

Also verify:

- no full-looking API key string exists in Settings source;
- Settings does not claim credentials are currently stored server-side;
- Admin does not claim RLS is currently operational;
- Admin does not claim real encrypted key storage exists;
- Admin FX copy is explicitly mock/non-live;
- AI config save feedback is explicitly mock/non-persistent;
- transaction date preset documentation matches code;
- no DB/Auth/AI/FX backend work was added.

Never mark an unexecuted check as PASS.

---

# 8. Git / Completion

Review the complete diff.

Commit the bounded polish only.

Suggested commit:

`fix(ui): finalize Phase 1 mock security wording`

Publish to remote `main` using the connected GitHub integration.

The actual remote GitHub SHA is authoritative; a local-only SHA is not sufficient.

Then stop.

Do not begin Phase 2.

---

# 9. Final Report

Return:

```text
TASK
Finora Phase 1 — Final Polish

STATUS
PASS / PARTIAL / BLOCKED

START_HEAD
<remote main before final polish>

FINAL_LOCAL_HEAD
<local commit>

REMOTE_MAIN_HEAD
<actual remote main>

HEAD_MATCH
YES / NO

CHANGED
<files and bounded fixes>

SETTINGS API KEY PREVIEW
<result>

ADMIN MOCK WORDING
RLS:
AI credential storage:
AI config persistence:
FX:

DOCUMENTATION
<date preset and project status result>

DATABASE CHANGES
NONE

AUTH
NOT IMPLEMENTED

AI BACKEND
NOT IMPLEMENTED

FX BACKEND
NOT IMPLEMENTED

VERIFICATION
Install:
Lint:
TypeScript:
Build:
Runtime:
390px:
768px:
1024px:
1440px:

KNOWN ISSUES
<NONE or exact issues>

PROJECT STATUS
Phase 1 — UI Foundation:
Next Action:

REMOTE COMMIT
<actual pushed SHA or BLOCKED>
```

# END — FINORA PHASE 1 FINAL POLISH
