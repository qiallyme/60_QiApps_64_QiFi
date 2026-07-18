/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  Account, FinancialAccount, Transaction, LedgerEntry, ImportBatch, RawImportedRow, 
  Rule, Attachment, Statement, RecurringSchedule,
  Counterparty, AccountabilityObligation
} from './types';
import { QiFinanceAuthError, qifinanceApi } from './lib/qifinanceApi';

interface QiContextType {
  financialAccounts: FinancialAccount[];
  ledgerAccounts: Account[];
  accounts: Account[];
  transactions: Transaction[];
  ledgerEntries: LedgerEntry[];
  importBatches: ImportBatch[];
  rawRows: RawImportedRow[];
  rules: Rule[];
  attachments: Attachment[];
  statements: Statement[];
  schedules: RecurringSchedule[];
  counterparties: Counterparty[];
  obligations: AccountabilityObligation[];
  
  // Balance Helpers
  getAccountBalance: (accountId: string) => number;
  refreshData: () => Promise<void>;
  isLoading: boolean;
  syncError: string | null;
  lastUpdatedAt: string | null;
  
  // Actions
  addAccount: (account: Omit<Account, 'isActive'>) => void;
  updateAccount: (account: Account) => void;
  deleteAccount: (id: string) => void;
  
  addRule: (rule: Omit<Rule, 'id'>) => void;
  updateRule: (rule: Rule) => void;
  deleteRule: (id: string) => void;
  
  importCSVData: (
    fileName: string, 
    sourceAccountId: string, 
    rows: { 
      date: string; 
      description: string; 
      amount: number;
      counterparty?: string;
      accountId?: string;
      tags?: string[];
      memo?: string;
    }[]
  ) => void;
  approveRow: (rowId: string, data: { date: string; description: string; counterparty: string; accountId: string; tags: string[]; amount: number }) => void;
  ignoreRow: (rowId: string) => void;
  updateRawRow: (rowId: string, updated: Partial<RawImportedRow>) => void;
  bulkApproveRows: (approvals: { rowId: string, data: { date: string; description: string; counterparty: string; accountId: string; tags: string[]; amount: number } }[]) => void;
  bulkIgnoreRows: (rowIds: string[]) => void;
  
  addManualTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'> & { id?: string }, categoryAccountId: string) => Promise<Transaction | null>;
  updateTransaction: (txId: string, updatedTx: Partial<Omit<Transaction, 'id' | 'createdAt'>>, categoryAccountId?: string) => void;
  deleteTransaction: (id: string) => void;
  
  addAttachment: (
    transactionId: string | null,
    fileName: string,
    fileType: string,
    dataUrl: string,
    notes: string,
    statementId?: string | null,
    accountId?: string | null,
    counterpartyId?: string | null,
    obligationId?: string | null,
    scheduleId?: string | null
  ) => void;
  deleteAttachment: (id: string) => void;
  
  addStatement: (statement: Omit<Statement, 'id' | 'isReconciled'>) => void;
  updateStatement: (statement: Statement) => void;
  deleteStatement: (id: string) => void;
  toggleReconcileTransaction: (txId: string, stmtId: string | null) => void;
  setStatementReconciled: (stmtId: string, reconciled: boolean) => void;
  
  addSchedule: (schedule: Omit<RecurringSchedule, 'id' | 'isActive'>) => void;
  updateSchedule: (schedule: RecurringSchedule) => void;
  deleteSchedule: (id: string) => void;

  // Counterparty Actions
  addCounterparty: (cp: Omit<Counterparty, 'id' | 'createdAt' | 'workspaceId'> & { id?: string }) => Promise<Counterparty>;
  updateCounterparty: (cp: Counterparty) => void;
  deleteCounterparty: (id: string) => void;

  // Obligation Actions
  addObligation: (ob: Omit<AccountabilityObligation, 'id' | 'createdAt' | 'workspaceId'> & { id?: string }) => void;
  updateObligation: (ob: AccountabilityObligation) => void;
  deleteObligation: (id: string) => void;
  
  // Storage
  resetToDefault: () => void;
  clearToBlankLedger: () => void;
  exportData: () => string;
  importData: (json: string) => boolean;
}

const QiContext = createContext<QiContextType | undefined>(undefined);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mapApiTransaction(tx: any): Transaction {
  const transactionDate = tx.transaction_date || tx.date;
  const description = tx.description_clean || tx.description;
  const financialAccountId = tx.financial_account_id || tx.source_account_id;
  return {
    id: tx.id,
    date: transactionDate,
    description,
    rawDescription: tx.description_raw || tx.raw_description || description,
    amount: Number(tx.amount),
    sourceAccountId: financialAccountId,
    financialAccountId,
    categoryId: tx.category_id,
    tags: tx.tags || [],
    counterparty: tx.counterparty || '',
    reconciliationId: tx.reconciliation_id ?? null,
    importBatchId: tx.import_batch_id,
    classificationStatus: tx.classification_status,
    createdAt: tx.created_at
  };
}

function mapApiAccount(account: any): Account {
  return {
    id: account.id,
    code: account.code,
    name: account.name,
    type: account.type as any,
    normalBalance: account.normal_balance,
    description: account.description || '',
    isActive: account.is_active ?? true,
    parentLedgerAccountId: account.parent_ledger_account_id || null,
    parentAccountId: account.parent_ledger_account_id || null
  };
}

function mapApiFinancialAccount(account: any): FinancialAccount {
  return {
    id: account.id,
    name: account.name,
    institution: account.institution,
    accountMask: account.account_mask,
    accountKind: account.account_kind || 'other',
    sourceProvider: account.source_provider,
    currentBalance: Number(account.current_balance || 0),
    currency: account.currency || 'USD',
    defaultLedgerAccountId: account.default_ledger_account_id,
    isActive: account.is_active ?? true
  };
}

function mapApiLedgerEntry(entry: any): LedgerEntry {
  return {
    id: entry.id,
    transactionId: entry.transaction_id || entry.journal_entry_id,
    journalEntryId: entry.journal_entry_id,
    accountId: entry.account_id || entry.ledger_account_id,
    ledgerAccountId: entry.ledger_account_id,
    debit: Number(entry.debit || 0),
    credit: Number(entry.credit || 0),
    date: entry.date || entry.created_at
  };
}

