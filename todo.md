# QiFi Launch Closure Ledger

Updated 2026-07-21. This document supersedes the reopened follow-up checklist. Every previously unchecked requirement is classified exactly once below. Historical duplicates and obsolete architecture warnings are retained only in the audit table, not as active work.

## Classification rules

- `COMPLETE_AND_VERIFIED`: implemented and supported by source/build or live production evidence recorded below.
- `COMPLETE_BUT_NEEDS_VERIFICATION`: implementation exists, but the required authenticated, visual, mobile, persistence, or cross-module proof has not been recorded.
- `ACTUALLY_INCOMPLETE`: implementation is absent, partial, unsafe, or known to be incorrect.
- `STALE_DUPLICATE_OR_NOT_APPLICABLE`: superseded, duplicated by a stronger acceptance gate, or no longer applies to the architecture.

## Evidence already recorded

- `E1` Production frontend bundle at `https://fi.qially.com` uses `https://api.qially.com` and contains no `x-openai-api-key` request header.
- `E2` Production `https://api.qially.com/health/ready` returned HTTP 200 with Supabase available.
- `E3` Production CORS preflight from `https://fi.qially.com` returned HTTP 204 and permits `Authorization, Content-Type`.
- `E4` `251_QiApi` authenticates with the publishable client and performs finance database operations with the server-only `SUPABASE_SECRET_KEY`; deployed Worker version `0396d9c5-acfc-4b7a-a96f-f56007849cfc` and later integrated deployment.
- `E5` QiFi TypeScript and production builds passed after the shared `TransactionForm` change.
- `E6` Shared `TransactionForm` is used by ledger create, ledger edit, and dashboard New Transaction; commit `b352438` is on GitHub and production Pages.
- `E7` Central finance state is authoritative; successful mutations call `refreshApiState`; failed reads/writes expose `syncError` instead of substituting local financial data.
- `E8` Old standalone QiFi Worker source/configuration and stale hostname references were removed in the 2026-07-18 architecture cleanup.
- `E9` Current production Pages bundle loaded its active hashed Ledger and TransactionForm modules successfully after deployment.
- `E10` `docs/finance-api-route-matrix.md` records every QiFi caller, Worker route, auth boundary, and backing table/service. The production smoke runner passed syntax validation; TypeScript and the production build passed. Its live authenticated run is correctly blocked until the four dedicated smoke identity variables are provisioned.
- `E11` QiApi commit `f90e773` extracts the journal-line accounting rule and adds Money In, Money Out, balance, and invalid-amount tests. The complete Worker suite passed: 2 files, 18 tests; TypeScript and ESLint also passed.
- `E12` QiApi commit `4c06229` centralizes assistant and receipt inference in one server-side AI client and adds receipt processing/status routes using the existing attachment OCR columns. QiApi TypeScript, ESLint, 29 tests, and Cloudflare dry-run passed; QiFi TypeScript and production build passed. Production `OPENAI_API_KEY` is not yet configured, so authenticated live OCR and assistant verification remain open.
- `E13` QiApi Worker version `10a7c836-ff0a-4f2c-b105-39537cee1155` is deployed: `/health/ready` returns 200, `/health/ai` returns the expected fail-closed 503 `AI_CONFIG_INVALID`, and receipt-route CORS returns 204. Production Pages serves `index-BJgJp3vm.js` and `TransactionForm-CKFL5JK_.js`; the live chunks contain the receipt API, camera UI, and explicit OCR review UI.
- `E14` Production Worker secret inventory now includes `OPENAI_API_KEY`, and both `api.qially.com/health/ai` and the workers.dev deployment return 200 with `configured: true` without exposing the value. Secret-change version: `70ac4d90-7c40-42e2-bc1e-eefccf71b258`.
- `E15` GitHub Actions production smoke run `29773236575` (job `88456329199`) passed on commit `0602a73`. It validated all four repository secrets, acquired a dedicated Supabase user session, received the complete authenticated finance state with populated transaction dropdown sources, and confirmed unauthenticated state returns 401. This test is read-only until workspace isolation is implemented.
- `E16` QiApi commit `0a5e581` and QiFi commit `63aff9e` implement schedule edit, pause/resume, deterministic occurrence generation, delete, refresh, and retry duplicate prevention. QiFi TypeScript/build passed; QiApi TypeScript, ESLint, 37 tests, and dry-run passed. Worker version `658570cc-45e0-4ce7-8a27-530ddf46159d` is deployed; production generation CORS returns 204 and unauthenticated access returns 401. Authenticated production lifecycle mutation remains open until smoke-workspace isolation exists.
- `E17` QiFi centralizes account balances, calendar-safe forecast occurrences, and source-ledger integrity checks in `financeMath.ts`. Four focused tests pass for debit-normal balances, balanced journals, missing/orphan mappings, and month-end recurrence; TypeScript and the production build pass. Reports now show debit/credit reconciliation status, forecasts preserve legitimate zero ledger balances, and runtime report/reconciliation dates derive from the current date. Authenticated production mutation/reconciliation proof remains open.

