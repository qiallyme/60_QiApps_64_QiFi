/**
 * QiFinance API Client
 * Interacts with the Cloudflare Worker Gateway
 */

const API_BASE_URL = import.meta.env.VITE_QIFINANCE_API_BASE_URL || 'https://api.fi.qially.com';

async function apiError(res: Response, fallback: string): Promise<Error> {
  let details = "";
  try {
    details = await res.text();
    if (details) {
      try {
        details = JSON.stringify(JSON.parse(details));
      } catch (jsonError) {}
    }
  } catch (textError) {
    details = "";
  }

  return new Error(details ? `${fallback}: ${details}` : fallback);
}

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

export const qifinanceApi = {
  // Health check
  async checkHealth(): Promise<{ ok: boolean; service: string; time: string }> {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (!res.ok) throw await apiError(res, "API health check failed");
    return res.json();
  },

  // Accounts
  async getAccounts(): Promise<Account[]> {
    const res = await fetch(`${API_BASE_URL}/api/finance/accounts`);
    if (!res.ok) throw await apiError(res, "Failed to fetch accounts");
    return res.json();
  },

  // Categories
  async getCategories(): Promise<Category[]> {
    const res = await fetch(`${API_BASE_URL}/api/finance/categories`);
    if (!res.ok) throw await apiError(res, "Failed to fetch categories");
    return res.json();
  },

  // Transactions
  async getTransactions(limit = 100, offset = 0): Promise<Transaction[]> {
    const res = await fetch(`${API_BASE_URL}/api/finance/transactions?limit=${limit}&offset=${offset}`);
    if (!res.ok) throw await apiError(res, "Failed to fetch transactions");
    return res.json();
  },

  async getTransaction(id: string): Promise<Transaction> {
    const res = await fetch(`${API_BASE_URL}/api/finance/transactions/${id}`);
    if (!res.ok) throw await apiError(res, `Failed to fetch transaction ${id}`);
    return res.json();
  },

  async updateTransaction(id: string, updates: Partial<Transaction>): Promise<Transaction> {
    const res = await fetch(`${API_BASE_URL}/api/finance/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw await apiError(res, `Failed to update transaction ${id}`);
    return res.json();
  },

  async deleteTransaction(id: string): Promise<{ message: string; deleted: Transaction }> {
    const res = await fetch(`${API_BASE_URL}/api/finance/transactions/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw await apiError(res, `Failed to delete transaction ${id}`);
    return res.json();
  },

  // Import operations
  async getImportPreview(
    csvText: string,
    fileName: string,
    sourceAccountId: string,
    columnMappings: Record<number, string[]>,
    hasHeaders: boolean
  ): Promise<ImportPreviewResponse> {
    const res = await fetch(`${API_BASE_URL}/api/finance/import/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        csvText,
        fileName,
        sourceAccountId,
        columnMappings,
        hasHeaders,
      }),
    });
    if (!res.ok) throw await apiError(res, "Failed to fetch import preview");
    return res.json();
  },

  async commitImport(
    fileName: string,
    sourceAccountId: string,
    rows: ImportPreviewRow[]
  ): Promise<{ message: string; batchId: string; totalRows: number; createdCount: number; transactions: Transaction[] }> {
    const res = await fetch(`${API_BASE_URL}/api/finance/import/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName,
        sourceAccountId,
        rows,
      }),
    });
    if (!res.ok) throw await apiError(res, "Failed to commit transactions import");
    return res.json();
  },

  // Creations
  async createAccount(account: Partial<Account>): Promise<Account> {
    const res = await fetch(`${API_BASE_URL}/api/finance/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(account),
    });
    if (!res.ok) throw await apiError(res, "Failed to create account");
    return res.json();
  },

  async createCategory(category: Partial<Category>): Promise<Category> {
    const res = await fetch(`${API_BASE_URL}/api/finance/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(category),
    });
    if (!res.ok) throw await apiError(res, "Failed to create category");
    return res.json();
  },

  async createTransaction(transaction: Partial<Transaction>): Promise<Transaction> {
    const res = await fetch(`${API_BASE_URL}/api/finance/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction),
    });
    if (!res.ok) throw await apiError(res, "Failed to create transaction");
    return res.json();
  },
};
