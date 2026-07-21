export interface CsvParseResult {
  rows: string[][];
  expectedColumns: number;
  inconsistentRowIndexes: number[];
}

export interface PreparedCsvImport extends CsvParseResult {
  csvText: string;
  profile: 'cash_app' | 'generic';
  excludedFailedRows: number;
  excludedNonTransactionRows: number;
}

function serializeCsv(rows: string[][]): string {
  return rows.map(row => row.map(cell => {
    const escaped = cell.replaceAll('"', '""');
    return /[",\r\n]/.test(cell) ? `"${escaped}"` : escaped;
  }).join(',')).join('\r\n');
}

export function parseCsv(rawText: string): CsvParseResult {
  const text = rawText.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
    } else if (character === '"') {
      inQuotes = !inQuotes;
    } else if (character === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
    } else if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && next === '\n') index += 1;
      row.push(current.trim());
      if (row.some(cell => cell.length > 0)) rows.push(row);
      row = [];
      current = '';
    } else {
      current += character;
    }
  }

  if (inQuotes) throw new Error('CSV contains an unterminated quoted field.');
  row.push(current.trim());
  if (row.some(cell => cell.length > 0)) rows.push(row);

  const expectedColumns = rows[0]?.length || 0;
  const inconsistentRowIndexes = rows
    .map((cells, index) => ({ cells, index }))
    .filter(({ cells }) => cells.length !== expectedColumns)
    .map(({ index }) => index);

  return { rows, expectedColumns, inconsistentRowIndexes };
}

export function prepareCsvImport(rawText: string): PreparedCsvImport {
  const parsed = parseCsv(rawText);
  const headers = (parsed.rows[0] || []).map(header => header.trim().toLowerCase());
  const requiredCashAppHeaders = ['date', 'ref-num', 'type', 'amount', 'status', 'memo', 'note'];
  const isCashApp = requiredCashAppHeaders.every(header => headers.includes(header));
  if (!isCashApp) {
    return { ...parsed, csvText: rawText, profile: 'generic', excludedFailedRows: 0, excludedNonTransactionRows: 0 };
  }

  const statusIndex = headers.indexOf('status');
  const amountIndex = headers.indexOf('amount');
  let excludedFailedRows = 0;
  let excludedNonTransactionRows = 0;
  const eligibleRows = parsed.rows.slice(1).filter(row => {
    if ((row[statusIndex] || '').trim().toUpperCase() !== 'COMPLETE') {
      excludedFailedRows += 1;
      return false;
    }
    const amount = Number((row[amountIndex] || '').replace(/[$,\s]/g, ''));
    if (!Number.isFinite(amount) || amount === 0) {
      excludedNonTransactionRows += 1;
      return false;
    }
    return true;
  });
  const rows = [parsed.rows[0] || [], ...eligibleRows];
  return {
    rows,
    expectedColumns: parsed.expectedColumns,
    inconsistentRowIndexes: parsed.inconsistentRowIndexes,
    csvText: serializeCsv(rows),
    profile: 'cash_app',
    excludedFailedRows,
    excludedNonTransactionRows,
  };
}
