-- QiFi / QiFinance Supabase schema
-- Idempotent repair + bootstrap script for the Cloudflare Worker API.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Core finance dimensions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.finance_accounts (
    id VARCHAR(100) PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'expense', 'clearing', 'suspense')),
    detail_type VARCHAR(100),
    description TEXT,
    account_number VARCHAR(100),
    routing_number VARCHAR(100),
    institution VARCHAR(255),
    parent_account_id VARCHAR(100) REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.finance_categories (
    id VARCHAR(100) PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.finance_transaction_rules (
    id VARCHAR(100) PRIMARY KEY,
    pattern VARCHAR(255) NOT NULL,
    suggested_account_id VARCHAR(100) REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
    suggested_tags TEXT[] DEFAULT '{}',
    suggested_counterparty VARCHAR(255),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Import pipeline
-- Existing projects may already have an older ingestion schema, so these ALTER
-- statements add the QiFi Worker columns without dropping old empty columns.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.finance_import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name VARCHAR(255),
    raw_count INTEGER DEFAULT 0,
    source_account_id VARCHAR(100) REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
    source_name VARCHAR(255),
    source_institution VARCHAR(255),
    source_account_label VARCHAR(255),
    source_account_last4 VARCHAR(10),
    status VARCHAR(50) DEFAULT 'staged',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.finance_import_batches
    ADD COLUMN IF NOT EXISTS file_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS raw_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS source_account_id VARCHAR(100) REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS source_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS source_institution VARCHAR(255),
    ADD COLUMN IF NOT EXISTS source_account_label VARCHAR(255),
    ADD COLUMN IF NOT EXISTS source_account_last4 VARCHAR(10),
    ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'staged',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS original_filename TEXT,
    ADD COLUMN IF NOT EXISTS row_count INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS imported_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.finance_import_batches
SET
    file_name = COALESCE(file_name, original_filename, 'import.csv'),
    raw_count = COALESCE(raw_count, row_count, 0),
    created_at = COALESCE(created_at, imported_at, NOW())
WHERE file_name IS NULL OR created_at IS NULL;

CREATE TABLE IF NOT EXISTS public.finance_import_raw_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_batch_id UUID REFERENCES public.finance_import_batches(id) ON DELETE CASCADE,
    date DATE,
    description TEXT,
    amount NUMERIC(15, 2),
    status VARCHAR(50) DEFAULT 'pending',
    suggested_account_id VARCHAR(100) REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
    suggested_tags TEXT[] DEFAULT '{}',
    suggested_counterparty VARCHAR(255),
    memo TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.finance_import_raw_rows
    ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES public.finance_import_batches(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS date DATE,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS amount NUMERIC(15, 2),
    ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS suggested_account_id VARCHAR(100) REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS suggested_tags TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS suggested_counterparty VARCHAR(255),
    ADD COLUMN IF NOT EXISTS memo TEXT,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.finance_import_batches(id) ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS row_number INTEGER,
    ADD COLUMN IF NOT EXISTS raw_data JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS raw_hash TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS normalized_status TEXT DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE public.finance_import_raw_rows
    ALTER COLUMN raw_data SET DEFAULT '{}'::jsonb,
    ALTER COLUMN raw_hash SET DEFAULT '';

ALTER TABLE public.finance_import_raw_rows
    ALTER COLUMN raw_data DROP NOT NULL,
    ALTER COLUMN raw_hash DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- Master transactions + ledger
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.finance_master_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE,
    description TEXT,
    raw_description TEXT,
    amount NUMERIC(15, 2) NOT NULL,
    source_account_id VARCHAR(100) REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
    tags TEXT[] DEFAULT '{}',
    counterparty VARCHAR(255),
    reconciliation_id VARCHAR(100),
    import_batch_id UUID REFERENCES public.finance_import_batches(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    source_name VARCHAR(255),
    source_institution VARCHAR(255),
    source_account_label VARCHAR(255),
    source_account_last4 VARCHAR(10),
    import_status VARCHAR(50) DEFAULT 'imported',
    classification_status VARCHAR(50) DEFAULT 'unclassified',
    ledger_status VARCHAR(50) DEFAULT 'not_posted',
    source_metadata JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.finance_master_transactions
    ADD COLUMN IF NOT EXISTS date DATE,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS raw_description TEXT,
    ADD COLUMN IF NOT EXISTS source_account_id VARCHAR(100) REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS counterparty VARCHAR(255),
    ADD COLUMN IF NOT EXISTS reconciliation_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS import_batch_id UUID REFERENCES public.finance_import_batches(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS source_metadata JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS transaction_date DATE,
    ADD COLUMN IF NOT EXISTS posted_date DATE,
    ADD COLUMN IF NOT EXISTS authorized_date DATE,
    ADD COLUMN IF NOT EXISTS description_raw TEXT,
    ADD COLUMN IF NOT EXISTS description_clean TEXT,
    ADD COLUMN IF NOT EXISTS merchant_name TEXT,
    ADD COLUMN IF NOT EXISTS memo TEXT,
    ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
    ADD COLUMN IF NOT EXISTS direction TEXT,
    ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.finance_import_batches(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS raw_row_id UUID REFERENCES public.finance_import_raw_rows(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS import_hash TEXT,
    ADD COLUMN IF NOT EXISTS confidence_score NUMERIC,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.finance_master_transactions
SET
    date = COALESCE(date, transaction_date, posted_date, authorized_date),
    description = COALESCE(description, description_clean, merchant_name, description_raw, memo),
    raw_description = COALESCE(raw_description, description_raw, description_clean, merchant_name, memo),
    counterparty = COALESCE(counterparty, merchant_name),
    import_batch_id = COALESCE(import_batch_id, batch_id)
WHERE date IS NULL
   OR description IS NULL
   OR raw_description IS NULL
   OR counterparty IS NULL
   OR import_batch_id IS NULL;

CREATE TABLE IF NOT EXISTS public.finance_ledger_entries (
    id VARCHAR(140) PRIMARY KEY,
    transaction_id UUID REFERENCES public.finance_master_transactions(id) ON DELETE CASCADE,
    account_id VARCHAR(100) REFERENCES public.finance_accounts(id) ON DELETE CASCADE,
    debit NUMERIC(15, 2) DEFAULT 0.00,
    credit NUMERIC(15, 2) DEFAULT 0.00,
    date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_ledger_entries_transaction_id
    ON public.finance_ledger_entries(transaction_id);

CREATE INDEX IF NOT EXISTS idx_finance_ledger_entries_account_date
    ON public.finance_ledger_entries(account_id, date DESC);

-- ---------------------------------------------------------------------------
-- App persistence domains used by the current UI
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.finance_attachments (
    id VARCHAR(140) PRIMARY KEY,
    transaction_id VARCHAR(140),
    statement_id VARCHAR(140),
    account_id VARCHAR(100),
    counterparty_id VARCHAR(140),
    obligation_id VARCHAR(140),
    schedule_id VARCHAR(140),
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    data_url TEXT NOT NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_finance_attachments_transaction_id
    ON public.finance_attachments(transaction_id);

CREATE INDEX IF NOT EXISTS idx_finance_attachments_statement_id
    ON public.finance_attachments(statement_id);

CREATE TABLE IF NOT EXISTS public.finance_statements (
    id VARCHAR(140) PRIMARY KEY,
    account_id VARCHAR(100) REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    opening_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
    closing_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
    is_reconciled BOOLEAN NOT NULL DEFAULT FALSE,
    reconciled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.finance_recurring_schedules (
    id VARCHAR(140) PRIMARY KEY,
    name TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    account_id VARCHAR(100) REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
    source_account_id VARCHAR(100) REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
    next_due_date DATE NOT NULL,
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_recurring_schedules_next_due_date
    ON public.finance_recurring_schedules(next_due_date);

CREATE INDEX IF NOT EXISTS idx_finance_recurring_schedules_source_account_id
    ON public.finance_recurring_schedules(source_account_id);

CREATE TABLE IF NOT EXISTS public.finance_counterparties (
    id VARCHAR(140) PRIMARY KEY,
    workspace_id VARCHAR(140) NOT NULL DEFAULT 'default',
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    tags TEXT[] DEFAULT '{}',
    is_business BOOLEAN NOT NULL DEFAULT TRUE,
    relationship_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.finance_obligations (
    id VARCHAR(140) PRIMARY KEY,
    workspace_id VARCHAR(140) NOT NULL DEFAULT 'default',
    counterparty_id VARCHAR(140) REFERENCES public.finance_counterparties(id) ON DELETE SET NULL,
    amount NUMERIC(15, 2) NOT NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    transaction_id VARCHAR(140),
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_obligations_counterparty_id
    ON public.finance_obligations(counterparty_id);

CREATE INDEX IF NOT EXISTS idx_finance_obligations_status
    ON public.finance_obligations(status);

CREATE INDEX IF NOT EXISTS idx_finance_import_raw_rows_import_batch_id
    ON public.finance_import_raw_rows(import_batch_id);

CREATE INDEX IF NOT EXISTS idx_finance_master_transactions_date
    ON public.finance_master_transactions(date DESC);

CREATE INDEX IF NOT EXISTS idx_finance_master_transactions_source_account_id
    ON public.finance_master_transactions(source_account_id);

CREATE INDEX IF NOT EXISTS idx_finance_master_transactions_import_batch_id
    ON public.finance_master_transactions(import_batch_id);

-- ---------------------------------------------------------------------------
-- Seed default data
-- ---------------------------------------------------------------------------

INSERT INTO public.finance_accounts (id, code, name, type, description) VALUES
('assets-checking', '1010', 'Business Checking', 'asset', 'Primary business checking account'),
('assets-savings', '1020', 'Tax Savings', 'asset', 'Reserve for quarterly estimated taxes'),
('assets-loans-mom', '1210', 'Loan to Mom', 'asset', 'Loaned funds to Mom (Receivable)'),
('liabilities-chasecc', '2010', 'Chase Sapphire CC', 'liability', 'Business credit card'),
('equity-capital', '3010', 'Owner Capital', 'equity', 'Initial personal equity contributions'),
('revenue-consulting', '4010', 'Consulting Revenue', 'revenue', 'Sole proprietor consulting services'),
('expenses-rent', '5010', 'Rent & Office Space', 'expense', 'Office lease or shared space rent'),
('expenses-software', '5020', 'Software & SaaS', 'expense', 'Software subscriptions and cloud infrastructure'),
('expenses-supplies', '5030', 'Office Supplies', 'expense', 'Stationery, devices, and physical items'),
('expenses-gifts', '5040', 'Gifts & Caregiving', 'expense', 'Financial help or gifts to family/mom'),
('expenses-travel', '5050', 'Travel & Lodging', 'expense', 'Uber, flights, hotels for business'),
('expenses-groceries', '5060', 'Groceries (Personal)', 'expense', 'Food and daily home provisions'),
('expenses-dining', '5070', 'Meals & Dining Out', 'expense', 'Business dinners or personal dining'),
('clearing-cc-payment', '8010', 'Credit Card Cleared Payments', 'clearing', 'Temporary clearing for card pay-offs'),
('suspense-uncategorized', '9999', 'Uncategorized Suspense', 'suspense', 'Unreviewed default category')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.finance_transaction_rules (id, pattern, suggested_account_id, suggested_tags, suggested_counterparty, description) VALUES
('rule-google', 'google', 'expenses-software', '{"business", "software"}', 'Google Cloud', 'Google server and workspace fees'),
('rule-github', 'github', 'expenses-software', '{"business", "software", "dev"}', 'GitHub', 'GitHub co-pilot and repository fees'),
('rule-rent', 'landlord', 'expenses-rent', '{"home", "office"}', 'Main Street Apartments', 'Monthly lease rent'),
('rule-mom-gift', 'mom transfer', 'expenses-gifts', '{"family", "mom", "caregiving"}', 'Mom', 'Caregiving and support'),
('rule-uber', 'uber', 'expenses-travel', '{"travel", "business"}', 'Uber Inc', 'Local transport rides'),
('rule-wholefoods', 'whole foods', 'expenses-groceries', '{"personal", "food"}', 'Whole Foods Market', 'Grocery shopping'),
('rule-figma', 'figma', 'expenses-software', '{"business", "design"}', 'Figma Inc', 'Design tool SaaS')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Security and PostgREST exposure for Worker service-role access
-- ---------------------------------------------------------------------------

ALTER TABLE public.finance_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_import_raw_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_master_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_transaction_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_recurring_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_counterparties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_obligations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
    public.finance_accounts,
    public.finance_categories,
    public.finance_import_batches,
    public.finance_import_raw_rows,
    public.finance_master_transactions,
    public.finance_transaction_rules,
    public.finance_ledger_entries,
    public.finance_attachments,
    public.finance_statements,
    public.finance_recurring_schedules,
    public.finance_counterparties,
    public.finance_obligations
FROM anon, authenticated;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON TABLE
    public.finance_accounts,
    public.finance_categories,
    public.finance_import_batches,
    public.finance_import_raw_rows,
    public.finance_master_transactions,
    public.finance_transaction_rules,
    public.finance_ledger_entries,
    public.finance_attachments,
    public.finance_statements,
    public.finance_recurring_schedules,
    public.finance_counterparties,
    public.finance_obligations
TO service_role;

-- Safe schema migration columns
ALTER TABLE public.finance_accounts
    ADD COLUMN IF NOT EXISTS account_number VARCHAR(100),
    ADD COLUMN IF NOT EXISTS routing_number VARCHAR(100),
    ADD COLUMN IF NOT EXISTS institution VARCHAR(255),
    ADD COLUMN IF NOT EXISTS parent_account_id VARCHAR(100) REFERENCES public.finance_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.finance_attachments
    ADD COLUMN IF NOT EXISTS account_id VARCHAR(100) REFERENCES public.finance_accounts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS counterparty_id VARCHAR(140) REFERENCES public.finance_counterparties(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS obligation_id VARCHAR(140) REFERENCES public.finance_obligations(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS schedule_id VARCHAR(140) REFERENCES public.finance_recurring_schedules(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
