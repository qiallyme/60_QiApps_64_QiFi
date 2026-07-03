/**
 * QiFinance API Client
 * Interacts with the Cloudflare Worker Gateway.
 */

const API_BASE_URL = import.meta.env.VITE_QIFINANCE_API_BASE_URL || 'https://api.fi.qially.com';

async function apiError(res: Response, fallback: string): Promise<Error> {
  let details = "";
  try {
    details = await res.text();
    if (details) {
      try {
        details = JSON.stringify(JSON.parse(details));
      } catch {}
    }
  } catch {
    details = "";
  }

  return new Error(details ? `${fallback}: ${details}` : fallback);
}

async function requestJson<T>(path: string, fallback: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, init);
  if (!res.ok) throw await apiError(res, fallback);
  return res.json();
}

async function postJson<T>(path: string, body: unknown, fallback: string): Promise<T> {
  return requestJson<T>(path, fallback, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function patchJson<T>(path: string, body: unknown, fallback: string): Promise<T> {
  return requestJson<T>(path, fallback, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function deleteJson<T>(path: string, fallback: string): Promise<T> {
  return requestJson<T>(path, fallback, { method: 'DELETE' });
}

const idPath = (id: string) => encodeURIComponent(id);

export interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  description: string;
  is_active: boolean;
}

export interface Category {
  id: string;
  code: string;
  name: string;
  description: string;
  is_active: boolean;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  raw_description: string;
  amount: number;
  source_account_id: string;
  tags: string[];
  counterparty: string;
  reconciliation_id?: string | null;
  import_batch_id?: string | null;
  created_at: string;
  import_status: string;
  classification_status: string;
  ledger_status: string;
  source_metadata?: any;
}

export interface ImportPreviewRow {
  index: number;
  date: string;
  description: string;
  rawDescription: string;
  amount: number;
  suggestedAccountId: string;
  suggestedCounterparty: string;
  suggestedTags: string[];
  confidence: number;
  isDuplicate: boolean;
  duplicateMatch: any;
  memo: string;
}

export interface ImportPreviewResponse {
  fileName: string;
  rawCount: number;
  rows: ImportPreviewRow[];
  missingCategories: string[];
  missingCounterparties: string[];
}

export interface FinanceState {
  accounts: any[];
  categories: any[];
  transactions: any[];
  ledgerEntries: any[];
  importBatches: any[];
  rawRows: any[];
  rules: any[];
  attachments: any[];
  statements: any[];
  schedules: any[];
  counterparties: any[];
  obligations: any[];
}

export const qifinanceApi = {
  async checkHealth(): Promise<{ ok: boolean; service: string; time: string }> {
    return requestJson('/health', 'API health check failed');
  },

  async getState(): Promise<FinanceState> {
    return requestJson('/api/finance/state', 'Failed to fetch finance state');
  },

  async getAccounts(): Promise<Account[]> {
    return requestJson('/api/finance/accounts', 'Failed to fetch accounts');
  },

  async createAccount(account: Partial<Account>): Promise<Account> {
    return postJson('/api/finance/accounts', account, 'Failed to create account');
  },

  async updateAccount(id: string, account: Partial<Account>): Promise<Account> {
    return patchJson(`/api/finance/accounts/${idPath(id)}`, account, `Failed to update account ${id}`);
  },

  async deleteAccount(id: string): Promise<{ message: string; account: Account }> {
    return deleteJson(`/api/finance/accounts/${idPath(id)}`, `Failed to delete account ${id}`);
  },

  async getCategories(): Promise<Category[]> {
    return requestJson('/api/finance/categories', 'Failed to fetch categories');
  },

  async createCategory(category: Partial<Category>): Promise<Category> {
    return postJson('/api/finance/categories', category, 'Failed to create category');
  },

  async getTransactions(limit = 100, offset = 0): Promise<Transaction[]> {
    return requestJson(`/api/finance/transactions?limit=${limit}&offset=${offset}`, 'Failed to fetch transactions');
  },

  async getTransaction(id: string): Promise<Transaction> {
    return requestJson(`/api/finance/transactions/${idPath(id)}`, `Failed to fetch transaction ${id}`);
  },

  async createTransaction(transaction: Partial<Transaction> & { categoryAccountId?: string }): Promise<Transaction> {
    return postJson('/api/finance/transactions', transaction, 'Failed to create transaction');
  },

  async updateTransaction(id: string, updates: Partial<Transaction> & { categoryAccountId?: string }): Promise<Transaction> {
    return patchJson(`/api/finance/transactions/${idPath(id)}`, updates, `Failed to update transaction ${id}`);
  },

  async deleteTransaction(id: string): Promise<{ message: string; deleted: Transaction }> {
    return deleteJson(`/api/finance/transactions/${idPath(id)}`, `Failed to delete transaction ${id}`);
  },

  async getImportPreview(
    csvText: string,
    fileName: string,
    sourceAccountId: string,
    columnMappings: Record<number, string[]>,
    hasHeaders: boolean
  ): Promise<ImportPreviewResponse> {
    return postJson('/api/finance/import/preview', {
      csvText,
      fileName,
      sourceAccountId,
      columnMappings,
      hasHeaders,
    }, 'Failed to fetch import preview');
  },

  async commitImport(
    fileName: string,
    sourceAccountId: string,
    rows: ImportPreviewRow[]
  ): Promise<{ message: string; batchId: string; totalRows: number; createdCount: number; transactions: Transaction[] }> {
    return postJson('/api/finance/import/commit', {
      fileName,
      sourceAccountId,
      rows,
    }, 'Failed to commit transactions import');
  },

  async createRule(rule: any): Promise<any> {
    return postJson('/api/finance/rules', rule, 'Failed to create rule');
  },

  async updateRule(id: string, rule: any): Promise<any> {
    return patchJson(`/api/finance/rules/${idPath(id)}`, rule, `Failed to update rule ${id}`);
  },

  async deleteRule(id: string): Promise<any> {
    return deleteJson(`/api/finance/rules/${idPath(id)}`, `Failed to delete rule ${id}`);
  },

  async createAttachment(attachment: any): Promise<any> {
    return postJson('/api/finance/attachments', attachment, 'Failed to create attachment');
  },

  async deleteAttachment(id: string): Promise<any> {
    return deleteJson(`/api/finance/attachments/${idPath(id)}`, `Failed to delete attachment ${id}`);
  },

  async createStatement(statement: any): Promise<any> {
    return postJson('/api/finance/statements', statement, 'Failed to create statement');
  },

  async updateStatement(id: string, statement: any): Promise<any> {
    return patchJson(`/api/finance/statements/${idPath(id)}`, statement, `Failed to update statement ${id}`);
  },

  async deleteStatement(id: string): Promise<any> {
    return deleteJson(`/api/finance/statements/${idPath(id)}`, `Failed to delete statement ${id}`);
  },

  async createSchedule(schedule: any): Promise<any> {
    return postJson('/api/finance/schedules', schedule, 'Failed to create schedule');
  },

  async updateSchedule(id: string, schedule: any): Promise<any> {
    return patchJson(`/api/finance/schedules/${idPath(id)}`, schedule, `Failed to update schedule ${id}`);
  },

  async deleteSchedule(id: string): Promise<any> {
    return deleteJson(`/api/finance/schedules/${idPath(id)}`, `Failed to delete schedule ${id}`);
  },

  async createCounterparty(counterparty: any): Promise<any> {
    return postJson('/api/finance/counterparties', counterparty, 'Failed to create counterparty');
  },

  async updateCounterparty(id: string, counterparty: any): Promise<any> {
    return patchJson(`/api/finance/counterparties/${idPath(id)}`, counterparty, `Failed to update counterparty ${id}`);
  },

  async deleteCounterparty(id: string): Promise<any> {
    return deleteJson(`/api/finance/counterparties/${idPath(id)}`, `Failed to delete counterparty ${id}`);
  },

  async createObligation(obligation: any): Promise<any> {
    return postJson('/api/finance/obligations', obligation, 'Failed to create obligation');
  },

  async updateObligation(id: string, obligation: any): Promise<any> {
    return patchJson(`/api/finance/obligations/${idPath(id)}`, obligation, `Failed to update obligation ${id}`);
  },

  async deleteObligation(id: string): Promise<any> {
    return deleteJson(`/api/finance/obligations/${idPath(id)}`, `Failed to delete obligation ${id}`);
  },
};
