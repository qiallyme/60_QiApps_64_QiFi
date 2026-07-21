import type { Account, LedgerEntry, RecurringSchedule, Transaction } from '../types';

const DEBIT_NORMAL_TYPES = new Set(['asset', 'expense', 'clearing', 'suspense']);

export function accountBalanceFromEntries(account: Account, entries: LedgerEntry[]): number {
  return entries.reduce((balance, entry) => {
    if (entry.accountId !== account.id) return balance;
    return balance + (DEBIT_NORMAL_TYPES.has(account.type)
      ? entry.debit - entry.credit
      : entry.credit - entry.debit);
  }, 0);
}

export function parseLocalDate(date: string): Date {
  return new Date(`${date.slice(0, 10)}T00:00:00`);
}

export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function nextRecurringDate(date: Date, frequency: RecurringSchedule['frequency']): Date {
  const next = new Date(date);
  if (frequency === 'weekly') {
    next.setDate(next.getDate() + 7);
    return next;
  }

  const months = frequency === 'monthly' ? 1 : frequency === 'quarterly' ? 3 : 12;
  const originalDay = next.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + months);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(originalDay, lastDay));
  return next;
}

export function recurringOccurrences(schedule: RecurringSchedule, limit: Date): Date[] {
  let occurrence = parseLocalDate(schedule.nextDueDate);
  const dates: Date[] = [];
  for (let iteration = 0; occurrence <= limit && iteration < 100; iteration += 1) {
    dates.push(new Date(occurrence));
    occurrence = nextRecurringDate(occurrence, schedule.frequency);
  }
  return dates;
}

export interface LedgerReconciliation {
  totalDebits: number;
  totalCredits: number;
  difference: number;
  imbalancedJournalCount: number;
  transactionsWithoutLedgerEntries: number;
  orphanLedgerEntryCount: number;
  isReconciled: boolean;
}

export function reconcileLedger(transactions: Transaction[], entries: LedgerEntry[]): LedgerReconciliation {
  const transactionIds = new Set(transactions.map(transaction => transaction.id));
  const entriesByJournal = new Map<string, LedgerEntry[]>();
  const transactionIdsWithEntries = new Set<string>();
  let totalDebits = 0;
  let totalCredits = 0;
  let orphanLedgerEntryCount = 0;

  entries.forEach(entry => {
    totalDebits += Number(entry.debit || 0);
    totalCredits += Number(entry.credit || 0);
    if (transactionIds.has(entry.transactionId)) transactionIdsWithEntries.add(entry.transactionId);
    else orphanLedgerEntryCount += 1;
    const journalKey = entry.journalEntryId || entry.transactionId;
    entriesByJournal.set(journalKey, [...(entriesByJournal.get(journalKey) || []), entry]);
  });

  const imbalancedJournalCount = [...entriesByJournal.values()].filter(journalEntries => {
    const debits = journalEntries.reduce((sum, entry) => sum + Number(entry.debit || 0), 0);
    const credits = journalEntries.reduce((sum, entry) => sum + Number(entry.credit || 0), 0);
    return Math.abs(debits - credits) > 0.005;
  }).length;
  const transactionsWithoutLedgerEntries = transactions.filter(
    transaction => !transactionIdsWithEntries.has(transaction.id),
  ).length;
  const difference = totalDebits - totalCredits;

  return {
    totalDebits,
    totalCredits,
    difference,
    imbalancedJournalCount,
    transactionsWithoutLedgerEntries,
    orphanLedgerEntryCount,
    isReconciled: Math.abs(difference) <= 0.005 && imbalancedJournalCount === 0 &&
      transactionsWithoutLedgerEntries === 0 && orphanLedgerEntryCount === 0,
  };
}