## Closure audit of every formerly unchecked item

### Central API and data architecture

| ID | Former requirement | Classification | Evidence / reason |
|---|---|---|---|
| API-01 | Identify API clients, URLs, environment variables, proxies, services, and direct Supabase calls | COMPLETE_AND_VERIFIED | One finance client; direct Supabase use is auth/session only. E1, E7 |
| API-02 | Confirm production uses centralized `251_QiApi` | COMPLETE_AND_VERIFIED | E1-E4 |
| API-03 | Verify production and development Worker URLs via network | COMPLETE_BUT_NEEDS_VERIFICATION | Production verified; local development path still needs a recorded network capture. |
| API-04 | Confirm deployed finance routes return authenticated live Supabase data | COMPLETE_AND_VERIFIED | Dedicated-user production state smoke passed. E15 |
| API-05 | Inventory every finance route, caller, table, auth, and status | COMPLETE_AND_VERIFIED | Durable route matrix traced against both repositories. E10 |
| API-06 | Identify requests to old Worker | COMPLETE_AND_VERIFIED | Repository and live bundle scan found none. E1, E8 |
| API-07 | Identify duplicated business logic in old/new Workers | COMPLETE_AND_VERIFIED | Old finance Worker removed after migration. E8 |
| API-08 | Check old Worker deployment, DNS, variables, and calls | COMPLETE_AND_VERIFIED | Old deployment/configuration removed during architecture cleanup. E8 |
| API-09 | Do not delete legacy code before verification | STALE_DUPLICATE_OR_NOT_APPLICABLE | Historical migration guard; migration is complete. |
| API-10 | Migrate required legacy routes and validation | COMPLETE_BUT_NEEDS_VERIFICATION | Routes exist in `251_QiApi`; route-by-route production smoke coverage is missing. |
| API-11 | Use one documented API client/base URL | COMPLETE_AND_VERIFIED | E1 |
| API-12 | Remove obsolete URLs, fallbacks, fetch wrappers, proxies, variables | COMPLETE_AND_VERIFIED | E1, E8 |
| API-13 | Remove unintended direct frontend Supabase operations | COMPLETE_AND_VERIFIED | Finance data uses API; auth/session remains direct. |
| API-14 | Document intentional direct Supabase authentication exception | COMPLETE_AND_VERIFIED | Architecture record and client comments identify auth/session exception. |
| API-15 | Remove old Worker after imports/routes/deployments are gone | COMPLETE_AND_VERIFIED | E8 |
| API-16 | Remove obsolete Wrangler, bindings, CI, and scripts | COMPLETE_AND_VERIFIED | E8 |
| API-17 | Ensure only intended Worker deploys for QiFi | COMPLETE_AND_VERIFIED | Pages deploys frontend; `qiapi` owns `api.qially.com`. E4 |
| API-18 | Verify auth, identity, ownership, and RLS context | COMPLETE_BUT_NEEDS_VERIFICATION | Auth validation and secret DB client are implemented; multi-user ownership model needs explicit acceptance/security evidence. |
| API-19 | Verify mutation refresh/cache invalidation | COMPLETE_BUT_NEEDS_VERIFICATION | Refresh is implemented; downstream production assertions are missing. E7 |
| API-20 | Show clear central API failures without stale fallback | COMPLETE_AND_VERIFIED | E7 |
| API-21 | Produce required architecture verification package items 1-6 | COMPLETE_AND_VERIFIED | Production URL, route ownership, direct auth exception, removals, and no-old-worker evidence recorded in E1-E8. |
| API-22 | Live transaction persists and updates every downstream surface | ACTUALLY_INCOMPLETE | This is the launch smoke/acceptance test and has not passed. Phase 2/7. |

