-- Add statement reconciliation without replaying the destructive core reset.
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS reconciliation_id TEXT;

ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_reconciliation_id_fkey;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_reconciliation_id_fkey
  FOREIGN KEY (reconciliation_id)
  REFERENCES public.statements(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_reconciliation
  ON public.transactions(reconciliation_id);
