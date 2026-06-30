/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  Transaction, LedgerEntry, RawImportedRow, ImportBatch, 
  Counterparty, AccountabilityObligation, Rule, Attachment 
} from './types';

// 1. Transactions Service
export const transactionsService = {
  validateTransaction: (tx: Partial<Transaction> & { splits?: any[] }): { valid: boolean; error?: string } => {
    if (!tx.date) return { valid: false, error: 'Date is required' };
    if (!tx.description) return { valid: false, error: 'Description is required' };
    if (!tx.sourceAccountId) return { valid: false, error: 'Source account is required' };
    return { valid: true };
  },
  
  createTransaction: (txData: Omit<Transaction, 'id' | 'createdAt'>): Transaction => {
    return {
      ...txData,
      id: `tx_${Math.random().toString(36).substring(2, 9)}`,
      createdAt: new Date().toISOString()
    };
  }
};

// 2. Ledger Service
export const ledgerService = {
  createLedgerEntries: (tx: Transaction, categoryAccountId: string): LedgerEntry[] => {
    // Generate double-entry balanced postings
    // For normal expenses: Debit expense (increases), Credit cash/source (decreases)
    // For normal revenue: Debit cash/source (increases), Credit revenue (increases)
    const isOutflow = tx.amount < 0;
    const absAmount = Math.abs(tx.amount);

    const sourceEntry: LedgerEntry = {
      id: `le_${Math.random().toString(36).substring(2, 9)}`,
      transactionId: tx.id,
      accountId: tx.sourceAccountId,
      debit: isOutflow ? 0 : absAmount,
      credit: isOutflow ? absAmount : 0,
      date: tx.date
    };

    const counterEntry: LedgerEntry = {
      id: `le_${Math.random().toString(36).substring(2, 9)}`,
      transactionId: tx.id,
      accountId: categoryAccountId,
      debit: isOutflow ? absAmount : 0,
      credit: isOutflow ? 0 : absAmount,
      date: tx.date
    };

    return [sourceEntry, counterEntry];
  },

  isBalanced: (entries: LedgerEntry[]): boolean => {
    const totalDebits = entries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredits = entries.reduce((sum, e) => sum + e.credit, 0);
    return Math.abs(totalDebits - totalCredits) < 0.001;
  }
};

// 3. Splits Service
export const splitsService = {
  calculateRemaining: (total: number, splits: { amount: number }[]): number => {
    const splitSum = splits.reduce((sum, s) => sum + s.amount, 0);
    return total - splitSum;
  }
};

// 4. Imports Service
export const importsService = {
  createBatch: (fileName: string, rawCount: number, sourceAccountId: string): ImportBatch => {
    return {
      id: `batch_${Math.random().toString(36).substring(2, 9)}`,
      createdAt: new Date().toISOString(),
      fileName,
      rawCount,
      sourceAccountId
    };
  },

  parseCSV: (rawText: string): string[][] => {
    return rawText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        // Simple CSV splitter
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      });
  }
};

