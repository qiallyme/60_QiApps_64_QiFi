ALTER TABLE public.journal_entries DROP CONSTRAINT IF EXISTS journal_entries_source_check;
ALTER TABLE public.journal_entries ADD CONSTRAINT journal_entries_source_check
  CHECK (source IN ('manual', 'import', 'assistant', 'system', 'opening_debt'));