function mapApiImportBatch(batch: any): ImportBatch {
  return {
    id: batch.id,
    createdAt: batch.created_at || batch.imported_at || new Date().toISOString(),
    fileName: batch.file_name || batch.original_filename || 'import.csv',
    rawCount: Number(batch.row_count ?? batch.raw_count ?? 0),
    sourceAccountId: batch.financial_account_id || batch.source_account_id || '',
    financialAccountId: batch.financial_account_id
  };
}

function mapApiRawRow(row: any): RawImportedRow {
  return {
    id: row.id,
    importBatchId: row.import_batch_id || row.batch_id,
    date: row.date || row.raw_data?.date,
    description: row.description || row.raw_data?.description || '',
    amount: Number(row.amount ?? row.raw_data?.amount ?? 0),
    status: row.status || row.normalized_status || 'pending',
    suggestedAccountId: row.suggested_ledger_account_id || row.suggested_account_id || row.raw_data?.suggestedAccountId,
    suggestedLedgerAccountId: row.suggested_ledger_account_id,
    suggestedCategoryId: row.suggested_category_id,
    suggestedTags: row.suggested_tags || row.raw_data?.suggestedTags || [],
    suggestedCounterparty: row.suggested_counterparty || row.raw_data?.suggestedCounterparty || '',
    memo: row.memo || row.raw_data?.memo || ''
  };
}

function mapApiRule(rule: any): Rule {
  return {
    id: rule.id,
    pattern: rule.pattern,
    suggestedAccountId: rule.suggested_ledger_account_id || rule.suggested_account_id,
    suggestedTags: rule.suggested_tags || [],
    suggestedCounterparty: rule.suggested_counterparty || '',
    description: rule.description || ''
  };
}

function mapApiAttachment(attachment: any): Attachment {
  return {
    id: attachment.id,
    transactionId: attachment.transaction_id,
    statementId: attachment.statement_id,
    accountId: attachment.financial_account_id || attachment.account_id,
    counterpartyId: attachment.counterparty_id,
    obligationId: attachment.obligation_id,
    scheduleId: attachment.schedule_id,
    fileName: attachment.file_name,
    fileType: attachment.file_type,
    dataUrl: attachment.data_url,
    uploadedAt: attachment.uploaded_at,
    notes: attachment.notes || ''
  };
}

function mapApiStatement(statement: any): Statement {
  return {
    id: statement.id,
    accountId: statement.financial_account_id || statement.account_id,
    startDate: statement.start_date,
    endDate: statement.end_date,
    openingBalance: Number(statement.opening_balance || 0),
    closingBalance: Number(statement.closing_balance || 0),
    isReconciled: statement.is_reconciled ?? false,
    reconciledAt: statement.reconciled_at
  };
}

function mapApiSchedule(schedule: any): RecurringSchedule {
  return {
    id: schedule.id,
    name: schedule.name,
    amount: Number(schedule.amount || 0),
    accountId: schedule.ledger_account_id || schedule.account_id,
    sourceAccountId: schedule.financial_account_id || schedule.source_account_id,
    frequency: schedule.frequency,
    nextDueDate: schedule.next_due_date,
    tags: schedule.tags || [],
    isActive: schedule.is_active ?? true
  };
}

function mapApiCounterparty(counterparty: any): Counterparty {
  return {
    id: counterparty.id,
    workspaceId: counterparty.workspace_id || 'default',
    name: counterparty.name,
    description: counterparty.description || '',
    tags: counterparty.tags || [],
    isBusiness: counterparty.is_business ?? true,
    relationshipType: counterparty.relationship_type,
    websiteUrl: counterparty.website_url,
    imageUrl: counterparty.image_url,
    notes: counterparty.notes || '',
    createdAt: counterparty.created_at
  };
}

function mapApiObligation(obligation: any): AccountabilityObligation {
  return {
    id: obligation.id,
    workspaceId: obligation.workspace_id || 'default',
    counterpartyId: obligation.counterparty_id,
    amount: Number(obligation.amount || 0),
    type: obligation.type,
    description: obligation.description,
    transactionId: obligation.transaction_id,
    dueDate: obligation.due_date,
    incurredDate: obligation.incurred_date || obligation.created_at?.slice(0, 10),
    settledAt: obligation.settled_at,
    settlementTransactionId: obligation.settlement_transaction_id,
    originatingJournalEntryId: obligation.originating_journal_entry_id,
    settlementJournalEntryId: obligation.settlement_journal_entry_id,
    writeOffJournalEntryId: obligation.write_off_journal_entry_id,
    status: obligation.status || 'active',
    createdAt: obligation.created_at
  };
}

function buildLedgerEntriesFromTransactions(txs: Transaction[]): LedgerEntry[] {
  return txs.flatMap((tx) => {
    const absoluteAmount = Math.abs(tx.amount);
    const isOutflow = tx.amount < 0;
    const matchedAccId = tx.tags.includes('software') ? 'expenses-software' :
                         tx.tags.includes('travel') ? 'expenses-travel' :
                         tx.tags.includes('food') ? 'expenses-groceries' : 'suspense-uncategorized';

    return [
      {
        id: `led-${tx.id}-src`,
        transactionId: tx.id,
        accountId: tx.sourceAccountId,
        debit: isOutflow ? 0 : absoluteAmount,
        credit: isOutflow ? absoluteAmount : 0,
        date: tx.date
      },
      {
        id: `led-${tx.id}-cat`,
        transactionId: tx.id,
        accountId: matchedAccId,
        debit: isOutflow ? absoluteAmount : 0,
        credit: isOutflow ? 0 : absoluteAmount,
        date: tx.date
      }
    ];
  });
}

