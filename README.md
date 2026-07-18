# QiFi

Private finance workspace for bills, receipts, CSV imports, reconciliation, and ledger review.

## Apps

- Web app: `app/qifinance-web`
- Central Cloudflare Worker API: `C:\QiLabs\25_QiWorkers\251_QiApi`
- Supabase schema: `supabase/migrations/schema.sql`

## Local Web App

```powershell
cd app/qifinance-web
npm install
npm run dev
```

The web app uses the centralized Qi API at `https://api.qially.com`. Override it only for local development in `app/qifinance-web/.env`:

```ini
VITE_QIFINANCE_API_BASE_URL="https://api.qially.com"
```

## API and Authentication

All finance data routes are implemented in `251_QiApi` under `/api/finance/*`. The web app obtains a Supabase user access token through the supported magic-link flow and sends it as a bearer token to the centralized API. The Worker forwards that user identity to Supabase so RLS remains authoritative.

The only intentional direct browser-to-Supabase calls are authentication operations in `src/lib/supabase.ts` and `src/App.tsx`. All finance reads and writes use the single client in `src/lib/qifinanceApi.ts`.

The legacy standalone `app/qifinance-worker` was removed after route parity was verified. Do not recreate it or add a service-role key to the browser application.

## Qi Assistant

QiFi includes a protected assistant endpoint at `/api/finance/assistant`. The assistant plans requests with OpenAI, then `251_QiApi` executes only approved, whitelisted actions with the signed-in user's Supabase context.

## Installable App

QiFi includes a web manifest, icons, and service worker. Once deployed over HTTPS, browsers can install it as a standalone app on Windows, Android, iOS, and desktop Chrome/Edge.
