Completed 2026-07-16. Existing features were retained and verified; missing behavior was implemented.

* [X] Add persistent dark/light appearance and selectable accent colors in Settings.
* [X] Fix live forecast balances, reduce page padding, and improve responsive layout.
* [X] Move recurring cash schedule entry into a popup workflow.
* [X] Recalculate projections from the selected financial account, current date, schedules, and entries.
* [X] Add a floating contextual Qi Assistant available from every screen.
* [X] Surface manually entered transactions needing classification in Review Queue.
* [X] Suggest classification rules from current ledger transactions with optional one-click creation.
* [X] Verify the GAAP-style ledger search, filters, export, journal detail, evidence, and reconciliation indicators.
* [X] Add compact card/table switching for counterparties.
* [X] Standardize terminology on “Counterparties.”
* [X] Add attachment thumbnails and rename document upload actions to “Add Files.”
* [X] Verify the nested GAAP Chart of Accounts and yearly tax reporting/tax mapping support.
* [X] Allow Qi Assistant to answer read-only account lookup, count, comparison, and verification questions from live context.
* [X] Complete the immediate PWA/production review: repair install icon paths, bump offline cache, add route code splitting, and preserve responsive standalone behavior.

# QiFinance Follow-Up Fix List

Reopened 2026-07-18. Several items previously marked complete are either incomplete, incorrectly implemented, or not connected to live Supabase data. Do not mark any item complete until the behavior is verified in the running application after refresh and on mobile.

## Priority 0 — Verify Main API Worker and Remove Legacy QiFi API Code

The intended production API is the centralized main worker, `251_QiApi`. The application still contains code from the previous standalone QiFi API worker. Determine which API is actually being used before making additional data-layer fixes.

* [ ] Identify every API client, base URL, environment variable, proxy, service module, and direct Supabase call currently used by QiFinance.
* [ ] Confirm whether the running application sends requests through the centralized `251_QiApi` worker.
* [ ] Verify the actual production and development worker URLs through browser network requests, not only configuration files.
* [ ] Confirm the deployed `251_QiApi` routes required by QiFinance are working and return live authenticated Supabase data.
* [ ] Inventory all QiFinance API routes and map each one to:

  * Current frontend caller
  * Current endpoint
  * Intended `251_QiApi` endpoint
  * Supabase table or operation
  * Authentication requirements
  * Current status
* [ ] Identify any requests still being sent to the old QiFi API worker.
* [ ] Identify duplicated business logic that exists in both `251_QiApi` and the old QiFi API code.
* [ ] Confirm whether the old QiFi API worker is still deployed, referenced by DNS, configured in environment variables, or called by any application.
* [ ] Do not delete legacy code until all required routes have been verified or migrated to `251_QiApi`.
* [ ] Migrate any still-required QiFi routes, validation, calculations, or Supabase operations into the appropriate module inside `251_QiApi`.
* [ ] Update the frontend to use one documented API client and one source of truth for its API base URL.
* [ ] Remove obsolete API URLs, fallback endpoints, duplicate fetch wrappers, dead proxy code, and unused environment variables.
* [ ] Remove direct Supabase calls from the frontend when those operations are intended to go through the centralized worker.
* [ ] Preserve direct frontend Supabase usage only where it is intentionally required, such as supported authentication flows, and document that exception.
* [ ] Remove the old QiFi API worker code only after confirming there are no remaining imports, routes, deployments, secrets, bindings, or runtime requests using it.
* [ ] Remove or archive obsolete worker deployment configuration, including outdated Wrangler files, scripts, service bindings, and CI deployment steps.
* [ ] Confirm that only the intended worker is deployed during future QiFinance builds and releases.
* [ ] Verify that authentication, user identity, account ownership, and RLS context are correctly passed through `251_QiApi`.
* [ ] Verify that mutations through `251_QiApi` trigger the frontend refresh and cache invalidation needed for balances, forecasts, reports, and widgets.
* [ ] Add clear errors when the frontend cannot reach `251_QiApi`; do not silently fall back to stale data, local state, or an old endpoint.

### Required Architecture Verification

Before reporting this section complete, provide:

1. The API base URL actually used by the running QiFinance application.
2. A network request showing QiFinance successfully calling `251_QiApi`.
3. A list of QiFinance routes now served by `251_QiApi`.
4. A list of any intentional direct Supabase calls that remain.
5. A list of old QiFi API files, deployments, variables, and routes removed.
6. Confirmation that no repository or production environment still references the old worker.
7. A successful live test in which a transaction passes through `251_QiApi`, persists to Supabase, and updates the ledger, balance, widgets, reports, and forecast.

## Additional Completion Requirement

Do not mark the broader Supabase, reporting, forecast, or persistence issues complete until the API path has been traced end to end:

`QiFinance UI → API client → 251_QiApi route → Supabase → API response → frontend query refresh → updated UI`

Compilation, successful deployment, or the existence of the new worker does not prove that QiFinance is actually using it.

