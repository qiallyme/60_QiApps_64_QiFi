import { ReceiptExtraction, Transaction } from '../types';

export interface ReceiptTransactionMatch {
  transaction: Transaction;
  score: number;
  reasons: string[];
}

function normalizedWords(value: string): string[] {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((word) => word.length > 1);
}

function merchantSimilarity(merchant: string, transaction: Transaction): number {
  const expected = new Set(normalizedWords(merchant));
  const actual = new Set(normalizedWords(`${transaction.counterparty} ${transaction.description} ${transaction.rawDescription}`));
  if (!expected.size) return 0;
  return [...expected].filter((word) => actual.has(word)).length / expected.size;
}

function daysBetween(left: string, right: string): number {
  const delta = Math.abs(new Date(`${left}T12:00:00Z`).getTime() - new Date(`${right}T12:00:00Z`).getTime());
  return Math.round(delta / 86_400_000);
}

export function rankReceiptTransactionMatches(extraction: ReceiptExtraction, transactions: Transaction[]): ReceiptTransactionMatch[] {
  const total = extraction.total?.value;
  const date = extraction.transactionDate?.value;
  const merchant = extraction.merchantName?.value;
  return transactions.map((transaction) => {
    let score = 0;
    const reasons: string[] = [];
    if (total != null) {
      const difference = Math.abs(Math.abs(transaction.amount) - total);
      if (difference < 0.005) { score += 0.55; reasons.push('exact amount'); }
      else if (difference <= Math.max(1, total * 0.02)) { score += 0.3; reasons.push('near amount'); }
    }
    if (date) {
      const days = daysBetween(date, transaction.date);
      if (days === 0) { score += 0.25; reasons.push('same date'); }
      else if (days <= 3) { score += 0.15; reasons.push(`${days} day date difference`); }
    }
    if (merchant) {
      const similarity = merchantSimilarity(merchant, transaction);
      score += similarity * 0.2;
      if (similarity >= 0.5) reasons.push('merchant text');
    }
    return { transaction, score: Math.min(score, 1), reasons };
  }).filter((match) => match.score >= 0.45).sort((a, b) => b.score - a.score).slice(0, 5);
}

export function isAmbiguousReceiptMatch(matches: ReceiptTransactionMatch[]): boolean {
  return matches.length > 1 && matches[0].score - matches[1].score < 0.1;
}
