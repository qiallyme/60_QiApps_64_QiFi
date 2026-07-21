/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useQiStore } from '../store';
import { Transaction, LedgerEntry } from '../types';
import { 
  Search, Filter, CheckCircle, AlertCircle, FileText, 
  HelpCircle, ChevronDown, ChevronUp, Trash2, Calendar, 
  ArrowUpRight, ArrowDownLeft, Tag, RefreshCw, Plus, X, Edit2,
  Download, Upload, WandSparkles
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import TransactionForm from './TransactionForm';
import { formatLocalDate, parseLocalDate, recurringOccurrences } from '../lib/financeMath';

export default function LedgerView() {
  const { 
    transactions, 
    accounts, 
    ledgerEntries, 
    attachments, 
    statements, 
    schedules, 
    getAccountBalance, 
    deleteTransaction,
    exportData,
    importData,
    financialAccounts,
    rules,
    addRule
  } = useQiStore();

  const { pathname } = useLocation();

  // Editing transaction state
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleBackup = () => {
    const dataStr = exportData();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qifi_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const success = importData(event.target.result as string);
          if (success) {
            alert("Backup restored successfully!");
          } else {
            alert("Failed to restore backup format.");
          }
        }
      };
      reader.readAsText(file);
    }
  };

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAccount, setFilterAccount] = useState('all');
  const [filterTag, setFilterTag] = useState('all');
  const [filterReconciled, setFilterReconciled] = useState('all'); // all, yes, no
  const [filterEvidence, setFilterEvidence] = useState('all'); // all, yes, no
  const [filterDateRange, setFilterDateRange] = useState('all'); // all, 30, 90, year
  
  // Quick Query State (Zen Solver)
  const [activeQuickQuery, setActiveQuickQuery] = useState<string | null>(null);
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

  // Manual transaction form state
  const [showAddForm, setShowAddForm] = useState(pathname === '/transactions/new');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (pathname === '/transactions/new') {
      setShowAddForm(true);
    }
  }, [pathname]);


  // Collect all unique tags
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    transactions.forEach(t => t.tags.forEach(tag => tagsSet.add(tag)));
    return Array.from(tagsSet);
  }, [transactions]);

  // Handle Quick queries calculation
  const quickQueryResults = useMemo(() => {
    if (!activeQuickQuery) return null;

    if (activeQuickQuery === 'mom') {
      // "How much did I send Mom?"
      const momTxs = transactions.filter(t => 
        t.counterparty.toLowerCase().includes('mom') || 
        t.description.toLowerCase().includes('mom') ||
        t.tags.includes('mom')
      );
      const totalSent = momTxs.reduce((sum, t) => sum + (t.amount < 0 ? Math.abs(t.amount) : 0), 0);
      const totalReceived = momTxs.reduce((sum, t) => sum + (t.amount > 0 ? t.amount : 0), 0);
      return {
        title: "Mom's Support Tracker",
        summary: `You sent Mom a total of $${totalSent.toLocaleString('en-US', { minimumFractionDigits: 2 })} and received $${totalReceived.toLocaleString('en-US', { minimumFractionDigits: 2 })}.`,
        transactions: momTxs
      };
    }

    if (activeQuickQuery === 'gift-vs-loan') {
      // "What was a gift vs a loan?"
      const momTxs = transactions.filter(t => 
        t.counterparty.toLowerCase().includes('mom') || 
        t.tags.includes('mom')
      );
      
      const gifts = momTxs.filter(t => {
        // Gift goes to gifts expense category
        const ledgers = ledgerEntries.filter(le => le.transactionId === t.id);
        return ledgers.some(le => le.accountId === 'expenses-gifts');
      });

      const loans = momTxs.filter(t => {
        // Loan goes to asset loan category
        const ledgers = ledgerEntries.filter(le => le.transactionId === t.id);
        return ledgers.some(le => le.accountId === 'assets-loans-mom');
      });

      const totalGift = gifts.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      const totalLoan = loans.reduce((sum, t) => sum + Math.abs(t.amount), 0);

      return {
        title: "Gifts vs. Loans Breakdown",
        summary: `Gifts total: $${totalGift.toLocaleString('en-US', { minimumFractionDigits: 2 })}. Loans total: $${totalLoan.toLocaleString('en-US', { minimumFractionDigits: 2 })}.`,
        details: [
          { label: 'Gifts (Non-repayable Support / Expense)', value: totalGift, count: gifts.length, txs: gifts },
          { label: 'Loans (Expected to be repaid)', value: totalLoan, count: loans.length, txs: loans }
        ]
      };
    }

    if (activeQuickQuery === 'missing-receipts') {
      // "What transactions are missing receipts?"
      const missing = transactions.filter(t => {
        const hasAttachment = attachments.some(a => a.transactionId === t.id);
        return !hasAttachment && t.amount < 0; // Outflows without receipt
      });
      const totalMissingAmount = missing.reduce((sum, t) => sum + Math.abs(t.amount), 0);
      return {
        title: "Transactions Missing Receipts",
        summary: `Found ${missing.length} expenses missing receipts, totaling $${totalMissingAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}.`,
        transactions: missing
      };
    }

    if (activeQuickQuery === 'unreconciled-statements') {
      // "Which statements are not reconciled?"
      const unreconciled = statements.filter(s => !s.isReconciled);
      return {
        title: "Unverified Bank Statements",
        summary: `${unreconciled.length} statement period(s) need matching to verify your transaction logs match actual bank statements.`,
        statements: unreconciled
      };
    }

    if (activeQuickQuery === 'forecast-30-60-90') {
      // "What bills are coming out in the next 30/60/90 days?"
      const today = new Date();
      const projectDate = (days: number) => {
        const d = new Date();
        d.setDate(today.getDate() + days);
        return d;
      };

      const days30 = projectDate(30);
      const days60 = projectDate(60);
      const days90 = projectDate(90);

      // We can generate schedules occurrences
      const billForecast = schedules.filter(s => s.amount < 0 && s.isActive).flatMap(sched => {
        const occurrences = recurringOccurrences(sched, days90);
        return occurrences.map(date => ({
          name: sched.name,
          amount: sched.amount,
          date: formatLocalDate(date),
          account: accounts.find(a => a.id === sched.accountId)?.name || 'Expense',
          source: accounts.find(a => a.id === sched.sourceAccountId)?.name || 'Checking',
          daysAway: Math.ceil((date.getTime() - today.getTime()) / (1000 * 3600 * 24))
        }));
      }).sort((a, b) => a.date.localeCompare(b.date));

      const bill30 = billForecast.filter(b => b.daysAway <= 30);
      const bill60 = billForecast.filter(b => b.daysAway > 30 && b.daysAway <= 60);
      const bill90 = billForecast.filter(b => b.daysAway > 60 && b.daysAway <= 90);

      const sum30 = bill30.reduce((sum, b) => sum + Math.abs(b.amount), 0);
      const sum60 = bill60.reduce((sum, b) => sum + Math.abs(b.amount), 0);
      const sum90 = bill90.reduce((sum, b) => sum + Math.abs(b.amount), 0);

      return {
        title: "Short-Term Bill Cash Flow Forecast (90 Days)",
        summary: `Expected bill payments: $${sum30.toLocaleString('en-US', { minimumFractionDigits: 2 })} next 30 days, $${sum60.toLocaleString('en-US', { minimumFractionDigits: 2 })} days 31-60, and $${sum90.toLocaleString('en-US', { minimumFractionDigits: 2 })} days 61-90.`,
        forecastGroups: [
          { title: "Next 30 Days Outflows", total: sum30, items: bill30 },
          { title: "Days 31 to 60 Outflows", total: sum60, items: bill60 },
          { title: "Days 61 to 90 Outflows", total: sum90, items: bill90 }
        ]
      };
    }

    if (activeQuickQuery === 'account-changes-month') {
      // "What accounts changed this month?"
      const now = new Date();
      const curMonth = formatLocalDate(now).slice(0, 7);
      const currentMonthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const monthLedgers = ledgerEntries.filter(le => le.date.startsWith(curMonth));
      
      const changes = accounts.map(acc => {
        let changeAmount = 0;
        monthLedgers.forEach(le => {
          if (le.accountId === acc.id) {
            if (['asset', 'expense', 'clearing', 'suspense'].includes(acc.type)) {
              changeAmount += le.debit - le.credit;
            } else {
              changeAmount += le.credit - le.debit;
            }
          }
        });
        return {
          account: acc,
          change: changeAmount
        };
      }).filter(c => Math.abs(c.change) > 0.01);

      return {
        title: `Account Balance Velocity (This Month - ${currentMonthLabel})`,
        summary: `A snapshot of ledger activity showing net increases or decreases across accounts for the current cycle.`,
        changes: changes
      };
    }

    return null;
  }, [activeQuickQuery, transactions, ledgerEntries, attachments, statements, schedules, accounts]);

  // Main Transaction Filtering & Search
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // 1. Search text
      const textMatch = 
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.rawDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.counterparty.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (!textMatch) return false;

      // 2. Filter account
      if (filterAccount !== 'all') {
        const isSource = t.sourceAccountId === filterAccount;
        // Or check if the target category matched
        const legs = ledgerEntries.filter(le => le.transactionId === t.id);
        const isLeg = legs.some(le => le.accountId === filterAccount);
        if (!isSource && !isLeg) return false;
      }

      // 3. Filter tag
      if (filterTag !== 'all' && !t.tags.includes(filterTag)) {
        return false;
      }

      // 4. Filter Reconciled
      if (filterReconciled !== 'all') {
        const isReconciled = !!t.reconciliationId;
        if (filterReconciled === 'yes' && !isReconciled) return false;
        if (filterReconciled === 'no' && isReconciled) return false;
      }

      // 5. Filter Evidence (Attachment)
      if (filterEvidence !== 'all') {
        const hasAttach = attachments.some(a => a.transactionId === t.id);
        if (filterEvidence === 'yes' && !hasAttach) return false;
        if (filterEvidence === 'no' && hasAttach) return false;
      }

      // 6. Date Range filter relative to today.
      if (filterDateRange !== 'all') {
        const txDate = parseLocalDate(t.date);
        const anchor = new Date();
        anchor.setHours(0, 0, 0, 0);
        const diffMs = anchor.getTime() - txDate.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 3600 * 24));
        if (diffDays < 0) return false;
        if (filterDateRange === '30' && diffDays > 30) return false;
        if (filterDateRange === '90' && diffDays > 90) return false;
      }

      return true;
    });
  }, [transactions, searchTerm, filterAccount, filterTag, filterReconciled, filterEvidence, filterDateRange, ledgerEntries, attachments]);

  return (
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white font-display" id="ledger-title">
            Double-Entry Money Ledger
          </h2>
          <p className="text-sm text-zinc-400 font-sans mt-1">
            Real posted transactions with robust balanced credit/debit posting.
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2.5 items-center">
          <button
            onClick={handleBackup}
            className="inline-flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 px-3.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all"
            title="Download full JSON database"
          >
            <Download size={13} /> Export Backup
          </button>
          
          <label className="inline-flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 px-3.5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all">
            <Upload size={13} /> Import Backup
            <input 
              type="file" 
              ref={fileInputRef}
              accept=".json" 
              className="hidden" 
              onChange={handleRestore} 
            />
          </label>

          <button
            onClick={() => { if (showAddForm) setEditingTxId(null); setShowAddForm(!showAddForm); }}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg hover:shadow-emerald-950/50 transition-all cursor-pointer border border-emerald-500/30 self-start sm:self-center"
            id="btn-add-manual"
          >
            {showAddForm ? <X size={16} /> : <Plus size={16} />}
            {showAddForm ? 'Close Editor' : 'Manual Ledger Post'}
          </button>
        </div>
      </div>

      {/* Create and edit share one schema, payload, dropdown set, and attachment workflow. */}
      {showAddForm && <div key={editingTxId || 'new'}><TransactionForm
        transaction={editingTxId ? transactions.find((transaction) => transaction.id === editingTxId) || null : null}
        categoryAccountId={editingTxId ? (() => {
          const transaction = transactions.find((item) => item.id === editingTxId);
          if (!transaction) return 'suspense-uncategorized';
          return ledgerEntries.find((entry) => entry.transactionId === transaction.id && entry.accountId !== transaction.sourceAccountId)?.accountId || 'suspense-uncategorized';
        })() : 'suspense-uncategorized'}
        onCancel={() => { setEditingTxId(null); setShowAddForm(false); }}
      /></div>}
      {/* ZEN SOLVER (QUICK ANSWERS PANEL) */}
      <div className="bg-amber-500/5 border border-amber-500/20 p-5 rounded-2xl shadow-xl">
        <h3 className="text-sm font-semibold text-amber-400 font-display flex items-center gap-2 mb-3">
          <HelpCircle className="text-amber-500" size={18} />
          Zen Financial Assistant — Click a question to ask about your money
        </h3>
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'mom', q: 'How much did I send Mom?' },
            { id: 'gift-vs-loan', q: 'What was a gift vs a loan?' },
            { id: 'missing-receipts', q: 'Which transactions are missing receipts?' },
            { id: 'unreconciled-statements', q: 'Which statements are not reconciled?' },
            { id: 'forecast-30-60-90', q: 'What bills are coming out in next 30/60/90 days?' },
            { id: 'account-changes-month', q: 'What accounts changed this month?' }
          ].map(qq => (
            <button
              key={qq.id}
              onClick={() => setActiveQuickQuery(activeQuickQuery === qq.id ? null : qq.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                activeQuickQuery === qq.id
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 shadow-md'
                  : 'bg-zinc-900/60 text-zinc-300 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-100'
              }`}
            >
              {qq.q}
            </button>
          ))}
        </div>

        {/* QUICK QUERY EXPANDED RESULTS */}
        {activeQuickQuery && quickQueryResults && (
          <div className="mt-4 p-4 bg-zinc-950/60 rounded-xl border border-amber-500/20 animate-fadeIn space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-zinc-200 text-sm font-display">{quickQueryResults.title}</h4>
              <button onClick={() => setActiveQuickQuery(null)} className="text-zinc-500 hover:text-zinc-300">
                <X size={14} />
              </button>
            </div>
            <p className="text-sm text-zinc-300 bg-amber-500/5 p-3 rounded-xl border border-amber-500/10 font-sans">
              {quickQueryResults.summary}
            </p>

            {/* List for generic results */}
            {quickQueryResults.transactions && (
              <div className="max-h-60 overflow-y-auto space-y-1 divide-y divide-zinc-800/40 pr-1">
                {quickQueryResults.transactions.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-2">No matching transactions found.</p>
                ) : (
                  quickQueryResults.transactions.map((t: Transaction) => (
                    <div key={t.id} className="flex justify-between items-center py-2 text-xs">
                      <div>
                        <div className="font-medium text-zinc-200">{t.description}</div>
                        <div className="text-zinc-400">{t.date} · via {accounts.find(a => a.id === t.sourceAccountId)?.name}</div>
                      </div>
                      <span className={`font-semibold ${t.amount < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {t.amount < 0 ? '-' : '+'}${Math.abs(t.amount).toFixed(2)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Structured details for Mom loan vs gift */}
            {quickQueryResults.details && (
              <div className="space-y-4">
                {quickQueryResults.details.map((g, idx) => (
                  <div key={idx} className="space-y-2 border-t border-zinc-800/60 pt-3 first:border-0 first:pt-0">
                    <div className="flex justify-between items-center text-xs font-semibold text-zinc-300">
                      <span>{g.label} ({g.count} tx)</span>
                      <span className="text-zinc-100">${g.value.toFixed(2)}</span>
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1 pl-3 border-l-2 border-zinc-800">
                      {g.txs.map((t: Transaction) => (
                        <div key={t.id} className="flex justify-between items-center py-1 text-xs">
                          <span className="text-zinc-400">{t.date} - {t.description}</span>
                          <span className="text-zinc-200 font-medium">${Math.abs(t.amount).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Statements results */}
            {quickQueryResults.statements && (
              <div className="space-y-2 text-xs">
                {quickQueryResults.statements.length === 0 ? (
                  <p className="text-zinc-500">Perfect! All statement cycles are reconciled.</p>
                ) : (
                  quickQueryResults.statements.map(s => (
                    <div key={s.id} className="p-3 bg-zinc-900/80 rounded-xl flex justify-between items-center border border-zinc-800/80">
                      <div>
                        <div className="font-medium text-zinc-200">{accounts.find(a => a.id === s.accountId)?.name}</div>
                        <div className="text-zinc-400">{s.startDate} to {s.endDate}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-zinc-300 text-sm">Variance: ${(s.closingBalance - s.openingBalance).toFixed(2)}</div>
                        <div className="text-amber-400 flex items-center gap-1 mt-0.5 justify-end">
                          <AlertCircle size={12} /> Pending Reconciliation
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Forecast groups */}
            {quickQueryResults.forecastGroups && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {quickQueryResults.forecastGroups.map((g, idx) => (
                  <div key={idx} className="bg-zinc-900/60 p-3 rounded-xl border border-zinc-800/80 space-y-2 text-xs">
                    <div className="flex justify-between items-center font-semibold text-zinc-300 border-b border-zinc-850 pb-1.5">
                      <span>{g.title}</span>
                      <span className="text-rose-400">${g.total.toFixed(2)}</span>
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {g.items.length === 0 ? (
                        <p className="text-zinc-500 py-2 italic text-center">No outflows</p>
                      ) : (
                        g.items.map((item, i) => (
                          <div key={i} className="text-[11px] leading-snug">
                            <div className="flex justify-between font-medium text-zinc-300">
                              <span className="truncate max-w-[110px]">{item.name}</span>
                              <span className="text-rose-400">${Math.abs(item.amount).toFixed(2)}</span>
                            </div>
                            <div className="text-zinc-500 flex justify-between">
                              <span>Due {item.date}</span>
                              <span className="font-medium text-zinc-400">({item.daysAway}d away)</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Account Changes month */}
            {quickQueryResults.changes && (
              <div className="space-y-2 text-xs max-h-60 overflow-y-auto divide-y divide-zinc-800/40">
                {quickQueryResults.changes.map((c, i) => (
                  <div key={i} className="flex justify-between items-center py-2 first:pt-0">
                    <div>
                      <div className="font-semibold text-zinc-200">{c.account.name}</div>
                      <div className="text-zinc-500 uppercase text-[9px] tracking-wider">{c.account.type}</div>
                    </div>
                    <div className={`font-semibold ${
                      c.change > 0 
                        ? 'text-emerald-400'
                        : 'text-rose-400'
                    }`}>
                      {c.change > 0 ? '+' : ''}${c.change.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* FILTER CONTROLS */}
      <div className="bg-zinc-900/40 p-4 rounded-2xl border border-zinc-800/80 shadow-xl backdrop-blur-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          {/* Search Box */}
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" size={16} />
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-emerald-500/20"
            />
          </div>

          {/* Account Filter */}
          <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
              <Filter size={14} />
              Filters:
            </div>
            
            {/* Account Select */}
            <select
              value={filterAccount}
              onChange={e => setFilterAccount(e.target.value)}
              className="bg-zinc-950/80 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 font-medium focus:outline-none focus:border-zinc-700"
            >
              <option value="all">All Accounts</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>

            {/* Tag Select */}
            <select
              value={filterTag}
              onChange={e => setFilterTag(e.target.value)}
              className="bg-zinc-950/80 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 font-medium focus:outline-none focus:border-zinc-700"
            >
              <option value="all">All Tags</option>
              {allTags.map(tag => (
                <option key={tag} value={tag}>#{tag}</option>
              ))}
            </select>

            {/* Reconciled Select */}
            <select
              value={filterReconciled}
              onChange={e => setFilterReconciled(e.target.value)}
              className="bg-zinc-950/80 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 font-medium focus:outline-none focus:border-zinc-700"
            >
              <option value="all">Matching: All</option>
              <option value="yes">Verified Matches Only</option>
              <option value="no">Unverified Only</option>
            </select>

            {/* Evidence Select */}
            <select
              value={filterEvidence}
              onChange={e => setFilterEvidence(e.target.value)}
              className="bg-zinc-950/80 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 font-medium focus:outline-none focus:border-zinc-700"
            >
              <option value="all">Receipts: All</option>
              <option value="yes">Has Receipt</option>
              <option value="no">Missing Receipt</option>
            </select>

            {/* Date Select */}
            <select
              value={filterDateRange}
              onChange={e => setFilterDateRange(e.target.value)}
              className="bg-zinc-950/80 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 font-medium focus:outline-none focus:border-zinc-700"
            >
              <option value="all">Date: All time</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
            </select>
          </div>
        </div>
      </div>

      {/* LEDGER ENTRIES LIST */}
      <div className="bg-zinc-900/40 rounded-2xl border border-zinc-800/80 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800/80 flex justify-between items-center bg-zinc-900/80">
          <span className="font-bold text-zinc-200 text-sm font-display">
            My Transactions Log ({filteredTransactions.length} Items)
          </span>
          <span className="text-xs text-zinc-500 font-mono">
            Fully Accounted & Balanced
          </span>
        </div>

        {filteredTransactions.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-zinc-500 text-sm">No transactions match your query filters.</p>
            <button 
              onClick={() => {
                setSearchTerm('');
                setFilterAccount('all');
                setFilterTag('all');
                setFilterReconciled('all');
                setFilterEvidence('all');
                setFilterDateRange('all');
              }}
              className="mt-3 text-xs font-semibold text-amber-400 hover:text-amber-300 hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/40">
            {filteredTransactions.map((tx: Transaction) => {
              const isExpanded = expandedTxId === tx.id;
              const hasReceipt = attachments.some(a => a.transactionId === tx.id);
              const txLedgers = ledgerEntries.filter(le => le.transactionId === tx.id);
              const srcAccount = accounts.find(a => a.id === tx.sourceAccountId);
              const sourceFinancialAccount = financialAccounts.find(account => account.id === (tx.financialAccountId || tx.sourceAccountId));
              const categoryLine = txLedgers.find(line => line.accountId !== sourceFinancialAccount?.defaultLedgerAccountId);
              const suggestedPattern = (tx.counterparty || tx.description).trim().toLowerCase().split(/\s+/).slice(0, 3).join(' ');
              const matchingRule = rules.some(rule => rule.pattern.toLowerCase() === suggestedPattern);

              return (
                <div key={tx.id} className="transition-all hover:bg-zinc-900/30">
                  {/* Ledger Header Row */}
                  <div 
                    onClick={() => setExpandedTxId(isExpanded ? null : tx.id)}
                    className="px-5 py-3.5 flex items-center justify-between gap-4 cursor-pointer text-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Flow Indicator Icon */}
                      <div className={`p-2 rounded-xl shrink-0 ${
                        tx.amount < 0 
                          ? 'bg-rose-950/30 text-rose-400 border border-rose-900/30' 
                          : 'bg-emerald-950/30 text-emerald-400 border border-emerald-900/30'
                      }`}>
                        {tx.amount < 0 ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                      </div>

                      {/* Merchant, Date and Source Account */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-zinc-100 truncate">{tx.counterparty}</span>
                          {tx.reconciliationId && (
                            <span className="inline-flex items-center gap-0.5 bg-emerald-950/30 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 border border-emerald-900/30">
                              <CheckCircle size={10} /> Reconciled
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-400 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                          <span>{tx.date}</span>
                          <span>•</span>
                          <span className="font-medium text-zinc-300">{tx.description}</span>
                          <span>•</span>
                          <span className="text-zinc-400 font-mono text-[10px] bg-zinc-800/60 px-1 py-0.2 rounded border border-zinc-700/30">{srcAccount?.name}</span>
                        </div>
                      </div>
                    </div>

                    {/* Tags, Evidence Icon and Amount */}
                    <div className="flex items-center gap-4 shrink-0">
                      {/* Tags (Desktop only) */}
                      <div className="hidden sm:flex items-center gap-1">
                        {tx.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="bg-zinc-800/40 text-zinc-300 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-0.5 border border-zinc-700/20">
                            <Tag size={8} /> {tag}
                          </span>
                        ))}
                        {tx.tags.length > 2 && (
                          <span className="text-zinc-500 text-[9px]">+{tx.tags.length - 2}</span>
                        )}
                      </div>

                      {/* Evidence Icon indicator */}
                      <div className="text-zinc-500">
                        {hasReceipt ? (
                          <FileText size={16} className="text-emerald-400" title="Has Attachment" />
                        ) : (
                          <AlertCircle size={16} className="text-amber-400" title="Missing Receipt" />
                        )}
                      </div>

                      {/* Amount */}
                      <div className="text-right min-w-[70px]">
                        <span className={`font-semibold font-mono ${tx.amount < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {tx.amount < 0 ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
                        </span>
                      </div>

                      {/* Toggle Chevron */}
                      <div className="text-zinc-500">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Double Entry Account Ledgers (Balanced Debits & Credits) */}
                  {isExpanded && (
                    <div className="px-5 pb-4 pt-1 bg-zinc-950/60 border-t border-dashed border-zinc-800/60 animate-fadeIn space-y-3">
                      {!matchingRule && suggestedPattern && categoryLine && <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-violet-500/20 bg-violet-500/5 p-3"><div><p className="text-xs font-bold text-violet-300 flex items-center gap-1.5"><WandSparkles size={13}/>Suggested rule</p><p className="text-[10px] text-zinc-500">Match “{suggestedPattern}” to {accounts.find(account => account.id === categoryLine.accountId)?.name || categoryLine.accountId}. You can edit it later in Category Rules.</p></div><button onClick={(event) => { event.stopPropagation(); addRule({ pattern: suggestedPattern, suggestedAccountId: categoryLine.accountId, suggestedTags: tx.tags, suggestedCounterparty: tx.counterparty, description: `Suggested from ${tx.description}` }); }} className="rounded-lg bg-violet-500/15 border border-violet-500/30 px-3 py-1.5 text-[10px] font-bold text-violet-300">Add rule</button></div>}
                      {/* Double Entry Ledger Details */}
                      <div className="rounded-xl border border-zinc-850 bg-zinc-900/40 overflow-hidden max-w-3xl">
                        <div className="px-3 py-1.5 bg-zinc-900 text-[10px] font-bold text-zinc-400 uppercase tracking-wider grid grid-cols-12 gap-2 border-b border-zinc-850">
                          <div className="col-span-6">Category Affected</div>
                          <div className="col-span-3 text-right">Increase (+)</div>
                          <div className="col-span-3 text-right">Decrease (-)</div>
                        </div>
                        <div className="divide-y divide-zinc-800/40">
                          {txLedgers.map((le: LedgerEntry) => {
                            const leAcc = accounts.find(a => a.id === le.accountId);
                            return (
                              <div key={le.id} className="px-3 py-2 text-xs grid grid-cols-12 gap-2 text-zinc-300">
                                <div className="col-span-6 flex items-center gap-1.5">
                                  <span className="font-mono text-[10px] bg-zinc-800 text-zinc-400 px-1 rounded border border-zinc-700/30">{leAcc?.code}</span>
                                  <span className="font-semibold">{leAcc?.name}</span>
                                  <span className="text-[10px] text-zinc-500 uppercase">({leAcc?.type})</span>
                                </div>
                                <div className="col-span-3 text-right font-mono font-medium text-zinc-300">
                                  {le.debit > 0 ? `$${le.debit.toFixed(2)}` : '—'}
                                </div>
                                <div className="col-span-3 text-right font-mono font-medium text-zinc-300">
                                  {le.credit > 0 ? `$${le.credit.toFixed(2)}` : '—'}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        {/* Summary total validation row */}
                        <div className="px-3 py-1.5 bg-zinc-950/60 text-[10px] font-semibold text-zinc-400 grid grid-cols-12 gap-2 border-t border-zinc-850">
                          <div className="col-span-6 text-right">Balanced Total:</div>
                          <div className="col-span-3 text-right font-mono text-emerald-400 font-bold">
                            ${txLedgers.reduce((sum, le) => sum + le.debit, 0).toFixed(2)}
                          </div>
                          <div className="col-span-3 text-right font-mono text-emerald-400 font-bold">
                            ${txLedgers.reduce((sum, le) => sum + le.credit, 0).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* Transaction Management Controls */}
                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-400">
                        {/* Meta */}
                        <div>
                          <span>Posted on: <span className="font-medium text-zinc-300">{new Date(tx.createdAt).toLocaleString()}</span></span>
                          {tx.rawDescription && tx.rawDescription !== tx.description && (
                            <span className="ml-3 italic">Raw Bank String: <span className="font-mono text-[11px] text-zinc-500">{tx.rawDescription}</span></span>
                          )}
                        </div>

                        {/* Delete Entry with Inline Confirmation to Bypass Iframe Sandbox Popup Blocking */}
                        {confirmDeleteId === tx.id ? (
                          <div className="flex items-center gap-2 bg-rose-950/20 px-3 py-1.5 rounded-xl border border-rose-500/20 text-xs">
                            <span className="text-rose-400 font-medium">Void transaction permanently?</span>
                            <button
                              onClick={() => {
                                deleteTransaction(tx.id);
                                setConfirmDeleteId(null);
                              }}
                              className="text-white bg-rose-600 hover:bg-rose-500 font-bold px-2.5 py-1 rounded-lg cursor-pointer transition-colors"
                            >
                              Yes, Void
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-zinc-400 hover:text-zinc-200 font-medium px-2 py-1 rounded-lg cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-4">
                            <button
                              onClick={() => {
                                setEditingTxId(tx.id);
                                setShowAddForm(true);
                                window.scrollTo({ top: 0, behavior: 'smooth' });
                              }}
                              className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer py-1"
                            >
                              <Edit2 size={13} /> Edit Transaction
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(tx.id)}
                              className="inline-flex items-center gap-1.5 text-red-400 hover:text-red-300 font-semibold cursor-pointer py-1"
                            >
                              <Trash2 size={13} /> Void Ledger Transaction
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
