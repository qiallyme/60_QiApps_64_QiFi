import assert from 'node:assert/strict';
import test from 'node:test';
import type { Account, LedgerEntry, RecurringSchedule, Transaction } from '../types';
import { accountBalanceFromEntries, formatLocalDate, reconcileLedger, recurringOccurrences } from './financeMath';

const asset: Account = {
  id: 'cash', code: '1000', name: 'Cash', type: 'asset', description: '', isActive: true,
};
const transaction: Transaction = {
  id: 'tx-1', date: '2026-01-31', description: 'Sale', rawDescription: 'Sale', amount: 100,
  sourceAccountId: 'cash', tags: [], counterparty: 'Customer', createdAt: '2026-01-31T00:00:00Z',
};
const balancedEntries: LedgerEntry[] = [
  { id: 'line-1', transactionId: 'tx-1', journalEntryId: 'journal-1', accountId: 'cash', debit: 100, credit: 0, date: '2026-01-31' },
  { id: 'line-2', transactionId: 'tx-1', journalEntryId: 'journal-1', accountId: 'revenue', debit: 0, credit: 100, date: '2026-01-31' },
];

test('asset balances use debit-normal accounting', () => {
  assert.equal(accountBalanceFromEntries(asset, balancedEntries), 100);
});

test('ledger reconciliation verifies journal and source-record integrity', () => {
  const result = reconcileLedger([transaction], balancedEntries);
  assert.equal(result.isReconciled, true);
  assert.equal(result.difference, 0);
  assert.equal(result.imbalancedJournalCount, 0);
});

test('ledger reconciliation detects missing and orphan source mappings', () => {
  const result = reconcileLedger([transaction], [{ ...balancedEntries[0], transactionId: 'missing' }]);
  assert.equal(result.isReconciled, false);
  assert.equal(result.transactionsWithoutLedgerEntries, 1);
  assert.equal(result.orphanLedgerEntryCount, 1);
  assert.equal(result.imbalancedJournalCount, 1);
});

test('monthly forecast recurrence clamps safely at month end', () => {
  const schedule: RecurringSchedule = {
    id: 'schedule-1', name: 'Month end', amount: -10, accountId: 'expense', sourceAccountId: 'cash',
    frequency: 'monthly', nextDueDate: '2026-01-31', tags: [], isActive: true,
  };
  assert.deepEqual(
    recurringOccurrences(schedule, new Date('2026-04-30T00:00:00')).map(formatLocalDate),
    ['2026-01-31', '2026-02-28', '2026-03-28', '2026-04-28'],
  );
});