### Transactions, persistence, and ledger behavior

| ID | Former requirement | Classification | Evidence / reason |
|---|---|---|---|
| DATA-01 | Trace creation through persistence, ledger, dashboard, reports, forecast, review | COMPLETE_BUT_NEEDS_VERIFICATION | Code path exists; production assertions are missing. |
| DATA-02 | Confirm all CRUD writes correct tables rather than local state | COMPLETE_BUT_NEEDS_VERIFICATION | API-only implementations exist; route/table smoke matrix is missing. |
| DATA-03 | Read current data after login, refresh, navigation, restart | COMPLETE_BUT_NEEDS_VERIFICATION | Hydration exists; session/restart proof missing. |
| DATA-04 | Visible failed read/write errors | COMPLETE_AND_VERIFIED | E7 |
| DATA-05 | Verify env, routes, auth, RLS, tables, ownership | COMPLETE_BUT_NEEDS_VERIFICATION | Core failure fixed; ownership/security audit remains. |
| DATA-06 | Immediately refresh widgets/reports/balances/forecast after mutations | COMPLETE_BUT_NEEDS_VERIFICATION | Global state refresh exists; each consumer needs assertions. |
| DATA-07 | Invalidate/refresh all affected queries | COMPLETE_AND_VERIFIED | Central state refresh runs after mutations. E7 |
| DATA-08 | Use live ledger rather than mocks/placeholders | COMPLETE_BUT_NEEDS_VERIFICATION | Runtime uses central state; remaining hardcoded report/date logic is audited under REPORT-08. |
| DATA-09 | Selected account updates every consumer consistently | COMPLETE_BUT_NEEDS_VERIFICATION | Needs cross-screen production test. |
| DATA-10 | Automated end-to-end create/persist/downstream test | ACTUALLY_INCOMPLETE | Phase 6. |
| TX-01 | Define Add Transaction versus Add Ledger Item purposes | STALE_DUPLICATE_OR_NOT_APPLICABLE | Normal create paths now share one form; advanced journal entry is a separate future workflow. |
| TX-02 | Remove inconsistencies between transaction entry workflows | COMPLETE_AND_VERIFIED | E6 |
| TX-03 | Use shared transaction component/schema | COMPLETE_AND_VERIFIED | E6 |
| TX-04 | Same account/date/counterparty/description/amount/direction/category/tags/attachments | COMPLETE_AND_VERIFIED | Shared component renders and persists these fields. E5-E6 |
| TX-05 | Same tax mapping, reconciliation status, and explicit debit/credit controls | ACTUALLY_INCOMPLETE | These fields are not exposed in shared normal transaction form. Decide normal vs advanced visibility in Phase 2. |
| TX-06 | Do not require negative expense input | COMPLETE_AND_VERIFIED | Positive UI amount plus direction creates signed amount. E6 |
| TX-07 | Money In/Out/Transfer/Journal Entry selector | ACTUALLY_INCOMPLETE | Money In/Out exist; Transfer and Journal Entry modes do not. Phase 2. |
| TX-08 | Convert direction to correct signed/debit/credit values | COMPLETE_AND_VERIFIED | Money In/Out journal assertions pass. E11 |
| TX-09 | Verify sign logic is not reversed | COMPLETE_AND_VERIFIED | Signed direction and balanced debit/credit tests pass. E11 |
| TX-10 | Verify asset/liability/equity/revenue/expense behavior | ACTUALLY_INCOMPLETE | Needs accounting test matrix and any resulting fixes. Phase 2. |
| TX-11 | Prevent double counting transaction and journal rows | COMPLETE_BUT_NEEDS_VERIFICATION | Shared journal calculations and reconciliation tests pass; production mutation proof remains. E17 |
| TX-12 | Separate simple cash entry from advanced journal entry | ACTUALLY_INCOMPLETE | No explicit advanced journal workflow. Phase 2 after launch-normal flow. |
| TX-13 | Existing attachments visible/manageable while editing | COMPLETE_AND_VERIFIED | Shared form filters transaction attachments and supports preview/delete/upload. E6 |
| TX-14 | Receipt camera/upload, storage, OCR, review, form mapping | COMPLETE_BUT_NEEDS_VERIFICATION | Camera/upload, shared attachment list, Worker OCR routes, confidence review, and explicit form mapping are implemented and locally verified; authenticated production OCR remains open. E12 |