// Initial mock-up reference data
const DEFAULT_ACCOUNTS: Account[] = [
  { id: 'assets-checking', code: '1010', name: 'Business Checking', type: 'asset', description: 'Primary business checking account', isActive: true },
  { id: 'assets-savings', code: '1020', name: 'Tax Savings', type: 'asset', description: 'Reserve for quarterly estimated taxes', isActive: true },
  { id: 'assets-loans-mom', code: '1210', name: 'Loan to Mom', type: 'asset', description: 'Loaned funds to Mom (Receivable)', isActive: true },
  { id: 'liabilities-chasecc', code: '2010', name: 'Chase Sapphire CC', type: 'liability', description: 'Business credit card', isActive: true },
  { id: 'equity-capital', code: '3010', name: 'Owner Capital', type: 'equity', description: 'Initial personal equity contributions', isActive: true },
  { id: 'revenue-consulting', code: '4010', name: 'Consulting Revenue', type: 'revenue', description: 'Sole proprietor consulting services', isActive: true },
  { id: 'expenses-rent', code: '5010', name: 'Rent & Office Space', type: 'expense', description: 'Office lease or shared space rent', isActive: true },
  { id: 'expenses-software', code: '5020', name: 'Software & SaaS', type: 'expense', description: 'Software subscriptions and cloud infrastructure', isActive: true },
  { id: 'expenses-supplies', code: '5030', name: 'Office Supplies', type: 'expense', description: 'Stationery, devices, and physical items', isActive: true },
  { id: 'expenses-gifts', code: '5040', name: 'Gifts & Caregiving', type: 'expense', description: 'Financial help or gifts to family/mom', isActive: true },
  { id: 'expenses-travel', code: '5050', name: 'Travel & Lodging', type: 'expense', description: 'Uber, flights, hotels for business', isActive: true },
  { id: 'expenses-groceries', code: '5060', name: 'Groceries (Personal)', type: 'expense', description: 'Food and daily home provisions', isActive: true },
  { id: 'expenses-dining', code: '5070', name: 'Meals & Dining Out', type: 'expense', description: 'Business dinners or personal dining', isActive: true },
  { id: 'clearing-cc-payment', code: '8010', name: 'Credit Card Cleared Payments', type: 'clearing', description: 'Temporary clearing for card pay-offs', isActive: true },
  { id: 'suspense-uncategorized', code: '9999', name: 'Uncategorized Suspense', type: 'suspense', description: 'Unreviewed default category', isActive: true }
];

const DEFAULT_RULES: Rule[] = [
  { id: 'rule-google', pattern: 'google', suggestedAccountId: 'expenses-software', suggestedTags: ['business', 'software'], suggestedCounterparty: 'Google Cloud', description: 'Google server and workspace fees' },
  { id: 'rule-github', pattern: 'github', suggestedAccountId: 'expenses-software', suggestedTags: ['business', 'software', 'dev'], suggestedCounterparty: 'GitHub', description: 'GitHub co-pilot and repository fees' },
  { id: 'rule-rent', pattern: 'landlord', suggestedAccountId: 'expenses-rent', suggestedTags: ['home', 'office'], suggestedCounterparty: 'Main Street Apartments', description: 'Monthly lease rent' },
  { id: 'rule-mom-gift', pattern: 'mom transfer', suggestedAccountId: 'expenses-gifts', suggestedTags: ['family', 'mom', 'caregiving'], suggestedCounterparty: 'Mom', description: 'Caregiving and support' },
  { id: 'rule-uber', pattern: 'uber', suggestedAccountId: 'expenses-travel', suggestedTags: ['travel', 'business'], suggestedCounterparty: 'Uber Inc', description: 'Local transport rides' },
  { id: 'rule-wholefoods', pattern: 'whole foods', suggestedAccountId: 'expenses-groceries', suggestedTags: ['personal', 'food'], suggestedCounterparty: 'Whole Foods Market', description: 'Grocery shopping' },
  { id: 'rule-figma', pattern: 'figma', suggestedAccountId: 'expenses-software', suggestedTags: ['business', 'design'], suggestedCounterparty: 'Figma Inc', description: 'Design tool SaaS' }
];

const DEFAULT_SCHEDULES: RecurringSchedule[] = [
  { id: 'sched-rent', name: 'Office Rent Payment', amount: -2400.00, accountId: 'expenses-rent', sourceAccountId: 'assets-checking', frequency: 'monthly', nextDueDate: '2026-07-01', tags: ['home', 'office'], isActive: true },
  { id: 'sched-consulting', name: 'Acme Corp Retainer', amount: 4500.00, accountId: 'revenue-consulting', sourceAccountId: 'assets-checking', frequency: 'monthly', nextDueDate: '2026-07-10', tags: ['business', 'retainer'], isActive: true },
  { id: 'sched-github', name: 'GitHub Co-Pilot', amount: -10.00, accountId: 'expenses-software', sourceAccountId: 'liabilities-chasecc', frequency: 'monthly', nextDueDate: '2026-07-15', tags: ['business', 'software'], isActive: true },
  { id: 'sched-mom', name: 'Mom Monthly Allowance', amount: -500.00, accountId: 'expenses-gifts', sourceAccountId: 'assets-checking', frequency: 'monthly', nextDueDate: '2026-07-05', tags: ['family', 'caregiving', 'mom'], isActive: true }
];

