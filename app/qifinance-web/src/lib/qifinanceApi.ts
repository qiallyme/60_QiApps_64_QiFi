/**
 * QiFinance API Client
 * Interacts with the Cloudflare Worker Gateway.
 */

import { supabase } from './supabase';

const API_BASE_URL = import.meta.env.PROD
  ? 'https://api.qially.com'
  : import.meta.env.VITE_QIFINANCE_API_BASE_URL || 'http://localhost:8787';
const AUTH_STORAGE_KEY = 'qifi_api_token';

// Older builds accepted a provider secret in browser storage. The Worker now
// owns that secret, so remove any legacy copy and never transmit it.
localStorage.removeItem('qifi_user_openai_api_key');

function getStoredAuthToken(): string {
  return localStorage.getItem(AUTH_STORAGE_KEY)?.trim() || '';
}

export class QiFinanceAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QiFinanceAuthError';
  }
}

async function authHeaders(init?: RequestInit): Promise<Headers> {
  const headers = new Headers(init?.headers);
  // Get the current Supabase session access token
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? getStoredAuthToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
}

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

  const message = details ? `${fallback}: ${details}` : fallback;
  if (res.status === 401 || res.status === 403) {
    return new QiFinanceAuthError(message);
  }
  return new Error(message);
}

async function requestJson<T>(path: string, fallback: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: await authHeaders(init),
  });
  if (!res.ok) throw await apiError(res, fallback);
  const payload: unknown = await res.json();
  // 251_QiApi uses a standard success envelope. Keep the client tolerant of
  // unwrapped health/dev responses, but never leak the envelope into callers.
  if (
    payload !== null &&
    typeof payload === 'object' &&
    'ok' in payload &&
    (payload as { ok?: unknown }).ok === true &&
    'data' in payload
  ) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

async function postJson<T>(path: string, body: unknown, fallback: string, init?: RequestInit): Promise<T> {
  const headers = await authHeaders(init);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return requestJson<T>(path, fallback, {
    method: 'POST',
    ...init,
    headers,
    body: JSON.stringify(body),
  });
}

async function patchJson<T>(path: string, body: unknown, fallback: string): Promise<T> {
  const headers = await authHeaders();
  headers.set('Content-Type', 'application/json');
  return requestJson<T>(path, fallback, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
}

async function putJson<T>(path: string, body: unknown, fallback: string): Promise<T> {
  const headers = await authHeaders();
  headers.set('Content-Type', 'application/json');
  return requestJson<T>(path, fallback, { method: 'PUT', headers, body: JSON.stringify(body) });
}

async function deleteJson<T>(path: string, fallback: string): Promise<T> {
  const headers = await authHeaders();
  return requestJson<T>(path, fallback, { method: 'DELETE', headers });
}

const idPath = (id: string) => encodeURIComponent(id);

export interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  normal_balance?: string;
  normalBalance?: string;
  detail_type?: string;
  detailType?: string;
  description: string;
  is_active: boolean;
  account_number?: string;
  accountNumber?: string;
  routing_number?: string;
  routingNumber?: string;
  institution?: string;
  parent_account_id?: string;
  parentAccountId?: string;
}

export interface FinancialAccount {
  id: string;
  name: string;
  institution?: string;
  account_mask?: string;
  accountMask?: string;
  account_kind?: string;
  accountKind?: string;
  source_provider?: string;
  sourceProvider?: string;
  current_balance?: number;
  currentBalance?: number;
  currency?: string;
  default_ledger_account_id?: string | null;
  defaultLedgerAccountId?: string | null;
  is_active?: boolean;
  isActive?: boolean;
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
  date?: string;
  transaction_date?: string;
  transactionDate?: string;
  description: string;
  description_clean?: string;
  descriptionClean?: string;
  raw_description: string;
  amount: number;
  source_account_id?: string;
  sourceAccountId?: string;
  financial_account_id?: string;
  financialAccountId?: string;
  category_id?: string | null;
  categoryId?: string | null;
  tags: string[];
  counterparty: string;
  reconciliation_id?: string | null;
  import_batch_id?: string | null;
  raw_row_id?: string | null;
  created_at: string;
  import_status: string;
  classification_status: string;
  classificationStatus?: string;
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
  providerReference?: string;
  importKind?: string;
  requiresReview?: boolean;
  subtotal?: number;
  fee?: number;
}

export interface ImportPreviewResponse {
  fileName: string;
  rawCount: number;
  rows: ImportPreviewRow[];
  missingCategories: string[];
  missingCounterparties: string[];
  providerProfile?: 'cash_app' | 'generic';
  excludedFailedRows?: number;
  excludedNonTransactionRows?: number;
  requiresReviewCount?: number;
  duplicateCount?: number;
}

export interface ReceiptProcessingResponse {
  attachmentId: string;
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  rawOcrText?: string | null;
  parsedOcrJson?: import('../types').ReceiptExtraction | null;
  error?: string | null;
}