### Recurring schedules

| ID | Former requirement | Classification | Evidence / reason |
|---|---|---|---|
| SCH-01 | No schedule popup on login/dashboard load | COMPLETE_AND_VERIFIED | Modal state defaults closed and opens only by command action. |
| SCH-02 | Open only from explicit Add action | COMPLETE_AND_VERIFIED | Source inspection. |
| SCH-03 | Stay closed after refresh/navigation/restart | COMPLETE_BUT_NEEDS_VERIFICATION | State is not persisted open; browser/PWA proof missing. |
| SCH-04 | Cancel does not create incomplete schedule | COMPLETE_BUT_NEEDS_VERIFICATION | Submit-only mutation; interaction test missing. |
| SCH-05 | Create persists and updates projections | COMPLETE_BUT_NEEDS_VERIFICATION | API mutation/refresh exists; production assertion missing. |
| SCH-06 | Edit, pause, resume, generate, delete, refresh, no duplicates | COMPLETE_BUT_NEEDS_VERIFICATION | Full lifecycle and deterministic retry protection are implemented and locally verified; isolated authenticated production lifecycle test remains. E16 |

### Dashboard, reports, and forecasts

| ID | Former requirement | Classification | Evidence / reason |
|---|---|---|---|
| DASH-01 | Dashboard is operational home | COMPLETE_BUT_NEEDS_VERIFICATION | Implemented structure needs acceptance review. |
| DASH-02 | Required content priority | COMPLETE_BUT_NEEDS_VERIFICATION | Needs visual acceptance at desktop/mobile. |
| DASH-03 | No setup/schedule form dominates initial load | COMPLETE_AND_VERIFIED | Source inspection. |
| DASH-04 | Useful empty states | COMPLETE_BUT_NEEDS_VERIFICATION | Present in key areas; full consumer audit missing. |
| DASH-05 | Loading/no-data/error states | COMPLETE_AND_VERIFIED | Dashboard exposes loading, retry, error, updated state. |
| DASH-06 | Selected account/current date consistency | COMPLETE_BUT_NEEDS_VERIFICATION | Needs cross-widget assertion. |
| REPORT-01 | Reports update after ledger activity | COMPLETE_BUT_NEEDS_VERIFICATION | Reactive data path exists; production test missing. |
| REPORT-02 | Forecast updates after transaction/schedule | COMPLETE_BUT_NEEDS_VERIFICATION | Reactive calculations exist; production test missing. |
| REPORT-03 | Date filters affect every report | COMPLETE_BUT_NEEDS_VERIFICATION | Needs report matrix. |
| REPORT-04 | Account filters affect every report | COMPLETE_BUT_NEEDS_VERIFICATION | Needs report matrix. |
| REPORT-05 | Recalculate after all listed mutation types | COMPLETE_BUT_NEEDS_VERIFICATION | Central refresh exists; assertions missing. |
| REPORT-06 | Totals reconcile to general ledger | COMPLETE_BUT_NEEDS_VERIFICATION | Automated source-ledger reconciliation covers balanced journals plus missing/orphan mappings and is visible in Reports; authenticated production mutation proof remains. E17 |
| REPORT-07 | Visible last-updated/refresh state | COMPLETE_AND_VERIFIED | Dashboard/forecast show update state. |
| REPORT-08 | Remove hardcoded/demo/stale report values | COMPLETE_AND_VERIFIED | Fixed runtime Ledger and Reconciliation date anchors were replaced with current calendar values; forecast zero-balance fallback was corrected. Explicit sample-import/reset fixtures remain intentionally labeled sample data. E17 |

### UI, responsive behavior, and PWA

