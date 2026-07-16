-- Durable counterparty profiles and auditable subledger events.
ALTER TABLE public.counterparties
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.counterparty_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  counterparty_id TEXT NOT NULL REFERENCES public.counterparties(id) ON DELETE CASCADE,
  related_counterparty_id TEXT NOT NULL REFERENCES public.counterparties(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL DEFAULT 'contact',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (counterparty_id <> related_counterparty_id),
  UNIQUE (workspace_id, counterparty_id, related_counterparty_id, relationship_type)
);

ALTER TABLE public.obligations
  ADD COLUMN IF NOT EXISTS incurred_date DATE,
  ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS settlement_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS originating_journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS settlement_journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS write_off_journal_entry_id UUID REFERENCES public.journal_entries(id) ON DELETE SET NULL;

UPDATE public.obligations SET incurred_date = created_at::date WHERE incurred_date IS NULL;
ALTER TABLE public.obligations ALTER COLUMN incurred_date SET DEFAULT CURRENT_DATE;
ALTER TABLE public.obligations ALTER COLUMN incurred_date SET NOT NULL;
ALTER TABLE public.obligations DROP CONSTRAINT IF EXISTS obligations_status_check;
ALTER TABLE public.obligations ADD CONSTRAINT obligations_status_check
  CHECK (status IN ('active', 'resolved', 'disputed', 'written_off'));

CREATE TABLE IF NOT EXISTS public.counterparty_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  counterparty_id TEXT NOT NULL REFERENCES public.counterparties(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('note', 'transaction', 'obligation_created', 'obligation_resolved', 'obligation_written_off', 'relationship')),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  amount NUMERIC(15,2),
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  obligation_id TEXT REFERENCES public.obligations(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_counterparty_events_timeline
  ON public.counterparty_events (workspace_id, counterparty_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_obligations_counterparty_history
  ON public.obligations (workspace_id, counterparty_id, incurred_date DESC);

ALTER TABLE public.counterparty_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counterparty_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.counterparty_relationships TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.counterparty_events TO service_role;

COMMENT ON COLUMN public.obligations.originating_journal_entry_id IS
  'Optional GL journal recognizing the receivable/payable. A tracking-only obligation may remain null.';
COMMENT ON COLUMN public.obligations.write_off_journal_entry_id IS
  'Approved bad-debt journal; normally debit bad-debt expense and credit receivable.';
