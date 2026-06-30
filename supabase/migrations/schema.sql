-- SQL Migration Script for Supabase / Postgres Database
-- Set up schema for QiFinance application tables

-- 1. Accounts Table (Chart of Accounts)
CREATE TABLE IF NOT EXISTS finance_accounts (
    id VARCHAR(100) PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- asset, liability, equity, revenue, expense, clearing, suspense
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Categories Table (Sub-categories or groupings if needed)
CREATE TABLE IF NOT EXISTS finance_categories (
    id VARCHAR(100) PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Import Batches Table
CREATE TABLE IF NOT EXISTS finance_import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name VARCHAR(255) NOT NULL,
    raw_count INTEGER NOT NULL DEFAULT 0,
    source_account_id VARCHAR(100) REFERENCES finance_accounts(id) ON DELETE SET NULL,
    source_name VARCHAR(255),
    source_institution VARCHAR(255),
    source_account_label VARCHAR(255),
    source_account_last4 VARCHAR(10),
    status VARCHAR(50) DEFAULT 'staged', -- staged, committed, ignored
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Import Raw Rows Table (Staging Area)
CREATE TABLE IF NOT EXISTS finance_import_raw_rows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_batch_id UUID REFERENCES finance_import_batches(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL, -- positive = inflow, negative = outflow
    status VARCHAR(50) DEFAULT 'pending', -- pending, processed, ignored
    suggested_account_id VARCHAR(100),
    suggested_tags TEXT[],
    suggested_counterparty VARCHAR(255),
    memo TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Master Transactions Table
CREATE TABLE IF NOT EXISTS finance_master_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    description TEXT NOT NULL,
    raw_description TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    source_account_id VARCHAR(100) REFERENCES finance_accounts(id) ON DELETE SET NULL,
    tags TEXT[] DEFAULT '{}',
    counterparty VARCHAR(255),
    reconciliation_id VARCHAR(100),
    import_batch_id UUID REFERENCES finance_import_batches(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    source_name VARCHAR(255),
    source_institution VARCHAR(255),
    source_account_label VARCHAR(255),
    source_account_last4 VARCHAR(10),
    import_status VARCHAR(50) DEFAULT 'imported', -- imported, manual
    classification_status VARCHAR(50) DEFAULT 'unclassified', -- unclassified, classified
    ledger_status VARCHAR(50) DEFAULT 'not_posted', -- not_posted, posted
    source_metadata JSONB DEFAULT '{}'
);

-- 6. Transaction Rules Table
CREATE TABLE IF NOT EXISTS finance_transaction_rules (
    id VARCHAR(100) PRIMARY KEY,
    pattern VARCHAR(255) NOT NULL,
    suggested_account_id VARCHAR(100) REFERENCES finance_accounts(id) ON DELETE CASCADE,
    suggested_tags TEXT[] DEFAULT '{}',
    suggested_counterparty VARCHAR(255),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Ledger Entries / Lines Table (Double entry items)
CREATE TABLE IF NOT EXISTS finance_ledger_entries (
    id VARCHAR(100) PRIMARY KEY,
    transaction_id UUID REFERENCES finance_master_transactions(id) ON DELETE CASCADE,
    account_id VARCHAR(100) REFERENCES finance_accounts(id) ON DELETE CASCADE,
    debit NUMERIC(15, 2) DEFAULT 0.00,
    credit NUMERIC(15, 2) DEFAULT 0.00,
    date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed Default Chart of Accounts
INSERT INTO finance_accounts (id, code, name, type, description) VALUES
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

-- Seed Default Rules
INSERT INTO finance_transaction_rules (id, pattern, suggested_account_id, suggested_tags, suggested_counterparty, description) VALUES
('rule-google', 'google', 'expenses-software', '{"business", "software"}', 'Google Cloud', 'Google server and workspace fees'),
('rule-github', 'github', 'expenses-software', '{"business", "software", "dev"}', 'GitHub', 'GitHub co-pilot and repository fees'),
('rule-rent', 'landlord', 'expenses-rent', '{"home", "office"}', 'Main Street Apartments', 'Monthly lease rent'),
('rule-mom-gift', 'mom transfer', 'expenses-gifts', '{"family", "mom", "caregiving"}', 'Mom', 'Caregiving and support'),
('rule-uber', 'uber', 'expenses-travel', '{"travel", "business"}', 'Uber Inc', 'Local transport rides'),
('rule-wholefoods', 'whole foods', 'expenses-groceries', '{"personal", "food"}', 'Whole Foods Market', 'Grocery shopping'),
('rule-figma', 'figma', 'expenses-software', '{"business", "design"}', 'Figma Inc', 'Design tool SaaS')
ON CONFLICT (id) DO NOTHING;
