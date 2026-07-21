import assert from 'node:assert/strict';
import test from 'node:test';
import type { Account } from '../types';
import { flattenAccountHierarchy } from './accountHierarchy';

const account = (id: string, code: string, parentLedgerAccountId: string | null = null): Account => ({
  id, code, name: id, type: 'asset', description: '', isActive: true, parentLedgerAccountId,
});

test('flattens children and grandchildren from the canonical parent ledger field', () => {
  const result = flattenAccountHierarchy([
    account('grandchild', '1002', 'child'),
    account('root', '1000'),
    account('child', '1001', 'root'),
  ], 'asset');
  assert.deepEqual(result.map(item => [item.account.id, item.depth]), [
    ['root', 0], ['child', 1], ['grandchild', 2],
  ]);
});

test('keeps orphaned and cyclic accounts visible without recursing forever', () => {
  const result = flattenAccountHierarchy([
    account('orphan', '1000', 'missing'),
    account('cycle-a', '1001', 'cycle-b'),
    account('cycle-b', '1002', 'cycle-a'),
  ], 'asset');
  assert.deepEqual(new Set(result.map(item => item.account.id)), new Set(['orphan', 'cycle-a', 'cycle-b']));
});