export const QiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [financialAccounts, setFinancialAccounts] = useState<FinancialAccount[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [importBatches, setImportBatches] = useState<ImportBatch[]>([]);
  const [rawRows, setRawRows] = useState<RawImportedRow[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [schedules, setSchedules] = useState<RecurringSchedule[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [obligations, setObligations] = useState<AccountabilityObligation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const reportSyncError = (action: string, error: unknown) => {
    const detail = error instanceof Error ? error.message : String(error);
    setSyncError(`${action} failed. Nothing was saved locally as a substitute. ${detail}`);
    console.error(`[QiFi] ${action} failed:`, error);
  };

  const applyApiState = (apiState: any) => {
    const mappedTxs = (apiState.transactions || []).map(mapApiTransaction);
    const mappedLedgerEntries = (apiState.journalLines || apiState.ledgerEntries || []).map(mapApiLedgerEntry);
    const mappedLedgerAccounts = (apiState.ledgerAccounts || apiState.accounts || []).map(mapApiAccount);

    setFinancialAccounts((apiState.financialAccounts || []).map(mapApiFinancialAccount));
    setAccounts(mappedLedgerAccounts);
    setTransactions(mappedTxs);
    setLedgerEntries(mappedLedgerEntries.length > 0 ? mappedLedgerEntries : buildLedgerEntriesFromTransactions(mappedTxs));
    setImportBatches((apiState.importBatches || []).map(mapApiImportBatch));
    setRawRows((apiState.rawRows || []).map(mapApiRawRow));
    setRules((apiState.rules || []).map(mapApiRule));
    setAttachments((apiState.attachments || []).map(mapApiAttachment));
    setStatements((apiState.statements || []).map(mapApiStatement));
    setSchedules((apiState.schedules || []).map(mapApiSchedule));
    setCounterparties((apiState.counterparties || []).map(mapApiCounterparty));
    setObligations((apiState.obligations || []).map(mapApiObligation));
  };

  const refreshApiState = async () => {
    setSyncError(null);
    try {
      const apiState = await qifinanceApi.getState();
      applyApiState(apiState);
      setLastUpdatedAt(new Date().toISOString());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to refresh finance data.';
      setSyncError(message);
      throw error;
    }
  };

  // Supabase through 251_QiApi is authoritative. Browser storage is never a data fallback.
  useEffect(() => {
    const loadApiData = async () => {
      setIsLoading(true);
      try {
        await qifinanceApi.checkHealth();
        await refreshApiState();
      } catch (err) {
        if (err instanceof QiFinanceAuthError) {
          qifinanceApi.clearAuthToken();
          window.location.reload();
          return;
        }
        setSyncError(err instanceof Error ? err.message : 'QiFi could not load live finance data.');
      } finally {
        setIsLoading(false);
      }
    };
    loadApiData();
  }, []);

  // Save changes helper
  const saveAll = (
    newAccs: Account[],
    newTxs: Transaction[],
    newLedg: LedgerEntry[],
    newBatches: ImportBatch[],
    newRaw: RawImportedRow[],
    newRules: Rule[],
    newAttach: Attachment[],
    newStmts: Statement[],
    newSched: RecurringSchedule[],
    newCounterparties: Counterparty[] = counterparties,
    newObligations: AccountabilityObligation[] = obligations
  ) => {
    localStorage.setItem('qi_accounts', JSON.stringify(newAccs));
    localStorage.setItem('qi_financial_accounts', JSON.stringify(financialAccounts));
    localStorage.setItem('qi_transactions', JSON.stringify(newTxs));
    localStorage.setItem('qi_ledgers', JSON.stringify(newLedg));
    localStorage.setItem('qi_batches', JSON.stringify(newBatches));
    localStorage.setItem('qi_raw_rows', JSON.stringify(newRaw));
    localStorage.setItem('qi_rules', JSON.stringify(newRules));
    localStorage.setItem('qi_attachments', JSON.stringify(newAttach));
    localStorage.setItem('qi_statements', JSON.stringify(newStmts));
    localStorage.setItem('qi_schedules', JSON.stringify(newSched));
    localStorage.setItem('qi_counterparties', JSON.stringify(newCounterparties));
    localStorage.setItem('qi_obligations', JSON.stringify(newObligations));

    setAccounts(newAccs);
    setTransactions(newTxs);
    setLedgerEntries(newLedg);
    setImportBatches(newBatches);
    setRawRows(newRaw);
    setRules(newRules);
    setAttachments(newAttach);
    setStatements(newStmts);
    setSchedules(newSched);
    setCounterparties(newCounterparties);
    setObligations(newObligations);
  };

  const seedDefaultData = () => {
    // 1. Core Accounts
    const accs = DEFAULT_ACCOUNTS;

    // 2. Initial Setup Transactions & balanced ledger postings
    const txs: Transaction[] = [];
    const ledgers: LedgerEntry[] = [];

    // Tx 1: Owner Capital Contribution on 2026-06-01 ($15,000 to Business Checking)
    const tx1Id = 'tx-init-capital';
    txs.push({
      id: tx1Id,
      date: '2026-06-01',
      description: 'Initial Owner Capital Funding',
      rawDescription: 'ELECTRONIC DEPOSIT OWNER CONTRIB',
      amount: 15000.00,
      sourceAccountId: 'assets-checking',
      tags: ['business', 'equity'],
      counterparty: 'Owner Capital',
      createdAt: new Date().toISOString()
    });
    // Double entry: Debit Asset Checking (+), Credit Equity Capital (+)
    ledgers.push({ id: 'led-cap-1', transactionId: tx1Id, accountId: 'assets-checking', debit: 15000.00, credit: 0, date: '2026-06-01' });
    ledgers.push({ id: 'led-cap-2', transactionId: tx1Id, accountId: 'equity-capital', debit: 0, credit: 15000.00, date: '2026-06-01' });

    // Tx 2: Rent payment on 2026-06-01 (-$2,400.00)
    const tx2Id = 'tx-rent-june';
    txs.push({
      id: tx2Id,
      date: '2026-06-01',
      description: 'Rent Lease - June 2026',
      rawDescription: 'MAIN STREET APTS ACH OUT DEBIT',
      amount: -2400.00,
      sourceAccountId: 'assets-checking',
      tags: ['home', 'office'],
      counterparty: 'Main Street Apartments',
      createdAt: new Date().toISOString()
    });
    // Double entry: Debit Rent Expense (+), Credit Asset Checking (-)
    ledgers.push({ id: 'led-rent-1', transactionId: tx2Id, accountId: 'expenses-rent', debit: 2400.00, credit: 0, date: '2026-06-01' });
    ledgers.push({ id: 'led-rent-2', transactionId: tx2Id, accountId: 'assets-checking', debit: 0, credit: 2400.00, date: '2026-06-01' });

    // Tx 3: Cash support for Mom on 2026-06-05 (-$500.00, GIFT)
    const tx3Id = 'tx-mom-gift';
    txs.push({
      id: tx3Id,
      date: '2026-06-05',
      description: 'Mom June Caregiving Allowance',
      rawDescription: 'VENMO INSTANT OUT MOM TRANSFER',
      amount: -500.00,
      sourceAccountId: 'assets-checking',
      tags: ['family', 'mom', 'caregiving', 'gift'],
      counterparty: 'Mom',
      createdAt: new Date().toISOString()
    });
    // Debit Gifts/Caregiving Expense (+), Credit Checking (-)
    ledgers.push({ id: 'led-gift-1', transactionId: tx3Id, accountId: 'expenses-gifts', debit: 500.00, credit: 0, date: '2026-06-05' });
    ledgers.push({ id: 'led-gift-2', transactionId: tx3Id, accountId: 'assets-checking', debit: 0, credit: 500.00, date: '2026-06-05' });

    // Tx 4: Formal Loan to Mom on 2026-06-10 (-$1,200.00, LOAN)
    const tx4Id = 'tx-mom-loan';
    txs.push({
      id: tx4Id,
      date: '2026-06-10',
      description: 'Loan for Mom Dental Work',
      rawDescription: 'WIRE TRANSFER TO MOM FAMILY LOAN',
      amount: -1200.00,
      sourceAccountId: 'assets-checking',
      tags: ['family', 'mom', 'loan'],
      counterparty: 'Mom',
      createdAt: new Date().toISOString()
    });
    // Debit Asset Loan Receivable (+), Credit Checking (-)
    ledgers.push({ id: 'led-loan-1', transactionId: tx4Id, accountId: 'assets-loans-mom', debit: 1200.00, credit: 0, date: '2026-06-10' });
    ledgers.push({ id: 'led-loan-2', transactionId: tx4Id, accountId: 'assets-checking', debit: 0, credit: 1200.00, date: '2026-06-10' });

    // Tx 5: Client retainer from Acme on 2026-06-15 ($4,500.00)
    const tx5Id = 'tx-retainer-june';
    txs.push({
      id: tx5Id,
      date: '2026-06-15',
      description: 'Acme Corp Monthly Retainer',
      rawDescription: 'ACME CORP PAYROLL ACH INFLOW',
      amount: 4500.00,
      sourceAccountId: 'assets-checking',
      tags: ['business', 'retainer'],
      counterparty: 'Acme Corp Consulting',
      createdAt: new Date().toISOString()
    });
    // Debit Checking (+), Credit Consulting Income (+)
    ledgers.push({ id: 'led-inc-1', transactionId: tx5Id, accountId: 'assets-checking', debit: 4500.00, credit: 0, date: '2026-06-15' });
    ledgers.push({ id: 'led-inc-2', transactionId: tx5Id, accountId: 'revenue-consulting', debit: 0, credit: 4500.00, date: '2026-06-15' });

    // Tx 6: Uber travel expense on CC 2026-06-18 (-$24.50)
    const tx6Id = 'tx-uber-ride';
    txs.push({
      id: tx6Id,
      date: '2026-06-18',
      description: 'Uber Ride to Client Office',
      rawDescription: 'UBER RIDE TRP CHARGE 5812',
      amount: -24.50,
      sourceAccountId: 'liabilities-chasecc',
      tags: ['travel', 'business', 'reimbursable'],
      counterparty: 'Uber Inc',
      createdAt: new Date().toISOString()
    });
    // Debit Travel Expense (+), Credit Chase CC Liability (+)
    ledgers.push({ id: 'led-uber-1', transactionId: tx6Id, accountId: 'expenses-travel', debit: 24.50, credit: 0, date: '2026-06-18' });
    ledgers.push({ id: 'led-uber-2', transactionId: tx6Id, accountId: 'liabilities-chasecc', debit: 0, credit: 24.50, date: '2026-06-18' });

    // Tx 7: Google Cloud server expense on CC 2026-06-20 (-$85.20)
    const tx7Id = 'tx-gcp';
    txs.push({
      id: tx7Id,
      date: '2026-06-20',
      description: 'Google Cloud Platform Server Billing',
      rawDescription: 'GOOGLE CLOUD SERVERS G.CO/PAY',
      amount: -85.20,
      sourceAccountId: 'liabilities-chasecc',
      tags: ['business', 'software'],
      counterparty: 'Google Cloud',
      createdAt: new Date().toISOString()
    });
    ledgers.push({ id: 'led-gcp-1', transactionId: tx7Id, accountId: 'expenses-software', debit: 85.20, credit: 0, date: '2026-06-20' });
    ledgers.push({ id: 'led-gcp-2', transactionId: tx7Id, accountId: 'liabilities-chasecc', debit: 0, credit: 85.20, date: '2026-06-20' });

    // 3. Mock Attachment for Uber Ride
    const mockAttach: Attachment[] = [
      {
        id: 'attach-uber-receipt',
        transactionId: tx6Id,
        fileName: 'uber_receipt_20260618.png',
        fileType: 'image/png',
        dataUrl: 'https://images.unsplash.com/photo-1619418602850-35ad20aa1700?w=300&auto=format&fit=crop&q=60', // placeholder receipt image
        uploadedAt: '2026-06-18T18:40:00.000Z',
        notes: 'Uber ride for Acme consultation kick-off.'
      }
    ];

    // 4. Initial Import Batch ready for review!
    const batchId = 'batch-chase-june';
    const batches: ImportBatch[] = [
      {
        id: batchId,
        createdAt: '2026-06-28T14:30:00-07:00',
        fileName: 'Chase_CC_Export_June28.csv',
        rawCount: 3,
        sourceAccountId: 'liabilities-chasecc'
      }
    ];

    const rawRowsData: RawImportedRow[] = [
      {
        id: 'raw-1',
        importBatchId: batchId,
        date: '2026-06-25',
        description: 'GITHUB SPONSOR DEV SUBS',
        amount: -10.00,
        status: 'pending',
        suggestedAccountId: 'expenses-software',
        suggestedTags: ['business', 'software', 'dev'],
        suggestedCounterparty: 'GitHub'
      },
      {
        id: 'raw-2',
        importBatchId: batchId,
        date: '2026-06-26',
        description: 'WHOLEFOODS 1032 MAIN ST',
        amount: -65.40,
        status: 'pending',
        suggestedAccountId: 'expenses-groceries',
        suggestedTags: ['personal', 'food'],
        suggestedCounterparty: 'Whole Foods Market'
      },
      {
        id: 'raw-3',
        importBatchId: batchId,
        date: '2026-06-27',
        description: 'ATM CASH WD WALMART GAS',
        amount: -150.00,
        status: 'pending',
        suggestedAccountId: 'suspense-uncategorized',
        suggestedTags: [],
        suggestedCounterparty: ''
      }
    ];

    // 5. Initial Statement for checking (Not yet reconciled)
    const stmts: Statement[] = [
      {
        id: 'stmt-checking-june',
        accountId: 'assets-checking',
        startDate: '2026-06-01',
        endDate: '2026-06-30',
        openingBalance: 0.00,
        closingBalance: 10900.00, // $15,000 capital - $2,400 rent - $500 mom gift - $1,200 mom loan = $10,900
        isReconciled: false
      }
    ];

    // Seed default counterparties and obligations
    const defaultCPs: Counterparty[] = [
      { id: 'cp-google', workspaceId: 'default', name: 'Google Cloud', description: 'Google server and workspace fees', tags: ['business', 'software'], isBusiness: true, createdAt: new Date().toISOString() },
      { id: 'cp-github', workspaceId: 'default', name: 'GitHub', description: 'GitHub co-pilot and repository fees', tags: ['business', 'software', 'dev'], isBusiness: true, createdAt: new Date().toISOString() },
      { id: 'cp-rent', workspaceId: 'default', name: 'Main Street Apartments', description: 'Monthly lease rent', tags: ['home', 'office'], isBusiness: true, createdAt: new Date().toISOString() },
      { id: 'cp-mom', workspaceId: 'default', name: 'Mom', description: 'Mom Support & Allowances', tags: ['family', 'mom'], isBusiness: false, createdAt: new Date().toISOString() },
      { id: 'cp-uber', workspaceId: 'default', name: 'Uber Inc', description: 'Local rideshare transport', tags: ['travel', 'business'], isBusiness: true, createdAt: new Date().toISOString() },
      { id: 'cp-wholefoods', workspaceId: 'default', name: 'Whole Foods Market', description: 'Grocery shopping', tags: ['personal', 'food'], isBusiness: true, createdAt: new Date().toISOString() },
      { id: 'cp-figma', workspaceId: 'default', name: 'Figma Inc', description: 'Design tool SaaS', tags: ['business', 'design'], isBusiness: true, createdAt: new Date().toISOString() },
      { id: 'cp-acme', workspaceId: 'default', name: 'Acme Corp Consulting', description: 'Primary consulting contract client', tags: ['business', 'retainer'], isBusiness: true, createdAt: new Date().toISOString() }
    ];

    const defaultObligations: AccountabilityObligation[] = [
      {
        id: 'obl-mom-dental',
        workspaceId: 'default',
        counterpartyId: 'cp-mom',
        amount: 1200.00, // Mom owes me (Loan)
        type: 'owed_to_me',
        description: 'Dental work loan to Mom. She plans to repay in installments.',
        transactionId: 'tx-mom-loan',
        dueDate: '2026-12-31',
        status: 'active',
        createdAt: new Date().toISOString()
      },
      {
        id: 'obl-uber-reimburse',
        workspaceId: 'default',
        counterpartyId: 'cp-acme',
        amount: 24.50, // Acme owes me reimbursement
        type: 'reimbursable',
        description: 'Uber ride to Acme office for kickoff. Pending monthly expense approval.',
        transactionId: 'tx-uber-ride',
        dueDate: '2026-07-15',
        status: 'active',
        createdAt: new Date().toISOString()
      }
    ];

    saveAll(accs, txs, ledgers, batches, rawRowsData, DEFAULT_RULES, mockAttach, stmts, DEFAULT_SCHEDULES, defaultCPs, defaultObligations);
  };

  // Helper: Get running balance of an account
  const getAccountBalance = (accountId: string): number => {
    let balance = 0;
    const financialAccount = financialAccounts.find(a => a.id === accountId);
    const ledgerAccountId = financialAccount?.defaultLedgerAccountId || accountId;
    const account = accounts.find(a => a.id === ledgerAccountId);
    if (!account) return 0;

    // sum ledger items
    ledgerEntries.forEach(entry => {
      if (entry.accountId === ledgerAccountId) {
        if (['asset', 'expense', 'clearing', 'suspense'].includes(account.type)) {
          // debits increase, credits decrease
          balance += entry.debit - entry.credit;
        } else {
          // liabilities, equity, revenue: credits increase, debits decrease
          balance += entry.credit - entry.debit;
        }
      }
    });

    return balance;
  };

  // -------------------------
  // Account Actions
  // -------------------------
  const addAccount = async (acc: Omit<Account, 'isActive'>) => {
    try {
      await qifinanceApi.createAccount({
        id: acc.id,
        code: acc.code,
        name: acc.name,
        type: acc.type,
        description: acc.description,
        account_number: acc.accountNumber,
        routing_number: acc.routingNumber,
        institution: acc.institution,
        parent_account_id: acc.parentAccountId,
        is_active: true
      } as any);
      await refreshApiState();
      return;
    } catch (err) {
      reportSyncError('Create account', err);
      return;
    }
  };

  const updateAccount = async (updatedAcc: Account) => {
    try {
      await qifinanceApi.updateAccount(updatedAcc.id, {
        code: updatedAcc.code,
        name: updatedAcc.name,
        type: updatedAcc.type,
        description: updatedAcc.description,
        account_number: updatedAcc.accountNumber,
        routing_number: updatedAcc.routingNumber,
        institution: updatedAcc.institution,
        parent_account_id: updatedAcc.parentAccountId,
        is_active: updatedAcc.isActive
      } as any);
      await refreshApiState();
      return;
    } catch (err) {
      reportSyncError('Update account', err);
      return;
    }
  };

  const deleteAccount = async (id: string) => {
    try {
      await qifinanceApi.deleteAccount(id);
      await refreshApiState();
      return;
    } catch (err) {
      reportSyncError('Delete account', err);
      return;
    }
  };

  // -------------------------
  // Rule Actions
  // -------------------------
  const addRule = async (rule: Omit<Rule, 'id'>) => {
    const newRule: Rule = {
      ...rule,
      id: `rule-${Date.now()}`
    };
    try {
      await qifinanceApi.createRule(newRule);
      await refreshApiState();
      return;
    } catch (err) {
      reportSyncError('Create classification rule', err);
      return;
    }
  };

  const updateRule = async (updatedRule: Rule) => {
    try {
      await qifinanceApi.updateRule(updatedRule.id, updatedRule);
      await refreshApiState();
      return;
    } catch (err) {
      reportSyncError('Update classification rule', err);
      return;
    }
  };

  const deleteRule = async (id: string) => {
    try {
      await qifinanceApi.deleteRule(id);
      await refreshApiState();
      return;
    } catch (err) {
      reportSyncError('Delete classification rule', err);
      return;
    }
  };

  // -------------------------
  // Money Ingest / CSV Import Engine
  // -------------------------
  const importCSVData = async (
    fileName: string, 
    sourceAccountId: string, 
    rows: { 
      date: string; 
      description: string; 
      amount: number;
      counterparty?: string;
      accountId?: string;
      tags?: string[];
      memo?: string;
    }[]
  ) => {
    try {
      const apiRows = rows.map((r, idx) => ({
        index: idx,
        date: r.date,
        description: r.description,
        rawDescription: r.description,
        amount: r.amount,
        suggestedAccountId: r.accountId || 'suspense-uncategorized',
        suggestedCounterparty: r.counterparty || '',
        suggestedTags: r.tags || [],
        confidence: 1.0,
        isDuplicate: false,
        duplicateMatch: null,
        memo: r.memo || ''
      }));

      await qifinanceApi.commitImport(fileName, sourceAccountId, apiRows);
      await refreshApiState();
      return;
    } catch (err) {
      reportSyncError('Import transactions', err);
      return;
    }
  };

  // Approval Engine / Ledger Posting
  const approveRow = async (rowId: string, data: { date: string; description: string; counterparty: string; accountId: string; tags: string[]; amount: number }) => {
    const row = rawRows.find(r => r.id === rowId);
    if (!row) return;

    const batch = importBatches.find(b => b.id === row.importBatchId);
    const sourceAccountId = batch ? batch.sourceAccountId : 'assets-checking';
    try {
      await qifinanceApi.createTransaction({
        date: data.date,
        description: data.description,
        raw_description: row.description,
        amount: data.amount,
        sourceAccountId,
        categoryAccountId: data.accountId,
        tags: data.tags,
        counterparty: data.counterparty,
        import_batch_id: row.importBatchId,
        raw_row_id: row.id,
      });
      await qifinanceApi.updateRawRow(rowId, { status: 'processed' });
      await refreshApiState();
    } catch (err) {
      reportSyncError('Approve imported row', err);
    }
  };

  const ignoreRow = async (rowId: string) => {
    try {
      await qifinanceApi.updateRawRow(rowId, { status: 'ignored' });
      await refreshApiState();
    } catch (err) {
      reportSyncError('Ignore imported row', err);
    }
  };

  const updateRawRow = async (rowId: string, updated: Partial<RawImportedRow>) => {
    setRawRows(rows => rows.map(r => r.id === rowId ? { ...r, ...updated } : r));
    try {
      await qifinanceApi.updateRawRow(rowId, updated as Record<string, unknown>);
    } catch (err) {
      reportSyncError('Update imported row', err);
      await refreshApiState();
    }
  };

  const bulkApproveRows = async (approvals: { rowId: string, data: { date: string; description: string; counterparty: string; accountId: string; tags: string[]; amount: number } }[]) => {
    for (const approval of approvals) await approveRow(approval.rowId, approval.data);
  };

  const bulkIgnoreRows = async (rowIds: string[]) => {
    for (const rowId of rowIds) await ignoreRow(rowId);
  };

  // Manual Transaction Generation
  const addManualTransaction = async (
    tx: Omit<Transaction, 'id' | 'createdAt'> & { id?: string },
    categoryAccountId: string
  ): Promise<Transaction | null> => {
    try {
      const apiTx = await qifinanceApi.createTransaction({
        id: tx.id && UUID_RE.test(tx.id) ? tx.id : undefined,
        date: tx.date,
        description: tx.description,
        rawDescription: tx.rawDescription,
        amount: tx.amount,
        sourceAccountId: tx.sourceAccountId,
        tags: tx.tags,
        counterparty: tx.counterparty,
        reconciliationId: tx.reconciliationId,
        importBatchId: tx.importBatchId,
        classificationStatus: categoryAccountId === 'suspense-uncategorized' ? 'needs_review' : 'classified',
        categoryAccountId
      } as any);
      await refreshApiState();
      return mapApiTransaction(apiTx);
    } catch (err) {
      reportSyncError('Create transaction', err);
      return null;
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      await qifinanceApi.deleteTransaction(id);
      await refreshApiState();
      return;
    } catch (err) {
      reportSyncError('Delete transaction', err);
      return;
    }
  };

  const updateTransaction = async (
    txId: string,
    updatedTx: Partial<Omit<Transaction, 'id' | 'createdAt'>>,
    categoryAccountId?: string
  ) => {
    try {
      const updates: any = {};
      if (updatedTx.date) updates.date = updatedTx.date;
      if (updatedTx.description) updates.description = updatedTx.description;
      if (updatedTx.amount !== undefined) updates.amount = updatedTx.amount;
      if (updatedTx.sourceAccountId) updates.source_account_id = updatedTx.sourceAccountId;
      if (updatedTx.tags) updates.tags = updatedTx.tags;
      if (updatedTx.counterparty) updates.counterparty = updatedTx.counterparty;
      if (updatedTx.reconciliationId !== undefined) updates.reconciliation_id = updatedTx.reconciliationId;
      if (categoryAccountId) updates.categoryAccountId = categoryAccountId;

      await qifinanceApi.updateTransaction(txId, updates);
      await refreshApiState();
      return;
    } catch (err) {
      reportSyncError('Update transaction', err);
      return;
    }
  };

  // -------------------------
  // Attachment Actions
  // -------------------------
  const addAttachment = async (
    transactionId: string | null,
    fileName: string,
    fileType: string,
    dataUrl: string,
    notes: string,
    statementId?: string | null,
    accountId?: string | null,
    counterpartyId?: string | null,
    obligationId?: string | null,
    scheduleId?: string | null
  ) => {
    const clientId = `attach-${Date.now()}`;
    const newAttach: Attachment = {
      id: clientId,
      transactionId: transactionId || null,
      statementId: statementId || null,
      accountId: accountId || null,
      counterpartyId: counterpartyId || null,
      obligationId: obligationId || null,
      scheduleId: scheduleId || null,
      fileName,
      fileType,
      dataUrl,
      uploadedAt: new Date().toISOString(),
      notes
    };

    try {
      await qifinanceApi.createAttachment(newAttach);
      await refreshApiState();
    } catch (err) {
      reportSyncError('Upload attachment', err);
    }
  };

  const deleteAttachment = async (id: string) => {
    try { await qifinanceApi.deleteAttachment(id); await refreshApiState(); }
    catch (err) { reportSyncError('Delete attachment', err); }
  };

  // -------------------------
  // Bank Reconciliation Actions
  // -------------------------
  const addStatement = async (stmt: Omit<Statement, 'id' | 'isReconciled'>) => {
    const newStmt: Statement = {
      ...stmt,
      id: `stmt-${Date.now()}`,
      isReconciled: false
    };
    try { await qifinanceApi.createStatement(newStmt); await refreshApiState(); }
    catch (err) { reportSyncError('Create statement', err); }
  };

  const updateStatement = async (updatedStmt: Statement) => {
    try { await qifinanceApi.updateStatement(updatedStmt.id, updatedStmt); await refreshApiState(); }
    catch (err) { reportSyncError('Update statement', err); }
  };

  const deleteStatement = async (id: string) => {
    try { await qifinanceApi.deleteStatement(id); await refreshApiState(); }
    catch (err) { reportSyncError('Delete statement', err); }
  };

  const toggleReconcileTransaction = async (txId: string, stmtId: string | null) => {
    try { await qifinanceApi.updateTransaction(txId, { reconciliation_id: stmtId } as any); await refreshApiState(); }
    catch (err) { reportSyncError('Reconcile transaction', err); }
  };

  const setStatementReconciled = async (stmtId: string, reconciled: boolean) => {
    const nextStatements = statements.map(s => s.id === stmtId ? { 
      ...s, 
      isReconciled: reconciled,
      reconciledAt: reconciled ? new Date().toISOString() : null
    } : s);
    const updated = nextStatements.find(s => s.id === stmtId);
    if (updated) {
      try { await qifinanceApi.updateStatement(stmtId, updated); await refreshApiState(); }
      catch (err) { reportSyncError('Reconcile statement', err); }
    }
  };

  // -------------------------
  // Schedules / Forecast
  // -------------------------
  const addSchedule = async (sched: Omit<RecurringSchedule, 'id' | 'isActive'>) => {
    const newSched: RecurringSchedule = {
      ...sched,
      id: `sched-${Date.now()}`,
      isActive: true
    };
    try {
      await qifinanceApi.createSchedule(newSched);
      await refreshApiState();
    } catch (error) {
      reportSyncError('Create recurring schedule', error);
    }
  };

  const updateSchedule = async (updatedSched: RecurringSchedule) => {
    try {
      await qifinanceApi.updateSchedule(updatedSched.id, updatedSched);
      await refreshApiState();
    } catch (error) {
      reportSyncError('Update recurring schedule', error);
    }
  };

  const deleteSchedule = async (id: string) => {
    try {
      await qifinanceApi.deleteSchedule(id);
      await refreshApiState();
    } catch (error) {
      reportSyncError('Delete recurring schedule', error);
    }
  };

  // -------------------------
  // Counterparty Actions
  // -------------------------
  const addCounterparty = async (cp: Omit<Counterparty, 'id' | 'createdAt' | 'workspaceId'> & { id?: string }): Promise<Counterparty> => {
    const newCP: Counterparty = {
      ...cp,
      id: cp.id || `cp-${Date.now()}`,
      workspaceId: 'default',
      createdAt: new Date().toISOString()
    };
    await qifinanceApi.createCounterparty(newCP);
    await refreshApiState();
    return newCP;
  };

  const updateCounterparty = async (updatedCP: Counterparty) => {
    try { await qifinanceApi.updateCounterparty(updatedCP.id, updatedCP); await refreshApiState(); }
    catch (err) { reportSyncError('Update counterparty', err); }
  };

  const deleteCounterparty = async (id: string) => {
    try { await qifinanceApi.deleteCounterparty(id); await refreshApiState(); }
    catch (err) { reportSyncError('Delete counterparty', err); }
  };

  // -------------------------
  // Obligation Actions
  // -------------------------
  const addObligation = async (ob: Omit<AccountabilityObligation, 'id' | 'createdAt' | 'workspaceId'> & { id?: string }) => {
    const newOb: AccountabilityObligation = {
      ...ob,
      id: ob.id || `obl-${Date.now()}`,
      workspaceId: 'default',
      createdAt: new Date().toISOString()
    };
    try { await qifinanceApi.createObligation(newOb); await refreshApiState(); }
    catch (err) { reportSyncError('Create obligation', err); }
  };

  const updateObligation = async (updatedOb: AccountabilityObligation) => {
    try { await qifinanceApi.updateObligation(updatedOb.id, updatedOb); await refreshApiState(); }
    catch (err) { reportSyncError('Update obligation', err); }
  };

  const deleteObligation = async (id: string) => {
    try { await qifinanceApi.deleteObligation(id); await refreshApiState(); }
    catch (err) { reportSyncError('Delete obligation', err); }
  };

  // -------------------------
  // Data Sovereign Backup Systems
  // -------------------------
  const resetToDefault = () => {
    localStorage.clear();
    seedDefaultData();
  };

  const clearToBlankLedger = () => {
    localStorage.clear();
    saveAll(
      DEFAULT_ACCOUNTS,
      [], // transactions
      [], // ledgerEntries
      [], // importBatches
      [], // rawRows
      DEFAULT_RULES, // rules
      [], // attachments
      [], // statements
      [], // schedules
      [], // counterparties
      []  // obligations
    );
  };

  const exportData = (): string => {
    const packet = {
      accounts,
      transactions,
      ledgerEntries,
      importBatches,
      rawRows,
      rules,
      attachments,
      statements,
      schedules,
      counterparties,
      obligations,
      exportedAt: new Date().toISOString()
    };
    return JSON.stringify(packet, null, 2);
  };

  const importData = (json: string): boolean => {
    try {
      const parsed = JSON.parse(json);
      if (!parsed.accounts || !parsed.transactions || !parsed.ledgerEntries) {
        return false;
      }
      saveAll(
        parsed.accounts,
        parsed.transactions,
        parsed.ledgerEntries,
        parsed.importBatches || [],
        parsed.rawRows || [],
        parsed.rules || [],
        parsed.attachments || [],
        parsed.statements || [],
        parsed.schedules || [],
        parsed.counterparties || [],
        parsed.obligations || []
      );
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  return (
    <QiContext.Provider value={{
      financialAccounts,
      ledgerAccounts: accounts,
      accounts,
      transactions,
      ledgerEntries,
      importBatches,
      rawRows,
      rules,
      attachments,
      statements,
      schedules,
      counterparties,
      obligations,
      getAccountBalance,
      refreshData: refreshApiState,
      isLoading,
      syncError,
      lastUpdatedAt,
      addAccount,
      updateAccount,
      deleteAccount,
      addRule,
      updateRule,
      deleteRule,
      importCSVData,
      approveRow,
      ignoreRow,
      updateRawRow,
      bulkApproveRows,
      bulkIgnoreRows,
      addManualTransaction,
      updateTransaction,
      deleteTransaction,
      addAttachment,
      deleteAttachment,
      addStatement,
      updateStatement,
      deleteStatement,
      toggleReconcileTransaction,
      setStatementReconciled,
      addSchedule,
      updateSchedule,
      deleteSchedule,
      addCounterparty,
      updateCounterparty,
      deleteCounterparty,
      addObligation,
      updateObligation,
      deleteObligation,
      resetToDefault,
      clearToBlankLedger,
      exportData,
      importData
    }}>
      {children}
    </QiContext.Provider>
  );
};

export const useQiStore = () => {
  const context = useContext(QiContext);
  if (!context) {
    throw new Error('useQiStore must be used within a QiProvider');
  }
  return context;
};
