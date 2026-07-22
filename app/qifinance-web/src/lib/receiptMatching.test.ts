import assert from 'node:assert/strict';
import test from 'node:test';
import { isAmbiguousReceiptMatch, rankReceiptTransactionMatches } from './receiptMatching';
import { Transaction } from '../types';

const tx = (id: string, overrides: Partial<Transaction> = {}): Transaction => ({
  id, date: '2026-07-20', description: 'Cash App payment to ACME Market', rawDescription: 'ACME MARKET', amount: -42.18,
  sourceAccountId: 'checking', categoryId: 'groceries', tags: [], counterparty: 'Acme Market', createdAt: '2026-07-20T12:00:00Z', ...overrides,
});

test('ranks exact amount, date, and merchant as a strong receipt match', () => {
  const matches = rankReceiptTransactionMatches({ merchantName: { value: 'Acme Market', confidence: .9 }, transactionDate: { value: '2026-07-20', confidence: .9 }, total: { value: 42.18, confidence: .99 } }, [tx('exact'), tx('other', { amount: -19 })]);
  assert.equal(matches[0].transaction.id, 'exact');
  assert.ok(matches[0].score >= .9);
});

test('flags two similarly strong candidates as ambiguous', () => {
  const extraction = { transactionDate: { value: '2026-07-20', confidence: .9 }, total: { value: 42.18, confidence: .9 } };
  const matches = rankReceiptTransactionMatches(extraction, [tx('one'), tx('two')]);
  assert.equal(isAmbiguousReceiptMatch(matches), true);
});

test('does not offer unrelated transactions', () => {
  const matches = rankReceiptTransactionMatches({ total: { value: 500, confidence: .9 } }, [tx('unrelated')]);
  assert.deepEqual(matches, []);
});
