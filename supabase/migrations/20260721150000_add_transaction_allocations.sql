-- Counterparty allocation subledger. Allocations describe who benefited from
-- part of a transaction without creating another cash transaction or expense.
CREATE TABLE IF NOT EXISTS public.transaction_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id TEXT NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  counterparty_id TEXT NOT NULL REFERENCES public.counterparties(id) ON DELETE RESTRICT,
  amount NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  treatment TEXT NOT NULL CHECK (treatment IN ('shared', 'gift', 'iou')),
  note TEXT NOT NULL DEFAULT '',
  obligation_id TEXT REFERENCES public.obligations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((treatment = 'iou' AND obligation_id IS NOT NULL) OR (treatment <> 'iou' AND obligation_id IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_transaction_allocations_transaction
  ON public.transaction_allocations (workspace_id, transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_allocations_counterparty
  ON public.transaction_allocations (workspace_id, counterparty_id, created_at DESC);

ALTER TABLE public.transaction_allocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.transaction_allocations FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transaction_allocations TO service_role;

COMMENT ON TABLE public.transaction_allocations IS
  'Analytical splits of a transaction by counterparty. IOU rows link to an obligation; gift/shared rows never alter debt.';

CREATE OR REPLACE FUNCTION public.replace_transaction_allocations(p_transaction_id UUID, p_allocations JSONB)
RETURNS SETOF public.transaction_allocations
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  tx public.transactions%ROWTYPE;
  item JSONB;
  cp_id TEXT;
  item_amount NUMERIC(15,2);
  item_treatment TEXT;
  item_note TEXT;
  new_obligation_id TEXT;
  allocation_total NUMERIC(15,2) := 0;
BEGIN
  SELECT * INTO tx FROM public.transactions WHERE id = p_transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transaction not found'; END IF;
  IF jsonb_typeof(p_allocations) <> 'array' THEN RAISE EXCEPTION 'Allocations must be an array'; END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_allocations)
  LOOP
    cp_id := item->>'counterpartyId';
    item_amount := (item->>'amount')::NUMERIC;
    item_treatment := item->>'treatment';
    IF cp_id IS NULL OR item_amount <= 0 OR item_treatment NOT IN ('shared', 'gift', 'iou') THEN RAISE EXCEPTION 'Invalid allocation'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.counterparties WHERE id = cp_id AND workspace_id = tx.workspace_id) THEN RAISE EXCEPTION 'Invalid counterparty'; END IF;
    allocation_total := allocation_total + item_amount;
  END LOOP;
  IF allocation_total > ABS(tx.amount) + 0.005 THEN RAISE EXCEPTION 'Allocated amount exceeds transaction amount'; END IF;

  DELETE FROM public.obligations WHERE id IN (SELECT obligation_id FROM public.transaction_allocations WHERE transaction_id = p_transaction_id AND obligation_id IS NOT NULL);
  DELETE FROM public.transaction_allocations WHERE transaction_id = p_transaction_id;

  FOR item IN SELECT value FROM jsonb_array_elements(p_allocations)
  LOOP
    cp_id := item->>'counterpartyId'; item_amount := (item->>'amount')::NUMERIC;
    item_treatment := item->>'treatment'; item_note := COALESCE(item->>'note', ''); new_obligation_id := NULL;
    IF item_treatment = 'iou' THEN
      new_obligation_id := 'obl-' || gen_random_uuid()::TEXT;
      INSERT INTO public.obligations (id, workspace_id, counterparty_id, transaction_id, amount, type, description, status)
      VALUES (new_obligation_id, tx.workspace_id, cp_id, tx.id, item_amount, 'owed_to_me', COALESCE(NULLIF(item_note, ''), 'Share of ' || tx.description_clean), 'active');
    END IF;
    INSERT INTO public.transaction_allocations (workspace_id, transaction_id, counterparty_id, amount, treatment, note, obligation_id)
    VALUES (tx.workspace_id, tx.id, cp_id, item_amount, item_treatment, item_note, new_obligation_id);
  END LOOP;
  RETURN QUERY SELECT * FROM public.transaction_allocations WHERE transaction_id = p_transaction_id ORDER BY created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_transaction_allocations(UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_transaction_allocations(UUID, JSONB) TO service_role;