| ID | Former requirement | Classification | Evidence / reason |
|---|---|---|---|
| UI-01 | Full UI audit | ACTUALLY_INCOMPLETE | Phase 5. |
| UI-02 | Standardize buttons | ACTUALLY_INCOMPLETE | Many one-off class sets remain. |
| UI-03 | Consistent icon system | COMPLETE_BUT_NEEDS_VERIFICATION | Lucide is dominant; full scan needed. |
| UI-04 | Standardize cards/tables/inputs/dropdowns/modals/tabs/alerts/badges/empty states | ACTUALLY_INCOMPLETE | No shared primitive layer or full audit. |
| UI-05 | Reduce wasted padding | COMPLETE_BUT_NEEDS_VERIFICATION | Several responsive reductions implemented; visual audit missing. |
| UI-06 | Improve hierarchy | COMPLETE_BUT_NEEDS_VERIFICATION | Acceptance judgment required. |
| UI-07 | Remove duplicate actions/confusing labels | COMPLETE_BUT_NEEDS_VERIFICATION | Major transaction duplication removed; full scan remains. |
| UI-08 | Consistent terminology | COMPLETE_BUT_NEEDS_VERIFICATION | Counterparty terminology updated; full scan remains. |
| UI-09 | Theme/accent consistency | COMPLETE_BUT_NEEDS_VERIFICATION | Global theme exists; visual sweep missing. |
| UI-10 | Remove hardcoded theme colors | ACTUALLY_INCOMPLETE | Numerous hardcoded zinc/black/emerald combinations remain. Phase 5. |
| MOB-01 | Every screen usable on mobile | COMPLETE_BUT_NEEDS_VERIFICATION | Responsive code exists; required viewport evidence missing. |
| MOB-02 | Test 320/375/390/430/tablet/desktop | ACTUALLY_INCOMPLETE | Phase 5 automated screenshots/interactions. |
| MOB-03 | No horizontal page scroll | COMPLETE_BUT_NEEDS_VERIFICATION | Needs viewport audit. |
| MOB-04 | Responsive wide tables | COMPLETE_BUT_NEEDS_VERIFICATION | Several wrappers/card modes exist; full screen audit missing. |
| MOB-05 | Adequate touch targets | COMPLETE_BUT_NEEDS_VERIFICATION | Needs mobile audit. |
| MOB-06 | Scrollable viewport-safe modals | COMPLETE_BUT_NEEDS_VERIFICATION | Shared form/dashboard overlay scroll; all modals need proof. |
| MOB-07 | Forms keep actions visible | COMPLETE_BUT_NEEDS_VERIFICATION | Needs viewport interaction test. |
| MOB-08 | Navigation/assistant/dialog/dropdown overlap | COMPLETE_BUT_NEEDS_VERIFICATION | Needs screenshot/interaction audit. |
| MOB-09 | Charts/widgets resize without clipping | COMPLETE_BUT_NEEDS_VERIFICATION | Needs screenshot audit. |
| MOB-10 | Installed standalone PWA works | ACTUALLY_INCOMPLETE | Phase 5 installed-PWA test. |

### Verification and historical cleanup

| ID | Former requirement | Classification | Evidence / reason |
|---|---|---|---|
| VER-01 | Run against configured production Supabase | COMPLETE_AND_VERIFIED | E2-E4 |
| VER-02 | Create, refresh, sign out/in, restart persistence test | ACTUALLY_INCOMPLETE | Phase 6/7. |
| VER-03 | Browser console/network audit | ACTUALLY_INCOMPLETE | Phase 6. |
| VER-04 | No critical localStorage financial dependency | COMPLETE_AND_VERIFIED | E7 |
| VER-05 | Document root cause of each major defect | COMPLETE_BUT_NEEDS_VERIFICATION | API/CORS/RLS root causes recorded; future defects must be added as found. |
| VER-06 | Record changed files | COMPLETE_AND_VERIFIED | Git commits provide durable file lists. |
| VER-07 | Record migrations separately | STALE_DUPLICATE_OR_NOT_APPLICABLE | No migration was required for completed API fix; future migrations must be isolated. |
| VER-08 | Desktop/mobile screenshot evidence | ACTUALLY_INCOMPLETE | Phase 5. |
| VER-09 | Do not complete from compilation alone | STALE_DUPLICATE_OR_NOT_APPLICABLE | Governance rule enforced by final acceptance gate. |
| VER-10 | Completion requires live verification | STALE_DUPLICATE_OR_NOT_APPLICABLE | Duplicates final acceptance gate. |
| VER-11 | Dynamic-import outdated chunk error | COMPLETE_AND_VERIFIED | Current production hashed modules load; chunk recovery and no-cache SW behavior deployed. E9 |

## Prioritized launch completion plan

Only incomplete implementation and required verification remain here. Phases are ordered by dependency and launch impact.

### Phase 1 - Production identity, API contract, and smoke-test foundation

