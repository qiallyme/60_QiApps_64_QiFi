import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCsv, prepareCsvImport } from './csv';

test('parses quoted commas, escaped quotes, and embedded newlines', () => {
  const result = parseCsv('\uFEFFdate,memo,amount\r\n2026-01-01,"Coffee, lunch",-12.50\r\n2026-01-02,"Said ""thanks""\nagain",25');
  assert.deepEqual(result.rows, [
    ['date', 'memo', 'amount'],
    ['2026-01-01', 'Coffee, lunch', '-12.50'],
    ['2026-01-02', 'Said "thanks"\nagain', '25'],
  ]);
  assert.deepEqual(result.inconsistentRowIndexes, []);
});

test('reports inconsistent row widths', () => {
  const result = parseCsv('a,b,c\n1,2\n3,4,5');
  assert.deepEqual(result.inconsistentRowIndexes, [1]);
});

test('rejects an unterminated quoted field', () => {
  assert.throws(() => parseCsv('a,b\n1,"broken'), /unterminated quoted field/);
});

test('Cash App preparation keeps only completed non-zero transactions', () => {
  const csv = [
    'date,Ref-num,type,subtotal,fee,amount,status,memo,counterparty,note',
    '2026-01-01,one,P2P,10,0,-10,COMPLETE,"Dinner, shared",Alex,Payment',
    '2026-01-02,two,Cash Card,20,0,-20,FAILED,Declined,Store,Card purchase',
    '2026-01-03,three,Account Notifications,0,0,0,COMPLETE,Notice,,Notice',
  ].join('\n');
  const prepared = prepareCsvImport(csv);
  assert.equal(prepared.profile, 'cash_app');
  assert.equal(prepared.rows.length, 2);
  assert.equal(prepared.excludedFailedRows, 1);
  assert.equal(prepared.excludedNonTransactionRows, 1);
  assert.equal(parseCsv(prepared.csvText).rows[1]?.[7], 'Dinner, shared');
});
