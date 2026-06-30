/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'clearing' | 'suspense';

export interface Account {
  id: string;
  code: string;
  name: string;
  type: AccountType;
  description: string;
  isActive: boolean;
}

export interface ImportBatch {
  id: string;
  createdAt: string;
  fileName: string;
  rawCount: number;
  sourceAccountId: string; // COA Account ID (e.g. assets-checking)
}

export interface RawImportedRow {
  id: string;
  importBatchId: string;
  date: string;
  description: string;
  amount: number; // positive = inflow, negative = outflow
  status: 'pending' | 'processed' | 'ignored';
  suggestedAccountId?: string;
  suggestedTags?: string[];
  suggestedCounterparty?: string;
  memo?: string;
}

export interface Rule {
  id: string;
  pattern: string; // case-insensitive substring search
  suggestedAccountId: string; // COA Account ID
  suggestedTags: string[];
  suggestedCounterparty: string;
  description: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  rawDescription: string;
  amount: number; // net amount from source account perspective
  sourceAccountId: string; // COA Account ID (Checking, Credit Card)
  tags: string[];
  counterparty: string;
  reconciliationId?: string | null; // Statement ID or null
  importBatchId?: string | null;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  transactionId: string;
  accountId: string; // COA Account ID
  debit: number;  // increases assets/expenses, decreases liabilities/equity/revenue
  credit: number; // increases liabilities/equity/revenue, decreases assets/expenses
  date: string;   // duplicated for fast lookup
}

export interface Attachment {
  id: string;
  transactionId?: string | null;
  statementId?: string | null;
  fileName: string;
  fileType: string;
  dataUrl: string; // Base64 image/file data
  uploadedAt: string;
  notes: string;
}

export interface Statement {
  id: string;
  accountId: string; // COA Account ID (Asset or Liability type)
  startDate: string;
  endDate: string;
  openingBalance: number;
  closingBalance: number;
  isReconciled: boolean;
  reconciledAt?: string | null;
}

export interface RecurringSchedule {
  id: string;
  name: string;
  amount: number; // negative for outflow, positive for inflow
  accountId: string; // Category account (e.g. expenses-rent)
  sourceAccountId: string; // Asset/Liability account (e.g. assets-checking)
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  nextDueDate: string; // YYYY-MM-DD
  tags: string[];
  isActive: boolean;
}

// Missing domain models requested by user
export interface Counterparty {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  tags: string[];
  isBusiness: boolean;
  relationshipType?: 'Friend' | 'Family' | 'Coworker' | 'Collegue' | 'Partner' | 'Client' | 'Acuentance' | 'Other';
  createdAt: string;
}

export interface AccountabilityObligation {
  id: string;
  workspaceId: string;
  counterpartyId: string; // reference to Counterparty
  amount: number; // positive = owed to me, negative = I owe
  type: 'owed_to_me' | 'i_owe' | 'reimbursable' | 'pending_reimbursement' | 'disputed' | 'needs_evidence' | 'needs_explanation' | 'resolved' | 'written_off';
  description: string;
  transactionId?: string | null; // reference to source Transaction if any
  dueDate?: string;
  status: 'active' | 'resolved' | 'disputed';
  createdAt: string;
}

export interface TransactionSplit {
  id: string;
  transactionId: string;
  accountId: string;
  amount: number;
  description?: string;
}

export interface AiSuggestionMetadata {
  confidenceScore: number;
  suggestedAccountId: string;
  suggestedTags: string[];
  suggestedCounterparty: string;
  rationale: string;
}