## Priority 1 — Data, Ledger, and Supabase Logic

* [ ] Trace the full data flow from transaction creation to Supabase persistence, ledger updates, dashboard widgets, reports, balances, forecasts, and review queues.
* [ ] Confirm all create, update, and delete actions write to the correct Supabase tables and are not only updating temporary local state.
* [ ] Confirm the application reads current Supabase data after login, page refresh, navigation, and app restart.
* [ ] Add visible error handling for failed Supabase reads or writes instead of silently failing.
* [ ] Verify Supabase environment variables, API routes, authentication context, RLS policies, table names, and account ownership filters.
* [ ] Fix dashboard widgets, reports, account balances, and forecast balances so they update immediately after adding, editing, deleting, or classifying an entry.
* [ ] Invalidate or refresh all affected queries after mutations.
* [ ] Confirm calculations are based on live ledger data rather than mock data, cached placeholders, or stale client state.
* [ ] Verify that selecting a different financial account updates every related balance, report, forecast, schedule, and widget consistently.
* [ ] Add an end-to-end verification test: create a transaction, confirm it appears in Supabase, the ledger, the selected account balance, dashboard widgets, reports, forecasts, and review queue where applicable.

## Priority 2 — Transaction and Ledger Entry Logic

* [ ] Compare the “Add New Transaction” and “Add Ledger Item” workflows and define their intended purposes.
* [ ] Remove unnecessary inconsistencies between the two workflows.
* [ ] Use one shared transaction-entry component or one shared schema where possible.
* [ ] Ensure both workflows support the same relevant fields, including:

  * Account
  * Date
  * Counterparty
  * Description or memo
  * Amount
  * Transaction direction
  * Category or classification
  * Debit and credit account mapping
  * Attachments
  * Tax mapping
  * Tags
  * Reconciliation status
* [ ] Stop requiring users to manually enter negative numbers for ordinary withdrawals or expenses.
* [ ] Add a clear transaction direction selector such as:

  * Money Out / Withdrawal / Expense
  * Money In / Deposit / Income
  * Transfer
  * Journal Entry
* [ ] Convert the selected direction into the correct internal debit, credit, and signed amount logic.
* [ ] Double-check that the current positive and negative amount logic is not reversed or producing incorrect balances.
* [ ] Verify accounting behavior for assets, liabilities, equity, income, and expenses.
* [ ] Prevent double counting when a transaction creates corresponding ledger entries.
* [ ] Clearly distinguish simple cash transactions from advanced manual journal entries without forcing normal users to understand raw debit and credit mechanics.

## Priority 3 — Recurring Schedule Workflow

* [ ] Remove the recurring bill or cash schedule popup from the login and initial dashboard load.
* [ ] The schedule form must open only when the user explicitly selects “Add Scheduled Bill,” “Add Recurring Transaction,” or a similar action.
* [ ] The popup must remain closed after login, refresh, navigation, and app restart unless intentionally opened.
* [ ] Verify that closing or canceling the popup does not create an incomplete schedule.
* [ ] Confirm saved recurring schedules persist to Supabase and immediately update forecasts and scheduled cash-flow reports.
* [ ] Confirm editing, pausing, resuming, and deleting schedules also refreshes all affected projections.

## Priority 4 — Dashboard Structure

* [ ] Make the main dashboard the actual operational home screen.
* [ ] Prioritize the dashboard content in this order:

  1. Key balance and cash-flow widgets
  2. Forecast and upcoming obligations
  3. Reports and financial summaries
  4. Add New Transaction
  5. Review Queue and items requiring action
* [ ] Do not allow schedule-entry forms or setup dialogs to dominate the initial dashboard.
* [ ] Add useful empty states when there is not enough data for a widget or report.
* [ ] Clearly indicate when a widget is loading, has no data, or failed to load.
* [ ] Confirm dashboard widgets use the selected account and current date range consistently.

## Priority 5 — Reports and Forecasts

* [ ] Repair all reports that do not update after new ledger activity.
* [ ] Repair forecast balances that remain unchanged after transactions or recurring schedules are added.
* [ ] Verify date-range filters affect every report correctly.
* [ ] Verify account filters affect every report correctly.
* [ ] Verify reports recalculate after:

  * New transaction
  * Edited transaction
  * Deleted transaction
  * New recurring schedule
  * Edited recurring schedule
  * Classification change
  * Account change
* [ ] Confirm totals reconcile back to the general ledger.
* [ ] Add a visible “last updated” timestamp or refresh state where useful.
* [ ] Remove any hardcoded, placeholder, demo, or stale report values.

## Priority 6 — Complete UI Cleanup

