-- QiFi clean financial core reset.
-- Archive dirty seed data before applying this reset:
--   public.qifi_dirty_seed_archives.archive_name = '2026-07-05_qifi_dirty_seed_archive.json'

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Dirty legacy tables are no longer the live financial core.
-- The archive table is intentionally preserved.
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS public.finance_ledger_entries CASCADE;
DROP TABLE IF EXISTS public.finance_master_transactions CASCADE;
DROP TABLE IF EXISTS public.finance_import_raw_rows CASCADE;
DROP TABLE IF EXISTS public.finance_import_batches CASCADE;
DROP TABLE IF EXISTS public.finance_transaction_rules CASCADE;
DROP TABLE IF EXISTS public.finance_categories CASCADE;
DROP TABLE IF EXISTS public.finance_statements CASCADE;
DROP TABLE IF EXISTS public.finance_recurring_schedules CASCADE;
DROP TABLE IF EXISTS public.finance_attachments CASCADE;
DROP TABLE IF EXISTS public.finance_obligations CASCADE;
DROP TABLE IF EXISTS public.finance_counterparties CASCADE;
DROP TABLE IF EXISTS public.finance_accounts CASCADE;

-- ---------------------------------------------------------------------------
-- Ownership boundary
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.workspaces (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Clean accounting dimensions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ledger_accounts (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'equity', 'revenue', 'expense', 'clearing', 'suspense')),
    normal_balance TEXT NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
    parent_ledger_account_id TEXT REFERENCES public.ledger_accounts(id) ON DELETE SET NULL,
    description TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, code),
    UNIQUE (workspace_id, name),
    CONSTRAINT ledger_payable_not_asset CHECK (
      NOT (type = 'asset' AND name ~* '(payable|current liabilities)')
    ),
    CONSTRAINT ledger_no_tax_form_names CHECK (
      name !~* '(schedule\\s*c|1040|form\\s+1040|tax\\s+line|line\\s+[0-9]+)'
    )
);

CREATE TABLE IF NOT EXISTS public.financial_accounts (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    institution TEXT,
    account_mask TEXT,
    account_kind TEXT NOT NULL CHECK (account_kind IN ('cash', 'checking', 'savings', 'credit_card', 'loan', 'wallet', 'platform', 'other')),
    source_provider TEXT,
    current_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD',
    default_ledger_account_id TEXT REFERENCES public.ledger_accounts(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, name)
);

CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    default_ledger_account_id TEXT REFERENCES public.ledger_accounts(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, name)
);

CREATE TABLE IF NOT EXISTS public.tax_mappings (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    category_id TEXT REFERENCES public.categories(id) ON DELETE CASCADE,
    ledger_account_id TEXT REFERENCES public.ledger_accounts(id) ON DELETE CASCADE,
    tax_form TEXT NOT NULL,
    tax_line TEXT NOT NULL,
    label TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT tax_mapping_has_target CHECK (category_id IS NOT NULL OR ledger_account_id IS NOT NULL)
);

