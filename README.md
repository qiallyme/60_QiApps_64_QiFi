# QiFinance: Private Accounting & Personal Ledger Agent

QiFinance is a private, double-entry ledger database built for personal financial organization, business IOUs, utility bills, capital assets, and automated accounts register audits. 

---

## 🚀 Key Advantages

- **Strict Double-Entry Bookkeeping**: Real assets, liabilities, equities, income, and expenses calculate directly off posted ledger rows. Total Debits strictly balance Total Credits on every file transaction or paydown settlement.
- **Relational Integrity**: Built on TypeScript models designed directly for seamless integration with Supabase Postgres.
- **Cloudflare Zero Trust Guard Ready**: Optimized for safe deployment behind a Zero Trust proxy (Cloudflare Access / Gatekeepers) providing ironclad authorization before exposing frontends or storage credentials.
- **Dynamic Valuation Audits**: Assets, IOUs, and pending liabilities are updated chronologically. Built-in reports immediately identify missing evidence URL attachments, disputable items, and unreviewed cash positions.

---

## 🗃️ Modules Architecture

### 1. Chart of Accounts
Manages standard accounts categorized as checking, savings, cash, credit cards, long-term loans, receivable, payable, consulting revenue, and standard operating expenses. Balances are calculated dynamically off posted journal lines to prevent value drift.

### 2. General Ledger
View all posted, balanced ledger transactions. Supports advanced multi-line journal splittings with live mathematical verification indicating discrepancy indices.

### 3. Informal IOUs & Debts
Track personal loans or advances connected to registered parties in the directory. Payment paydowns post balanced transaction lines which update current liability outstanding balances automatically.

### 4. Scheduled Bills
Schedules upcoming rents, electricity liabilities, or software subscriptions. Mark paid triggers the creation of double-entry rows reducing checking assets and recording matching operating expenses.

### 5. Holdings Assets
Records vehicles, laptops, property leases, or hardware equipment costs versus current market estimated valuations.

### 6. Audit & Financial Statements
- **Trial Balance**: Sums total Debit movements versus credit movements verifying double-entry equilibrium across the workspace.
- **Balance Sheet**: Assets, Liabilities, and Equity ledger totals.
- **Income Statement**: Income profit/loss calculations.
- **Confirmations Registry**: Flags items awaiting receipt scans and outstanding disputes.

---

## 🛠️ Deployment Checklist

### Phase A: Supabase Schema SETUP
1. Go to the **Settings & Exports** tab inside QiFinance.
2. Copy the computed **Supabase/PostgreSQL Migration Script** block.
3. Open your **Supabase Dashboard** -> **SQL Editor** -> **New Query**.
4. Paste the Copied SQL script and click **Run**. This establishes your relational tables, accounts, categories, and foreign-key integrity constraints instantly!

### Phase B: Cloudflare Pages Hosting
1. Setup a Cloudflare Pages project linked to your GitHub repository.
2. Configure build commands:
   - Build Command: `npm run build`
   - Build Output Directory: `dist`
3. Hit Deploy. Cloudflare global CDN distributes static file directories with ultra-low latency.

### Phase C: Cloudflare Zero Trust Protection
1. Open your **Cloudflare Dashboard** -> **Zero Trust**.
2. Go to **Access** -> **Applications** -> **Add an Application** -> **Self-Hosted**.
3. Point to your designated Cloudflare Pages subdomain URL.
4. Setup policies granting entry ONLY to your verified emails via OTP passcode verification checks.

---

## 🗄️ Database Backup, Restore, & Transfers
QiFinance supports client-side LocalStorage database backups in settings. You can download the complete ledger tables as a single portable `.json` backup file or import existing databases back into any client instance immediately.