export interface FinanceState {
  financialAccounts: any[];
  ledgerAccounts: any[];
  accounts: any[];
  categories: any[];
  transactions: any[];
  journalEntries: any[];
  journalLines: any[];
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

export interface AssistantActionResult {
  type: string;
  status: 'created' | 'skipped' | 'error';
  message: string;
  record?: any;
}

export interface AssistantPlanStep {
  id: string;
  clientStepId: string;
  position: number;
  type: string;
  description: string;
  payload: Record<string, unknown>;
  dependsOn: string[];
  confidence: number | null;
  status: 'proposed' | 'approved' | 'rejected' | 'executing' | 'executed' | 'skipped' | 'failed';
  result?: AssistantActionResult;
  error?: string | null;
}

export interface AssistantResponse {
  ok: boolean;
  threadId: string;
  planId: string;
  status: 'needs_clarification' | 'pending_approval' | 'executing' | 'completed' | 'partially_completed' | 'failed' | 'rejected';
  summary: string;
  questions: string[];
  warnings: string[];
  steps: AssistantPlanStep[];
  results?: AssistantActionResult[];
  model: string;
}

export const qifinanceApi = {
  setAuthToken(token: string): void {
    localStorage.setItem(AUTH_STORAGE_KEY, token.trim());
  },

  clearAuthToken(): void {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  },

  getAuthToken(): string {
    return getStoredAuthToken();
  },

  hasAuthToken(): boolean {
    const token = getStoredAuthToken();
    // Supabase JWTs must be validated/restored by supabase.auth.getSession().
    // Treat only the optional static passphrase as an immediate local unlock.
    return Boolean(token) && !(token.startsWith('ey') && token.split('.').length === 3);
  },

  async checkHealth(): Promise<{ ok: boolean; service: string; time: string }> {
    return requestJson('/health', 'API health check failed');
  },

  async getState(): Promise<FinanceState> {
    return requestJson('/api/finance/state', 'Failed to fetch finance state');
  },

  async askAssistant(message: string, threadId?: string): Promise<AssistantResponse> {
    return postJson('/api/finance/assistant', { message, threadId }, 'QiFi Assistant request failed');
  },

  async executeAssistantPlan(planId: string, stepIds: string[]): Promise<AssistantResponse> {
    return postJson(`/api/finance/assistant/plans/${idPath(planId)}/execute`, { stepIds }, 'QiFi Assistant execution failed');
  },

  async getAccounts(): Promise<Account[]> {
    return requestJson('/api/finance/accounts', 'Failed to fetch accounts');
  },

  async createAccount(account: Partial<Account>): Promise<Account> {
    return postJson('/api/finance/accounts', account, 'Failed to create account');
  },

  async createFinancialAccount(account: Partial<FinancialAccount>): Promise<FinancialAccount> {
    return postJson('/api/finance/financial-accounts', account, 'Failed to create financial account');
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
    hasHeaders: boolean,
    amountMode?: 'single' | 'separate'
  ): Promise<ImportPreviewResponse> {
    return postJson('/api/finance/import/preview', {
      csvText,
      fileName,
      sourceAccountId,
      columnMappings,
      hasHeaders,
      amountMode,
    }, 'Failed to fetch import preview');
  },

  async commitImport(
    fileName: string,
    sourceAccountId: string,
    rows: ImportPreviewRow[]
  ): Promise<{ message: string; batchId: string; totalRows: number; createdCount: number; reviewCount?: number; duplicateCount?: number; transactions: Transaction[] }> {
    return postJson('/api/finance/import/commit', {
      fileName,
      sourceAccountId,
      rows,
    }, 'Failed to commit transactions import');
  },

  async updateRawRow(id: string, updates: Record<string, unknown>): Promise<any> {
    return patchJson(`/api/finance/raw-rows/${idPath(id)}`, updates, `Failed to update imported row ${id}`);
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

  async getAttachmentUrl(id: string): Promise<{ url: string, type: 'signed_url' | 'data_url' }> {
    return requestJson(`/api/finance/attachments/${idPath(id)}/url`, `Failed to fetch attachment url ${id}`);
  },

  async processReceipt(id: string): Promise<ReceiptProcessingResponse> {
    return postJson(`/api/finance/attachments/${idPath(id)}/process-receipt`, {}, `Failed to process receipt ${id}`);
  },

  async getReceiptProcessing(id: string): Promise<ReceiptProcessingResponse> {
    return requestJson(`/api/finance/attachments/${idPath(id)}/receipt-processing`, `Failed to fetch receipt processing ${id}`);
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

  async generateSchedule(id: string, occurrenceDate: string): Promise<{ generated: boolean; duplicatePrevented: boolean; transaction: Transaction; schedule: any }> {
    return postJson(`/api/finance/schedules/${idPath(id)}/generate`, { occurrenceDate }, `Failed to generate schedule ${id}`);
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

  async getTransactionAllocations(transactionId: string): Promise<any[]> {
    return requestJson(`/api/finance/transactions/${idPath(transactionId)}/allocations`, 'Failed to load transaction allocations');
  },

  async getCounterpartyAllocations(counterpartyId: string): Promise<any[]> {
    return requestJson(`/api/finance/counterparties/${idPath(counterpartyId)}/allocations`, 'Failed to load counterparty allocations');
  },

  async replaceTransactionAllocations(transactionId: string, allocations: unknown[]): Promise<any[]> {
    return putJson(`/api/finance/transactions/${idPath(transactionId)}/allocations`, { allocations }, 'Failed to save transaction allocations');
  },
};