-- ---------------------------------------------------------------------------
-- Import and transaction pipeline
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.import_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    financial_account_id TEXT REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    row_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'staged' CHECK (status IN ('staged', 'reviewing', 'committed', 'failed')),
    column_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.import_rows_raw (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    import_batch_id UUID NOT NULL REFERENCES public.import_batches(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    raw_hash TEXT NOT NULL DEFAULT '',
    normalized_status TEXT NOT NULL DEFAULT 'pending' CHECK (normalized_status IN ('pending', 'processed', 'ignored', 'error')),
    suggested_category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
    suggested_ledger_account_id TEXT REFERENCES public.ledger_accounts(id) ON DELETE SET NULL,
    suggested_counterparty TEXT,
    memo TEXT NOT NULL DEFAULT '',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    financial_account_id TEXT REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
    import_batch_id UUID REFERENCES public.import_batches(id) ON DELETE SET NULL,
    raw_row_id UUID REFERENCES public.import_rows_raw(id) ON DELETE SET NULL,
    transaction_date DATE NOT NULL,
    posted_date DATE,
    description_raw TEXT NOT NULL DEFAULT '',
    description_clean TEXT NOT NULL,
    counterparty TEXT NOT NULL DEFAULT '',
    amount NUMERIC(15, 2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
    classification_status TEXT NOT NULL DEFAULT 'unclassified' CHECK (classification_status IN ('unclassified', 'suggested', 'classified', 'needs_review')),
    journal_status TEXT NOT NULL DEFAULT 'not_posted' CHECK (journal_status IN ('not_posted', 'draft', 'posted')),
    tags TEXT[] NOT NULL DEFAULT '{}',
    source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
    entry_date DATE NOT NULL,
    description TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted', 'void')),
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'import', 'assistant', 'system')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    posted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.journal_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
    ledger_account_id TEXT NOT NULL REFERENCES public.ledger_accounts(id) ON DELETE RESTRICT,
    debit NUMERIC(15, 2) NOT NULL DEFAULT 0,
    credit NUMERIC(15, 2) NOT NULL DEFAULT 0,
    memo TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT journal_line_one_side CHECK (
      debit >= 0 AND credit >= 0 AND debit <> credit
    )
);

CREATE TABLE IF NOT EXISTS public.classification_rules (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    pattern TEXT NOT NULL,
    match_field TEXT NOT NULL DEFAULT 'description' CHECK (match_field IN ('description', 'counterparty', 'raw_data')),
    suggested_category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
    suggested_ledger_account_id TEXT REFERENCES public.ledger_accounts(id) ON DELETE SET NULL,
    suggested_tags TEXT[] NOT NULL DEFAULT '{}',
    suggested_counterparty TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT classification_rule_has_target CHECK (
      suggested_category_id IS NOT NULL OR suggested_ledger_account_id IS NOT NULL
    )
);

-- ---------------------------------------------------------------------------
-- Lean app-support tables retained outside the core accounting boundary.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.counterparties (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    tags TEXT[] NOT NULL DEFAULT '{}',
    is_business BOOLEAN NOT NULL DEFAULT TRUE,
    relationship_type TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, name)
);

