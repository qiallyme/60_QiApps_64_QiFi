-- Record pre-existing debt without inventing cash activity or an expense.
CREATE OR REPLACE FUNCTION public.create_opening_debt(
  p_counterparty_id TEXT,
  p_liability_account_id TEXT,
  p_amount NUMERIC,
  p_description TEXT,
  p_incurred_date DATE,
  p_due_date DATE DEFAULT NULL
)
RETURNS public.obligations
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  workspace_key TEXT;
  obligation_key TEXT := 'obl-' || gen_random_uuid()::TEXT;
  journal_key UUID := gen_random_uuid();
  result public.obligations%ROWTYPE;
BEGIN
  IF p_amount <= 0 THEN RAISE EXCEPTION 'Debt amount must be positive'; END IF;
  SELECT workspace_id INTO workspace_key FROM public.counterparties WHERE id = p_counterparty_id;
  IF workspace_key IS NULL THEN RAISE EXCEPTION 'Counterparty not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ledger_accounts WHERE id = p_liability_account_id AND workspace_id = workspace_key AND type = 'liability' AND is_active) THEN
    RAISE EXCEPTION 'Active liability account not found';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ledger_accounts WHERE id = 'ledger-opening-balance-equity' AND workspace_id = workspace_key AND type = 'equity' AND is_active) THEN
    RAISE EXCEPTION 'Opening Balance Equity account is missing';
  END IF;

  INSERT INTO public.journal_entries (id, workspace_id, entry_date, description, source, status)
  VALUES (journal_key, workspace_key, p_incurred_date, p_description, 'opening_debt', 'draft');
  INSERT INTO public.journal_lines (workspace_id, journal_entry_id, ledger_account_id, debit, credit, memo) VALUES
    (workspace_key, journal_key, 'ledger-opening-balance-equity', p_amount, 0, 'Opening debt equity offset'),
    (workspace_key, journal_key, p_liability_account_id, 0, p_amount, p_description);
  UPDATE public.journal_entries SET status = 'posted', posted_at = NOW() WHERE id = journal_key;

  INSERT INTO public.obligations (id, workspace_id, counterparty_id, amount, type, description, due_date, incurred_date, status, originating_journal_entry_id)
  VALUES (obligation_key, workspace_key, p_counterparty_id, p_amount, 'i_owe', p_description, p_due_date, p_incurred_date, 'active', journal_key)
  RETURNING * INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.create_opening_debt(TEXT, TEXT, NUMERIC, TEXT, DATE, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_opening_debt(TEXT, TEXT, NUMERIC, TEXT, DATE, DATE) TO service_role;

CREATE OR REPLACE FUNCTION public.delete_obligation_with_journal(p_obligation_id TEXT)
RETURNS public.obligations
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  deleted_row public.obligations%ROWTYPE;
  journal_key UUID;
BEGIN
  SELECT originating_journal_entry_id INTO journal_key FROM public.obligations WHERE id = p_obligation_id FOR UPDATE;
  DELETE FROM public.obligations WHERE id = p_obligation_id RETURNING * INTO deleted_row;
  IF journal_key IS NOT NULL THEN DELETE FROM public.journal_entries WHERE id = journal_key; END IF;
  RETURN deleted_row;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_obligation_with_journal(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_obligation_with_journal(TEXT) TO service_role;