- [x] Add a durable QiFi route/caller/table/auth matrix (`API-05`). Evidence: E10.
- [x] Add a dedicated authenticated production smoke-test identity and secure CI secrets. Evidence: E15.
- [x] Automate login/session acquisition without exposing credentials. Evidence: E15.
- [x] Assert authenticated `/api/finance/state` returns the expected schema and populated reference data. Evidence: E15.
- [ ] Record development and production network evidence (`API-03`, `API-04`, `API-10`, `API-18`).
- [ ] Add deployment gates for required Worker routes, origins, and secret names.

### Phase 2 - Transaction, receipt, accounting, and downstream integrity

- [x] Add receipt camera capture plus normal file upload. Evidence: E12.
- [x] Use the existing attachment OCR columns and shared Worker AI client; do not add duplicate receipt tables. Evidence: E12.
- [x] Show merchant, date, total, subtotal, tax, tip, payment method, receipt number, category, and confidence for explicit review; map suggestions only after confirmation. Evidence: E12.
- [x] Configure production `OPENAI_API_KEY` and deploy QiApi/Pages. Evidence: E13-E14.
- [ ] Run authenticated production receipt and assistant tests before verifying `TX-14`.
- [ ] Decide and implement normal-form visibility for tax mapping and reconciliation status (`TX-05`).
- [ ] Implement or explicitly separate Transfer and advanced Journal Entry modes (`TX-07`, `TX-12`).
- [x] Add accounting tests for sign and debit/credit (`TX-08`, `TX-09`). Evidence: E11.
- [ ] Add account-type and double-count prevention tests (`TX-10`, `TX-11`).
- [ ] Add authenticated create/edit/attachment persistence tests for every shared field.
- [ ] Assert each mutation updates balances, dashboard, reports, forecast, and review queue (`API-22`, `DATA-01` through `DATA-10`).

### Phase 3 - Recurring schedule lifecycle

- [x] Implement create, edit, pause, resume, occurrence generation, delete, refresh, calendar-safe advancement, and deterministic duplicate prevention. Evidence: E16.
- [ ] Run the authenticated lifecycle mutation test in an isolated smoke workspace (`SCH-03` through `SCH-06`).
- [ ] Assert every lifecycle mutation refreshes forecasts and scheduled cash-flow reports.

### Phase 4 - Report and forecast reconciliation

- [x] Remove fixed runtime dates, demo anchors, placeholders, and stale calculations (`REPORT-08`). Evidence: E17.
- [ ] Build a report/filter/mutation test matrix (`REPORT-01` through `REPORT-05`).
- [x] Add local report/forecast reconciliation calculations and tests against source transactions and journal lines (`REPORT-06`). Evidence: E17.
- [ ] Run authenticated production mutation/reconciliation assertions for reports and forecasts (`REPORT-01` through `REPORT-06`).

### Phase 5 - UI, required viewports, and installed PWA

- [ ] Complete shared UI primitives and eliminate remaining inconsistent/hardcoded styling (`UI-01` through `UI-10`).
- [ ] Run screenshot and interaction tests at 320, 375, 390, 430, tablet, and desktop widths (`MOB-01` through `MOB-09`).
- [ ] Fix every overflow, overlap, clipping, touch-target, form-action, and modal defect found.
- [ ] Install and test the production PWA in standalone mode, including refresh/update recovery (`MOB-10`).

### Phase 6 - Production observability and automated smoke suite

- [ ] Capture production console and network logs; resolve every unexplained error (`VER-03`).
- [ ] Run automated authenticated smoke tests after Worker and Pages deployments.
- [ ] Store evidence artifacts and fail deployment when critical assertions fail.

### Phase 7 - Final ten-step acceptance gate

- [ ] 1. Login without a recurring schedule popup.
- [ ] 2. Create a normal Money Out expense without entering a negative number.
- [ ] 3. Confirm the transaction persists in Supabase.
- [ ] 4. Confirm balanced ledger entries are correct.
- [ ] 5. Confirm selected account balance updates.
- [ ] 6. Confirm dashboard widgets update.
- [ ] 7. Confirm relevant reports update.
- [ ] 8. Confirm forecast balance updates.
- [ ] 9. Refresh, sign out/in, and restart; confirm persistence.
- [ ] 10. Repeat at a required mobile viewport without layout breakage.

QiFi is launch-complete only when every Phase 7 item passes in production and the evidence is committed.
