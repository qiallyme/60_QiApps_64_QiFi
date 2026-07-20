# Finance API route matrix

Verified against QiFi `qifinanceApi.ts` and `251_QiApi/src/modules/finance/routes.ts` on 2026-07-18.

All routes use the production base URL `https://api.qially.com`, require a Supabase bearer session through `requireUser`, and are owned by the `qiapi` Cloudflare Worker. Database access is server-side through `SUPABASE_SECRET_KEY`; the browser uses Supabase directly only to establish/restore its auth session.

| Methods | Route | QiFi caller | Supabase table or service |
|---|---|---|---|
| GET | `/health`, `/health/ready` | health/startup gate | Worker and Supabase readiness |
| GET | `/api/finance/state` | central store hydration/refresh | financial_accounts, ledger_accounts, categories, transactions, journal_entries, journal_lines, import_batches, import_rows_raw, classification_rules, attachments, statements, recurring_transactions, counterparties, obligations |
| POST | `/api/finance/assistant` | AssistantView | OpenAI plus finance context |
| POST | `/api/finance/assistant/plans/:id/execute` | AssistantView | assistant plan tables plus affected finance tables |
| GET, POST | `/api/finance/accounts` | API client/chart of accounts | ledger_accounts |
| PATCH, DELETE | `/api/finance/accounts/:id` | central store | ledger_accounts |
| GET, POST | `/api/finance/categories` | API client/store | categories |
| GET, POST | `/api/finance/transactions` | central store/import/manual entry | transactions, journal_entries, journal_lines, financial_accounts |
| GET, PATCH, DELETE | `/api/finance/transactions/:id` | shared TransactionForm/ledger | transactions, journal_entries, journal_lines, financial_accounts |
| POST | `/api/finance/import/preview` | ImportView/store | classification_rules, ledger_accounts, transactions |
| POST | `/api/finance/import/commit` | ImportView/store | import_batches, import_rows_raw, transactions, journal_entries, journal_lines, financial_accounts |
| GET | `/api/finance/import-batches` | state/read API | import_batches |
| GET | `/api/finance/raw-rows` | state/read API | import_rows_raw |
| PATCH | `/api/finance/raw-rows/:id` | review/import store | import_rows_raw |
| POST | `/api/finance/attachments` | shared TransactionForm/store | attachments and Supabase Storage |
| GET, DELETE | `/api/finance/attachments/:id/url` or `:id` | attachment preview/shared form | attachments and Supabase Storage |
| POST | `/api/finance/attachments/:id/process-receipt` | shared TransactionForm receipt review | shared Worker AI client, attachments OCR columns, Supabase Storage |
| GET | `/api/finance/attachments/:id/receipt-processing` | shared TransactionForm/API client | attachments OCR columns |
| GET, POST | `/api/finance/rules` | CategoryRulesView/store | classification_rules |
| PATCH, DELETE | `/api/finance/rules/:id` | CategoryRulesView/store | classification_rules |
| GET, POST | `/api/finance/statements` | reconciliation store | statements |
| PATCH, DELETE | `/api/finance/statements/:id` | reconciliation store | statements |
| GET, POST | `/api/finance/schedules` | ForecastView/store | recurring_transactions |
| PATCH, DELETE | `/api/finance/schedules/:id` | ForecastView/store | recurring_transactions |
| GET, POST | `/api/finance/counterparties` | shared form/counterparty store | counterparties |
| PATCH, DELETE | `/api/finance/counterparties/:id` | counterparty store | counterparties |
| GET, POST | `/api/finance/obligations` | accountability store | obligations |
| PATCH, DELETE | `/api/finance/obligations/:id` | accountability store | obligations |
| GET | `/api/finance/ledger-entries` | read API/state | journal_lines |
| GET | `/api/finance/financial-accounts` | account selector/read API | financial_accounts |
| POST | `/api/finance/financial-accounts` | FinancialAccountsView | financial_accounts |
| GET | `/api/finance/ledger-accounts`, `/tax-mappings`, `/journal-entries`, `/journal-lines` | read API/state | named table |

## Contract gates

- Unauthenticated finance requests must return 401.
- Authenticated state must return the complete array schema asserted by `scripts/smoke-production.mjs`.
- `financialAccounts`, `ledgerAccounts`, and `categories` must be populated for transaction dropdowns.
- CORS preflight from `https://fi.qially.com` must permit `Authorization` and `Content-Type`.
- Mutating route behavior is covered separately by the transaction and schedule lifecycle phases so production smoke data can be created and cleaned up deliberately.

## AI runtime configuration

The assistant and receipt OCR share `src/ai/client.ts`. The only secret binding is `OPENAI_API_KEY`; models and timeout use the non-secret `OPENAI_MODEL`, `OPENAI_RECEIPT_MODEL`, and `OPENAI_TIMEOUT_MS` variables. Configure the missing production secret from the QiApi repository with `wrangler secret put OPENAI_API_KEY`, then deploy with `npm run deploy:production`. `GET /health/ai` reports whether the binding exists without returning its value.