CREATE TABLE IF NOT EXISTS public.obligations (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    counterparty_id TEXT REFERENCES public.counterparties(id) ON DELETE SET NULL,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    amount NUMERIC(15, 2) NOT NULL,
    type TEXT NOT NULL,
    description TEXT NOT NULL,
    due_date DATE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'disputed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.attachments (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    financial_account_id TEXT REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
    statement_id TEXT,
    counterparty_id TEXT REFERENCES public.counterparties(id) ON DELETE SET NULL,
    obligation_id TEXT REFERENCES public.obligations(id) ON DELETE SET NULL,
    schedule_id TEXT,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    data_url TEXT,
    bucket_name TEXT,
    object_path TEXT,
    file_size BIGINT,
    raw_ocr_text TEXT,
    parsed_ocr_json JSONB,
    processing_status TEXT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS public.statements (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    financial_account_id TEXT REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    opening_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
    closing_balance NUMERIC(15, 2) NOT NULL DEFAULT 0,
    is_reconciled BOOLEAN NOT NULL DEFAULT FALSE,
    reconciled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS reconciliation_id TEXT;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_reconciliation_id_fkey;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_reconciliation_id_fkey
  FOREIGN KEY (reconciliation_id) REFERENCES public.statements(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.recurring_transactions (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    financial_account_id TEXT REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
    category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
    ledger_account_id TEXT REFERENCES public.ledger_accounts(id) ON DELETE SET NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
    next_due_date DATE NOT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Guardrails
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.qifi_assert_classification_rule_targets_active()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.suggested_category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.categories
    WHERE id = NEW.suggested_category_id AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'classification rule cannot target inactive or missing category %', NEW.suggested_category_id;
  END IF;

  IF NEW.suggested_ledger_account_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.ledger_accounts
    WHERE id = NEW.suggested_ledger_account_id AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'classification rule cannot target inactive or missing ledger account %', NEW.suggested_ledger_account_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.qifi_assert_posted_journal_balances()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  debit_total NUMERIC(15, 2);
  credit_total NUMERIC(15, 2);
  line_count INTEGER;
BEGIN
  IF NEW.status <> 'posted' THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0),
    COUNT(*)
  INTO debit_total, credit_total, line_count
  FROM public.journal_lines
  WHERE journal_entry_id = NEW.id;

  IF line_count < 2 OR debit_total <> credit_total THEN
    RAISE EXCEPTION 'posted journal entry % must balance; debit %, credit %, lines %',
      NEW.id, debit_total, credit_total, line_count;
  END IF;

  NEW.posted_at = COALESCE(NEW.posted_at, NOW());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.qifi_prevent_posted_journal_line_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  parent_status TEXT;
BEGIN
  SELECT status INTO parent_status
  FROM public.journal_entries
  WHERE id = COALESCE(NEW.journal_entry_id, OLD.journal_entry_id);

  IF parent_status = 'posted' THEN
    RAISE EXCEPTION 'posted journal entry lines cannot be modified';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_classification_rules_active_targets ON public.classification_rules;
CREATE TRIGGER trg_classification_rules_active_targets
BEFORE INSERT OR UPDATE ON public.classification_rules
FOR EACH ROW EXECUTE FUNCTION public.qifi_assert_classification_rule_targets_active();

DROP TRIGGER IF EXISTS trg_posted_journal_balances ON public.journal_entries;
CREATE TRIGGER trg_posted_journal_balances
BEFORE INSERT OR UPDATE OF status ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION public.qifi_assert_posted_journal_balances();

DROP TRIGGER IF EXISTS trg_posted_journal_line_mutation ON public.journal_lines;
CREATE TRIGGER trg_posted_journal_line_mutation
BEFORE UPDATE OR DELETE ON public.journal_lines
FOR EACH ROW EXECUTE FUNCTION public.qifi_prevent_posted_journal_line_mutation();

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_financial_accounts_workspace ON public.financial_accounts(workspace_id, is_active);
CREATE INDEX IF NOT EXISTS idx_ledger_accounts_workspace_code ON public.ledger_accounts(workspace_id, code);
CREATE INDEX IF NOT EXISTS idx_categories_workspace ON public.categories(workspace_id, is_active);
CREATE INDEX IF NOT EXISTS idx_import_rows_raw_batch ON public.import_rows_raw(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_financial_account ON public.transactions(financial_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_reconciliation ON public.transactions(reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_transaction ON public.journal_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON public.journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_ledger_account ON public.journal_lines(ledger_account_id);
CREATE INDEX IF NOT EXISTS idx_classification_rules_workspace ON public.classification_rules(workspace_id, is_active);
CREATE INDEX IF NOT EXISTS idx_attachments_transaction ON public.attachments(transaction_id);

-- ---------------------------------------------------------------------------
-- Clean seed
-- ---------------------------------------------------------------------------

INSERT INTO public.organizations (id, name) VALUES
  ('org-default', 'QiFi')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW();

INSERT INTO public.workspaces (id, organization_id, name, currency) VALUES
  ('default', 'org-default', 'QiFi Workspace', 'USD')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, currency = EXCLUDED.currency, updated_at = NOW();

INSERT INTO public.ledger_accounts (id, workspace_id, code, name, type, normal_balance, parent_ledger_account_id, description) VALUES
  ('ledger-assets', 'default', '1000', 'Assets', 'asset', 'debit', NULL, 'Asset accounts'),
  ('ledger-cash-on-hand', 'default', '1010', 'Cash on Hand', 'asset', 'debit', 'ledger-assets', 'Physical cash'),
  ('ledger-bank-accounts', 'default', '1020', 'Bank Accounts', 'asset', 'debit', 'ledger-assets', 'Checking and savings bank balances'),
  ('ledger-undeposited-funds', 'default', '1030', 'Undeposited Funds', 'asset', 'debit', 'ledger-assets', 'Funds received but not deposited'),
  ('ledger-accounts-receivable', 'default', '1100', 'Accounts Receivable', 'asset', 'debit', 'ledger-assets', 'Customer receivables'),
  ('ledger-prepaid-expenses', 'default', '1200', 'Prepaid Expenses', 'asset', 'debit', 'ledger-assets', 'Prepaid expense assets'),
  ('ledger-fixed-assets', 'default', '1500', 'Fixed Assets', 'asset', 'debit', 'ledger-assets', 'Long-lived business assets'),
  ('ledger-accumulated-depreciation', 'default', '1590', 'Accumulated Depreciation', 'asset', 'credit', 'ledger-fixed-assets', 'Contra-asset depreciation'),
  ('ledger-liabilities', 'default', '2000', 'Liabilities', 'liability', 'credit', NULL, 'Liability accounts'),
  ('ledger-accounts-payable', 'default', '2010', 'Accounts Payable', 'liability', 'credit', 'ledger-liabilities', 'Vendor payables'),
  ('ledger-credit-cards-payable', 'default', '2020', 'Credit Cards Payable', 'liability', 'credit', 'ledger-liabilities', 'Credit card balances'),
  ('ledger-sales-tax-payable', 'default', '2030', 'Sales Tax Payable', 'liability', 'credit', 'ledger-liabilities', 'Sales tax obligations'),
  ('ledger-payroll-tax-payable', 'default', '2040', 'Payroll Tax Payable', 'liability', 'credit', 'ledger-liabilities', 'Payroll tax obligations'),
  ('ledger-loans-payable', 'default', '2100', 'Loans Payable', 'liability', 'credit', 'ledger-liabilities', 'Loan balances'),
  ('ledger-accrued-liabilities', 'default', '2200', 'Accrued Liabilities', 'liability', 'credit', 'ledger-liabilities', 'Accrued obligations'),
  ('ledger-equity', 'default', '3000', 'Equity', 'equity', 'credit', NULL, 'Owner equity'),
  ('ledger-owner-contributions', 'default', '3010', 'Owner Contributions', 'equity', 'credit', 'ledger-equity', 'Owner contributions'),
  ('ledger-owner-draws', 'default', '3020', 'Owner Draws', 'equity', 'debit', 'ledger-equity', 'Owner draws'),
  ('ledger-opening-balance-equity', 'default', '3090', 'Opening Balance Equity', 'equity', 'credit', 'ledger-equity', 'Opening balance offset'),
  ('ledger-income', 'default', '4000', 'Income', 'revenue', 'credit', NULL, 'Income accounts'),
  ('ledger-service-income', 'default', '4010', 'Service Income', 'revenue', 'credit', 'ledger-income', 'Service revenue'),
  ('ledger-platform-gig-income', 'default', '4020', 'Platform/Gig Income', 'revenue', 'credit', 'ledger-income', 'Platform and gig income'),
  ('ledger-reimbursements', 'default', '4030', 'Reimbursements', 'revenue', 'credit', 'ledger-income', 'Reimbursed expenses'),
  ('ledger-other-income', 'default', '4090', 'Other Income', 'revenue', 'credit', 'ledger-income', 'Other income'),
  ('ledger-expenses', 'default', '5000', 'Expenses', 'expense', 'debit', NULL, 'Expense accounts'),
  ('ledger-advertising-marketing', 'default', '5010', 'Advertising & Marketing', 'expense', 'debit', 'ledger-expenses', 'Promotion and ads'),
  ('ledger-auto-vehicle', 'default', '5020', 'Auto & Vehicle', 'expense', 'debit', 'ledger-expenses', 'Vehicle expenses'),
  ('ledger-fuel', 'default', '5021', 'Fuel', 'expense', 'debit', 'ledger-auto-vehicle', 'Fuel expenses'),
  ('ledger-repairs-maintenance', 'default', '5022', 'Repairs & Maintenance', 'expense', 'debit', 'ledger-auto-vehicle', 'Repairs and maintenance'),
  ('ledger-insurance', 'default', '5023', 'Insurance', 'expense', 'debit', 'ledger-auto-vehicle', 'Insurance expense'),
  ('ledger-parking-tolls', 'default', '5024', 'Parking & Tolls', 'expense', 'debit', 'ledger-auto-vehicle', 'Parking and tolls'),
  ('ledger-meals', 'default', '5030', 'Meals', 'expense', 'debit', 'ledger-expenses', 'Meal expenses'),
  ('ledger-phone-internet', 'default', '5040', 'Phone & Internet', 'expense', 'debit', 'ledger-expenses', 'Phone and internet'),
  ('ledger-software-subscriptions', 'default', '5050', 'Software & Subscriptions', 'expense', 'debit', 'ledger-expenses', 'Software and subscriptions'),
  ('ledger-office-supplies', 'default', '5060', 'Office Supplies', 'expense', 'debit', 'ledger-expenses', 'Office supplies'),
  ('ledger-rent-lodging', 'default', '5070', 'Rent / Lodging', 'expense', 'debit', 'ledger-expenses', 'Rent and lodging'),
  ('ledger-professional-fees', 'default', '5080', 'Professional Fees', 'expense', 'debit', 'ledger-expenses', 'Legal, admin, and professional fees'),
  ('ledger-bank-fees', 'default', '5090', 'Bank Fees', 'expense', 'debit', 'ledger-expenses', 'Bank and processing fees'),
  ('ledger-taxes-licenses', 'default', '5100', 'Taxes & Licenses', 'expense', 'debit', 'ledger-expenses', 'Business taxes and licenses'),
  ('ledger-uncategorized-expense', 'default', '5990', 'Uncategorized Expense', 'expense', 'debit', 'ledger-expenses', 'Expenses needing review'),
  ('ledger-clearing', 'default', '9000', 'Clearing', 'clearing', 'debit', NULL, 'Clearing accounts'),
  ('ledger-import-suspense', 'default', '9010', 'Import Suspense', 'suspense', 'debit', 'ledger-clearing', 'Unknown import classifications'),
  ('ledger-transfer-clearing', 'default', '9020', 'Transfer Clearing', 'clearing', 'debit', 'ledger-clearing', 'Transfers between financial accounts'),
  ('ledger-personal-review-needed', 'default', '9030', 'Personal Review Needed', 'suspense', 'debit', 'ledger-clearing', 'Personal or ambiguous transactions')
ON CONFLICT (id) DO UPDATE SET
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  normal_balance = EXCLUDED.normal_balance,
  parent_ledger_account_id = EXCLUDED.parent_ledger_account_id,
  description = EXCLUDED.description,
  is_active = TRUE,
  updated_at = NOW();

INSERT INTO public.financial_accounts (id, workspace_id, name, institution, account_mask, account_kind, source_provider, current_balance, currency, default_ledger_account_id) VALUES
  ('fa-square-checking', 'default', 'Square Checking', 'Square', NULL, 'checking', 'manual', 0, 'USD', 'ledger-bank-accounts'),
  ('fa-cash-app', 'default', 'Cash App', 'Cash App', NULL, 'wallet', 'manual', 0, 'USD', 'ledger-bank-accounts'),
  ('fa-cash-on-hand', 'default', 'Cash on Hand', NULL, NULL, 'cash', 'manual', 0, 'USD', 'ledger-cash-on-hand'),
  ('fa-chase-credit-card', 'default', 'Chase Credit Card', 'JPMorgan Chase', NULL, 'credit_card', 'manual', 0, 'USD', 'ledger-credit-cards-payable'),
  ('fa-mission-lane-card', 'default', 'Mission Lane Card', 'Mission Lane', NULL, 'credit_card', 'manual', 0, 'USD', 'ledger-credit-cards-payable'),
  ('fa-bridgecrest-loan', 'default', 'Bridgecrest Loan', 'Bridgecrest', NULL, 'loan', 'manual', 0, 'USD', 'ledger-loans-payable')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  institution = EXCLUDED.institution,
  account_kind = EXCLUDED.account_kind,
  default_ledger_account_id = EXCLUDED.default_ledger_account_id,
  updated_at = NOW();

INSERT INTO public.categories (id, workspace_id, name, description, default_ledger_account_id) VALUES
  ('cat-gas', 'default', 'Gas', 'Vehicle fuel', 'ledger-fuel'),
  ('cat-hotel', 'default', 'Hotel', 'Travel lodging', 'ledger-rent-lodging'),
  ('cat-food', 'default', 'Food', 'Meals and food', 'ledger-meals'),
  ('cat-lyft-rental', 'default', 'Lyft Rental', 'Rideshare vehicle rental', 'ledger-auto-vehicle'),
  ('cat-phone', 'default', 'Phone', 'Phone service', 'ledger-phone-internet'),
  ('cat-software', 'default', 'Software', 'Software and subscriptions', 'ledger-software-subscriptions'),
  ('cat-legal-admin', 'default', 'Legal/Admin', 'Professional and admin fees', 'ledger-professional-fees'),
  ('cat-personal-draw', 'default', 'Personal Draw', 'Owner personal draw', 'ledger-owner-draws'),
  ('cat-bank-fees', 'default', 'Bank Fees', 'Bank and processor fees', 'ledger-bank-fees'),
  ('cat-uncategorized', 'default', 'Uncategorized', 'Needs classification', 'ledger-import-suspense')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  default_ledger_account_id = EXCLUDED.default_ledger_account_id,
  is_active = TRUE,
  updated_at = NOW();

INSERT INTO public.tax_mappings (id, workspace_id, category_id, ledger_account_id, tax_form, tax_line, label, notes) VALUES
  ('tax-gas-schedule-c-9', 'default', 'cat-gas', 'ledger-fuel', 'Schedule C', 'Line 9', 'Vehicle Fuel', ''),
  ('tax-software-schedule-c-18', 'default', 'cat-software', 'ledger-software-subscriptions', 'Schedule C', 'Line 18 or 27a', 'Software', ''),
  ('tax-meals-schedule-c-24b', 'default', 'cat-food', 'ledger-meals', 'Schedule C', 'Line 24b', 'Meals', ''),
  ('tax-professional-fees-schedule-c-17', 'default', 'cat-legal-admin', 'ledger-professional-fees', 'Schedule C', 'Line 17', 'Professional Services', '')
ON CONFLICT (id) DO UPDATE SET
  category_id = EXCLUDED.category_id,
  ledger_account_id = EXCLUDED.ledger_account_id,
  tax_form = EXCLUDED.tax_form,
  tax_line = EXCLUDED.tax_line,
  label = EXCLUDED.label,
  updated_at = NOW();

INSERT INTO public.classification_rules (id, workspace_id, pattern, suggested_category_id, suggested_ledger_account_id, suggested_tags, suggested_counterparty, description) VALUES
  ('rule-gas', 'default', 'gas', 'cat-gas', 'ledger-fuel', ARRAY['vehicle'], '', 'Fuel purchases'),
  ('rule-shell', 'default', 'shell', 'cat-gas', 'ledger-fuel', ARRAY['vehicle'], 'Shell', 'Shell fuel purchases'),
  ('rule-hotel', 'default', 'hotel', 'cat-hotel', 'ledger-rent-lodging', ARRAY['travel'], '', 'Hotel and lodging'),
  ('rule-github', 'default', 'github', 'cat-software', 'ledger-software-subscriptions', ARRAY['software'], 'GitHub', 'GitHub subscriptions'),
  ('rule-google', 'default', 'google', 'cat-software', 'ledger-software-subscriptions', ARRAY['software'], 'Google', 'Google subscriptions'),
  ('rule-phone', 'default', 'phone', 'cat-phone', 'ledger-phone-internet', ARRAY['utilities'], '', 'Phone service')
ON CONFLICT (id) DO UPDATE SET
  pattern = EXCLUDED.pattern,
  suggested_category_id = EXCLUDED.suggested_category_id,
  suggested_ledger_account_id = EXCLUDED.suggested_ledger_account_id,
  suggested_tags = EXCLUDED.suggested_tags,
  suggested_counterparty = EXCLUDED.suggested_counterparty,
  description = EXCLUDED.description,
  is_active = TRUE,
  updated_at = NOW();

-- ---------------------------------------------------------------------------
-- RLS and explicit Data API grants.
-- The Worker uses service_role, but grants keep PostgREST access intentional.
-- ---------------------------------------------------------------------------

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_rows_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counterparties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qifi_dirty_seed_archives ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.organizations,
  public.workspaces,
  public.financial_accounts,
  public.ledger_accounts,
  public.categories,
  public.tax_mappings,
  public.import_batches,
  public.import_rows_raw,
  public.transactions,
  public.journal_entries,
  public.journal_lines,
  public.classification_rules,
  public.counterparties,
  public.obligations,
  public.attachments,
  public.statements,
  public.recurring_transactions
TO service_role;

GRANT SELECT, INSERT ON public.qifi_dirty_seed_archives TO service_role;