* [ ] Perform a full UI audit rather than making isolated layout changes.
* [ ] Standardize all buttons, including size, radius, spacing, hover state, active state, disabled state, and icon alignment.
* [ ] Replace inconsistent, missing, or placeholder icons with one consistent icon system.
* [ ] Standardize cards, tables, inputs, dropdowns, modals, tabs, alerts, badges, and empty states.
* [ ] Reduce unnecessary padding and wasted space throughout the application.
* [ ] Improve visual hierarchy so primary actions, balances, reports, and warnings are immediately understandable.
* [ ] Remove duplicate actions and confusing labels.
* [ ] Verify terminology is consistent across transactions, ledger entries, accounts, schedules, reports, and counterparties.
* [ ] Confirm dark mode, light mode, and accent colors apply consistently to every component.
* [ ] Fix components that still use hardcoded colors or do not react to theme changes.

## Priority 7 — Mobile and Responsive Behavior

* [ ] Make every screen fully usable on mobile widths, not merely scaled down.
* [ ] Test at minimum:

  * 320px
  * 375px
  * 390px
  * 430px
  * Tablet width
  * Desktop width
* [ ] Remove horizontal page scrolling.
* [ ] Convert wide tables into responsive cards, stacked rows, expandable details, or controlled horizontal table containers.
* [ ] Ensure buttons and touch targets are large enough for mobile use.
* [ ] Ensure modals fit within the viewport and can scroll internally.
* [ ] Ensure forms do not overflow the screen or hide submit and cancel actions.
* [ ] Ensure the navigation, floating Qi Assistant, dialogs, dropdowns, and menus do not overlap important content.
* [ ] Ensure charts and widgets resize correctly without clipped labels or unreadable values.
* [ ] Verify the installed PWA behaves correctly in standalone mobile mode.

## Priority 8 — Verification Before Completion

* [ ] Run the application against the real configured Supabase project, not only mock data or local fixtures.
* [ ] Test persistence by creating data, refreshing the browser, signing out, signing back in, and restarting the app.
* [ ] Check the browser console and network requests for failed API calls, permission errors, hydration errors, or stale query behavior.
* [ ] Confirm no critical feature depends solely on localStorage unless intentionally designed that way.
* [ ] Document the root cause of each major defect.
* [ ] Provide a concise list of files changed.
* [ ] Provide database or migration changes separately.
* [ ] Provide screenshots or test evidence for desktop and mobile.
* [ ] Do not mark the work complete based only on successful compilation.
* [ ] Completion requires verified live behavior in the running application.

## Required Completion Test

Before reporting completion, demonstrate this exact flow:

1. Log in without any recurring schedule popup appearing.
2. Add a normal expense using “Money Out” without typing a negative number.
3. Confirm the record is saved in Supabase.
4. Confirm the ledger entry is created correctly.
5. Confirm the account balance updates.
6. Confirm dashboard widgets update.
7. Confirm relevant reports update.
8. Confirm forecast balances update.
9. Refresh the browser and confirm all changes remain.
10. Repeat the workflow on a mobile viewport without layout breakage.

## 2026-07-18 Code and Architecture Audit Result

Implemented and verified in source/build:

* QiFinance now has one finance API client, defaulting to `https://api.qially.com`, with all finance data routed through `/api/finance/*` in `251_QiApi`.
* Direct browser Supabase access is limited to supported authentication/session handling.
* The duplicate standalone `app/qifinance-worker`, its Wrangler configuration/cache, stale mock service, old hostname references, and deployed `qifinance-api` Worker were removed.
* Central-API state is authoritative. Failed reads/writes display a synchronization error rather than silently substituting mock or browser-only financial data.
* Transactions, imports, classifications, review-queue status, attachments, statements, reconciliation, schedules, counterparties, and obligations refresh central state after successful mutations.
* Normal manual transaction forms now use explicit Money In/Money Out direction and convert positive user input to the correct signed amount.
* Dashboard loading, failure, retry, and last-updated states are visible; summaries use hydrated live transactions.
* Frontend TypeScript lint and production build pass. `251_QiApi` TypeScript typecheck passes.

Intentionally retained localStorage uses are non-authoritative preferences, form drafts, optional user-supplied assistant key/token, and explicit backup/export tooling. They are not used as a fallback for failed live finance persistence.

Still requiring an authenticated human/live-data verification before the corresponding checklist boxes may be marked complete:

* The exact Required Completion Test above, including direct Supabase record inspection and sign-out/sign-in persistence.
* Browser network/console evidence from an authenticated production session.
* Visual checks at every listed viewport and installed-PWA standalone testing.
* Full visual-system and dashboard-preference acceptance review.

Existing API test-suite note: finance route typechecking passes, but three pre-existing environment-sensitive tests are not green when the repository `.dev.vars` is loaded (environment expectation, readiness error classification, and CORS origin expectation). These are recorded as unresolved verification work rather than treated as evidence of finance-route failure.

* [ ] correct this error: This screen could not render - Your financial data was not deleted. QiFi found an outdated app file and can load the latest version. - Failed to fetch dynamically imported module: <https://fi.qially.com/assets/ForecastView-BZ5MURvZ.js> - Load latest QiFi version
