# QiFi

Private finance workspace for bills, receipts, CSV imports, reconciliation, and ledger review.

## Apps

- Web app: `app/qifinance-web`
- Cloudflare Worker API: `app/qifinance-worker`
- Supabase schema: `supabase/migrations/schema.sql`

## Local Web App

```powershell
cd app/qifinance-web
npm install
npm run dev
```

The web app defaults to `https://api.fi.qially.com`. Override it in `app/qifinance-web/.env`:

```ini
VITE_QIFINANCE_API_BASE_URL="https://api.fi.qially.com"
```

## Worker Auth

The Worker requires a private bearer token for every route except `/health`.

Set the production secret before deploying:

```powershell
cd app/qifinance-worker
npx wrangler secret put QIFI_API_TOKEN
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put OPENAI_API_KEY
npx wrangler deploy
```

For local Worker development, copy `.dev.vars.example` to `.dev.vars` and fill in private values. Do not commit `.dev.vars`.

## Qi Assistant

QiFi includes a protected assistant endpoint at `/api/finance/assistant`. The assistant plans requests with OpenAI, then the Worker executes only whitelisted create actions through the existing Supabase gateway.

## Installable App

QiFi includes a web manifest, icons, and service worker. Once deployed over HTTPS, browsers can install it as a standalone app on Windows, Android, iOS, and desktop Chrome/Edge.