// 5. Normalization Service
export const normalizationService = {
  normalizeMerchantName: (rawDesc: string): string => {
    let clean = rawDesc.toUpperCase().trim();
    
    // Remove processing codes, terminal codes, location metadata
    clean = clean.replace(/TST\*\s*/g, '');
    clean = clean.replace(/SQ\s*\*\s*/g, '');
    clean = clean.replace(/\d{4,}/g, ''); // Long digit sequences
    clean = clean.replace(/\b(INC|LLC|CORP|CO|LTD)\b/g, '');
    clean = clean.replace(/\s+/g, ' ');
    clean = clean.trim();

    // Map common names
    if (clean.includes('GOOGLE')) return 'Google Cloud';
    if (clean.includes('GITHUB')) return 'GitHub';
    if (clean.includes('UBER')) return 'Uber';
    if (clean.includes('LYFT')) return 'Lyft';
    if (clean.includes('WHOLE FOODS') || clean.includes('WHOLEFOODS')) return 'Whole Foods';
    if (clean.includes('FIGMA')) return 'Figma';
    if (clean.includes('NETFLIX')) return 'Netflix';
    if (clean.includes('AMAZON')) return 'Amazon';
    if (clean.includes('VENMO')) return 'Venmo';
    
    // Title case fallback
    return clean
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
};

// 6. Deduplication Service
export const dedupeService = {
  findPotentialDuplicates: (row: Omit<RawImportedRow, 'id' | 'status'>, existingTransactions: Transaction[]): Transaction[] => {
    return existingTransactions.filter(tx => {
      // Rule of thumb: Date is within 3 days, and absolute amounts are equal
      const rowDate = new Date(row.date);
      const txDate = new Date(tx.date);
      const diffTime = Math.abs(rowDate.getTime() - txDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const rowAmount = Math.abs(row.amount);
      const txAmount = Math.abs(tx.amount);
      
      return diffDays <= 3 && Math.abs(rowAmount - txAmount) < 0.01;
    });
  }
};

// 7. Counterparties Service
export const counterpartiesService = {
  createCounterparty: (name: string, description = '', isBusiness = true): Counterparty => {
    return {
      id: `cp_${Math.random().toString(36).substring(2, 9)}`,
      workspaceId: 'default',
      name,
      description,
      tags: [],
      isBusiness,
      createdAt: new Date().toISOString()
    };
  }
};

// 8. Accountability Service
export const accountabilityService = {
  createObligation: (cpId: string, amount: number, type: AccountabilityObligation['type'], description: string): AccountabilityObligation => {
    return {
      id: `obl_${Math.random().toString(36).substring(2, 9)}`,
      workspaceId: 'default',
      counterpartyId: cpId,
      amount,
      type,
      description,
      status: 'active',
      createdAt: new Date().toISOString()
    };
  }
};

// 9. Evidence Service
export const evidenceService = {
  createAttachmentLink: (txId: string, fileName: string, fileType: string, dataUrl: string, notes = ''): Attachment => {
    return {
      id: `att_${Math.random().toString(36).substring(2, 9)}`,
      transactionId: txId,
      fileName,
      fileType,
      dataUrl,
      notes,
      uploadedAt: new Date().toISOString()
    };
  }
};

// 10. AI Suggestions Service
export const aiSuggestionsService = {
  getSuggestedCategory: (rawDesc: string, rules: Rule[]): { accountId: string; tags: string[]; counterparty: string; confidence: number } => {
    const cleanDesc = rawDesc.toLowerCase();
    
    // First run through custom matched rules
    for (const rule of rules) {
      if (cleanDesc.includes(rule.pattern.toLowerCase())) {
        return {
          accountId: rule.suggestedAccountId,
          tags: rule.suggestedTags,
          counterparty: rule.suggestedCounterparty,
          confidence: 0.95
        };
      }
    }

    // Heuristics for common merchant patterns
    if (cleanDesc.includes('gas') || cleanDesc.includes('chevron') || cleanDesc.includes('shell')) {
      return { accountId: 'expenses-travel', tags: ['travel', 'vehicle'], counterparty: 'Fuel Gas Station', confidence: 0.85 };
    }
    if (cleanDesc.includes('dining') || cleanDesc.includes('mcdonald') || cleanDesc.includes('starbucks') || cleanDesc.includes('cafe')) {
      return { accountId: 'expenses-dining', tags: ['dining', 'meals'], counterparty: 'Restaurant/Cafe', confidence: 0.80 };
    }
    if (cleanDesc.includes('lyft') || cleanDesc.includes('uber')) {
      return { accountId: 'expenses-travel', tags: ['travel', 'business'], counterparty: 'Rideshare', confidence: 0.90 };
    }
    if (cleanDesc.includes('transfer') || cleanDesc.includes('payment') || cleanDesc.includes('venmo')) {
      return { accountId: 'clearing-cc-payment', tags: ['transfer'], counterparty: 'Cleared Fund Transfer', confidence: 0.70 };
    }

    // Default suspense fallback
    return {
      accountId: 'suspense-uncategorized',
      tags: ['uncategorized'],
      counterparty: normalizationService.normalizeMerchantName(rawDesc),
      confidence: 0.40
    };
  }
};
