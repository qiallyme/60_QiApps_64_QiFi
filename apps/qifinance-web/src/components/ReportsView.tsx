/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useQiStore } from '../store';
import { Transaction, Attachment } from '../types';
import { 
  TrendingUp, ArrowUpRight, ArrowDownLeft, Calendar, FileText, 
  Percent, Wallet, CheckCircle, ShieldAlert, Sparkles, PieChart,
  User, Search, Filter, Printer, Download, Eye, Tag, ArrowRight, X, Image as ImageIcon
} from 'lucide-react';

type ReportTab = 'p&l' | 'pnl-counterparty' | 'biz-vs-pers' | 'tax' | 'custom-builder';

export default function ReportsView() {
  const [activeReportTab, setActiveReportTab] = useState<ReportTab>('p&l');
  const { transactions, accounts, ledgerEntries, attachments, getAccountBalance } = useQiStore();

  // Print Mode State (renders the high-contrast paper layout overlay)
  const [printModeActive, setPrintModeActive] = useState(false);
  const [printReportTitle, setPrintReportTitle] = useState('Operating Expense Report');
  const [printPreparedFor, setPrintPreparedFor] = useState('Finance Operations & Tax Audit');

  // Custom Builder Filters State
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterAccountId, setFilterAccountId] = useState('all');
  const [filterCounterparty, setFilterCounterparty] = useState('all');
  const [filterTag, setFilterTag] = useState('all');
  const [filterMinAmount, setFilterMinAmount] = useState('');
  const [filterMaxAmount, setFilterMaxAmount] = useState('');

  // 1. STANDARD INCOME STATEMENT (P&L) FOR BUSINESS
  const pnlReport = useMemo(() => {
    const revenueAccs = accounts.filter(a => a.type === 'revenue' && a.id !== 'suspense-uncategorized');
    const businessExpenseAccs = accounts.filter(a => 
      a.type === 'expense' && 
      !['expenses-groceries', 'expenses-gifts'].includes(a.id)
    );

    const revenueLines = revenueAccs.map(a => ({
      name: a.name,
      code: a.code,
      balance: getAccountBalance(a.id)
    }));

    const expenseLines = businessExpenseAccs.map(a => ({
      name: a.name,
      code: a.code,
      balance: getAccountBalance(a.id)
    }));

    const totalRevenue = revenueLines.reduce((sum, l) => sum + l.balance, 0);
    const totalExpenses = expenseLines.reduce((sum, l) => sum + l.balance, 0);
    const netProfit = totalRevenue - totalExpenses;

    return {
      revenue: totalRevenue,
      expenses: totalExpenses,
      netProfit,
      revenueLines,
      expenseLines: expenseLines.filter(e => e.balance > 0)
    };
  }, [accounts, getAccountBalance]);

  // 2. PROFIT & LOSS (REVENUE/EXPENSE) BY COUNTERPARTY
  const pnlByCounterparty = useMemo(() => {
    const counterpartyData: Record<string, {
      counterparty: string;
      revenue: number;
      expenses: number;
      net: number;
      txCount: number;
    }> = {};

    transactions.forEach(tx => {
      const cp = tx.counterparty || 'Unassigned Merchant';
      if (!counterpartyData[cp]) {
        counterpartyData[cp] = {
          counterparty: cp,
          revenue: 0,
          expenses: 0,
          net: 0,
          txCount: 0
        };
      }
      
      counterpartyData[cp].txCount += 1;

      // Scan dual-entry ledger postings for income or expense codes
      const entries = ledgerEntries.filter(le => le.transactionId === tx.id);
      entries.forEach(le => {
        const acc = accounts.find(a => a.id === le.accountId);
        if (!acc) return;
        
        if (acc.type === 'revenue') {
          counterpartyData[cp].revenue += le.credit;
          counterpartyData[cp].net += le.credit;
        } else if (acc.type === 'expense') {
          counterpartyData[cp].expenses += le.debit;
          counterpartyData[cp].net -= le.debit;
        }
      });
    });

    return Object.values(counterpartyData)
      .filter(item => item.revenue > 0 || item.expenses > 0)
      .sort((a, b) => b.net - a.net);
  }, [transactions, ledgerEntries, accounts]);

  // 3. MIXED MONEY SPLIT AUDIT
  const businessVsPersonal = useMemo(() => {
    const expenseAccs = accounts.filter(a => a.type === 'expense');
    const bizAccs = expenseAccs.filter(a => !['expenses-groceries', 'expenses-gifts'].includes(a.id));
    const persAccs = expenseAccs.filter(a => ['expenses-groceries', 'expenses-gifts'].includes(a.id));

    const bizSpent = bizAccs.reduce((sum, a) => sum + getAccountBalance(a.id), 0);
    const persSpent = persAccs.reduce((sum, a) => sum + getAccountBalance(a.id), 0);
    const totalSpent = bizSpent + persSpent;

    const bizPct = totalSpent > 0 ? (bizSpent / totalSpent) * 100 : 0;
    const persPct = totalSpent > 0 ? (persSpent / totalSpent) * 100 : 0;

    return {
      bizSpent,
      persSpent,
      totalSpent,
      bizPct,
      persPct
    };
  }, [accounts, getAccountBalance]);

  // 4. TAX PREPAREDNESS METRICS
  const taxReport = useMemo(() => {
    const taxReserve = getAccountBalance('assets-savings');
    const bizRevenue = getAccountBalance('revenue-consulting');
    const bizExp = accounts
      .filter(a => a.type === 'expense' && !['expenses-groceries', 'expenses-gifts'].includes(a.id))
      .reduce((sum, a) => sum + getAccountBalance(a.id), 0);
    
    const taxableIncome = Math.max(0, bizRevenue - bizExp);
    const estTaxRate = 0.25;
    const projectedTaxLiability = taxableIncome * estTaxRate;
    const surplusOrDeficit = taxReserve - projectedTaxLiability;
    const isPrepared = surplusOrDeficit >= 0;

    return {
      taxReserve,
      taxableIncome,
      projectedTaxLiability,
      surplusOrDeficit,
      isPrepared,
      estTaxRate
    };
  }, [accounts, getAccountBalance]);

  // Dynamic values for builder selection filters
  const uniqueTagsList = useMemo(() => {
    const tagsSet = new Set<string>();
    transactions.forEach(t => t.tags.forEach(tag => tagsSet.add(tag)));
    return Array.from(tagsSet).sort();
  }, [transactions]);

  const uniqueCounterpartiesList = useMemo(() => {
    const cpSet = new Set<string>();
    transactions.forEach(t => {
      if (t.counterparty) cpSet.add(t.counterparty);
    });
    return Array.from(cpSet).sort();
  }, [transactions]);

  // 5. CUSTOM BUILDER DYNAMIC FILTERING ENGINE
  const filteredBuilderTransactions = useMemo(() => {
    return transactions.filter(t => {
      // Date start limit
      if (filterStartDate && t.date < filterStartDate) return false;
      // Date end limit
      if (filterEndDate && t.date > filterEndDate) return false;
      
      // Account code/id mapping search (check ledger entry mapping for exact categories)
      if (filterAccountId !== 'all') {
        const matchingEntries = ledgerEntries.filter(le => le.transactionId === t.id);
        const usesAccount = matchingEntries.some(le => le.accountId === filterAccountId);
        if (!usesAccount) return false;
      }

      // Counterparty
      if (filterCounterparty !== 'all' && t.counterparty !== filterCounterparty) return false;

      // Tag
      if (filterTag !== 'all' && !t.tags.includes(filterTag)) return false;

      // Min Amount threshold
      if (filterMinAmount) {
        const minVal = parseFloat(filterMinAmount);
        if (!isNaN(minVal) && Math.abs(t.amount) < minVal) return false;
      }

      // Max Amount threshold
      if (filterMaxAmount) {
        const maxVal = parseFloat(filterMaxAmount);
        if (!isNaN(maxVal) && Math.abs(t.amount) > maxVal) return false;
      }

      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, ledgerEntries, filterStartDate, filterEndDate, filterAccountId, filterCounterparty, filterTag, filterMinAmount, filterMaxAmount]);

  // Stats for filtered builder data
  const builderStats = useMemo(() => {
    let totalInflows = 0;
    let totalOutflows = 0;
    let documentedExpenses = 0;

    filteredBuilderTransactions.forEach(tx => {
      if (tx.amount > 0) {
        totalInflows += tx.amount;
      } else {
        totalOutflows += Math.abs(tx.amount);
        const hasReceipt = attachments.some(a => a.transactionId === tx.id);
        if (hasReceipt) documentedExpenses += Math.abs(tx.amount);
      }
    });

    const netCashflow = totalInflows - totalOutflows;

    return {
      count: filteredBuilderTransactions.length,
      totalInflows,
      totalOutflows,
      netCashflow,
      documentedExpenses
    };
  }, [filteredBuilderTransactions, attachments]);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white font-display flex items-center gap-2" id="reports-title">
          <TrendingUp className="text-emerald-400" size={24} />
          Financial Intelligence & Reports
        </h2>
        <p className="text-sm text-zinc-400 font-sans mt-0.5">
          Trace operating margins, analyze mixed money overlaps, audit tax readiness, and generate printable expense reports.
        </p>
      </div>

      {/* Report selector tabs */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-3" id="reports-tabs">
        <button
          onClick={() => setActiveReportTab('p&l')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-tight transition-all cursor-pointer flex items-center gap-1.5 ${
            activeReportTab === 'p&l' 
              ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/30 shadow-md' 
              : 'hover:bg-zinc-800/30 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <FileText size={14} /> P&L Statement
        </button>

        <button
          onClick={() => setActiveReportTab('pnl-counterparty')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-tight transition-all cursor-pointer flex items-center gap-1.5 ${
            activeReportTab === 'pnl-counterparty' 
              ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/30 shadow-md' 
              : 'hover:bg-zinc-800/30 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <User size={14} /> P&L by Counterparty
        </button>

        <button
          onClick={() => setActiveReportTab('biz-vs-pers')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-tight transition-all cursor-pointer flex items-center gap-1.5 ${
            activeReportTab === 'biz-vs-pers' 
              ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/30 shadow-md' 
              : 'hover:bg-zinc-800/30 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <PieChart size={14} /> Business vs Personal
        </button>

        <button
          onClick={() => setActiveReportTab('tax')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold tracking-tight transition-all cursor-pointer flex items-center gap-1.5 ${
            activeReportTab === 'tax' 
              ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/30 shadow-md' 
              : 'hover:bg-zinc-800/30 text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Wallet size={14} /> Tax Reserves
        </button>

        <button
          onClick={() => setActiveReportTab('custom-builder')}
          className={`px-4 py-2 rounded-xl text-xs font-bold tracking-tight transition-all cursor-pointer flex items-center gap-1.5 ${
            activeReportTab === 'custom-builder' 
              ? 'bg-emerald-600/90 hover:bg-emerald-600 text-white shadow-md' 
              : 'hover:bg-emerald-600/10 text-emerald-400 border border-emerald-500/15'
          }`}
        >
          <Filter size={14} /> Custom Report Builder
        </button>
      </div>

      {/* REPORT CONTENT VIEW */}
      <div className="animate-fadeIn">
        
        {/* 1. STANDARD P&L STATEMENT */}
        {activeReportTab === 'p&l' && (
          <div className="space-y-6">
            <div className="bg-zinc-900/40 border border-zinc-800/80 p-6 rounded-2xl space-y-6 backdrop-blur-sm">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100 uppercase font-mono tracking-wider">Business Profit & Loss</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">Excludes personal living costs (groceries, gifts, custom support)</p>
                </div>
                <div className="bg-zinc-950/40 border border-zinc-800 px-4 py-2 rounded-xl text-right">
                  <span className="text-[10px] uppercase font-bold text-zinc-500 block font-mono">Net Operating Income</span>
                  <span className={`text-base font-bold font-mono ${pnlReport.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ${pnlReport.netProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {/* Revenue Section */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center border-b border-zinc-800/80 pb-1.5">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Operating Revenues</span>
                    <span className="text-xs font-bold text-emerald-400 font-mono">
                      ${pnlReport.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {pnlReport.revenueLines.map(line => (
                    <div key={line.code} className="flex justify-between text-xs text-zinc-300 pl-3">
                      <span>{line.name} ({line.code})</span>
                      <span className="font-mono text-zinc-400">${line.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>

                {/* Operating Expenses Section */}
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between items-center border-b border-zinc-800/80 pb-1.5">
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-wide">Operating Expenses</span>
                    <span className="text-xs font-bold text-rose-400/90 font-mono">
                      -${pnlReport.expenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {pnlReport.expenseLines.length === 0 ? (
                    <p className="text-xs text-zinc-500 pl-3">No recorded business expenses in this period.</p>
                  ) : (
                    pnlReport.expenseLines.map(line => (
                      <div key={line.code} className="flex justify-between text-xs text-zinc-300 pl-3">
                        <span>{line.name} ({line.code})</span>
                        <span className="font-mono text-zinc-400">${line.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>
                    ))
                  )}
                </div>

                {/* Summary Profit margin */}
                <div className="pt-4 border-t border-zinc-800 flex justify-between items-center text-xs">
                  <span className="text-zinc-400">Operating Profit Margin</span>
                  <span className="font-semibold text-zinc-200">
                    {pnlReport.revenue > 0 
                      ? `${((pnlReport.netProfit / pnlReport.revenue) * 100).toFixed(1)}%` 
                      : '0.0%'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. P&L BY COUNTERPARTY */}
        {activeReportTab === 'pnl-counterparty' && (
          <div className="bg-zinc-900/40 border border-zinc-800/80 p-6 rounded-2xl space-y-6 backdrop-blur-sm" id="pnl-counterparty-section">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 uppercase font-mono tracking-wider">P&L Broken Down by Client & Merchant</h3>
              <p className="text-xs text-zinc-500 mt-0.5">Aggregated revenues (consulting) and operating expenses grouped by normalized counterparty labels.</p>
            </div>

            <div className="bg-zinc-950/20 rounded-xl border border-zinc-800/60 overflow-hidden">
              <table className="w-full text-xs text-zinc-300 border-collapse">
                <thead>
                  <tr className="bg-zinc-950 font-mono text-[10px] text-zinc-400 uppercase tracking-wider border-b border-zinc-800 text-left">
                    <th className="py-3 px-4">Counterparty / Entity</th>
                    <th className="py-3 px-4 text-center">Volume</th>
                    <th className="py-3 px-4 text-right">Revenue (Credits)</th>
                    <th className="py-3 px-4 text-right">Expense (Debits)</th>
                    <th className="py-3 px-4 text-right">Net Impact</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {pnlByCounterparty.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-zinc-500 font-medium">No postings found. Approve raw rows to start matching counterparties.</td>
                    </tr>
                  ) : (
                    pnlByCounterparty.map(item => (
                      <tr key={item.counterparty} className="hover:bg-zinc-900/30 transition-all">
                        <td className="py-3.5 px-4 font-semibold text-zinc-100">{item.counterparty}</td>
                        <td className="py-3.5 px-4 text-center text-zinc-400 font-mono text-[11px]">{item.txCount} txs</td>
                        <td className="py-3.5 px-4 text-right text-emerald-400 font-mono font-medium">
                          {item.revenue > 0 ? `$${item.revenue.toFixed(2)}` : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right text-rose-400/90 font-mono font-medium">
                          {item.expenses > 0 ? `-$${item.expenses.toFixed(2)}` : '—'}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold">
                          <span className={item.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {item.net >= 0 ? '+' : '-'}${Math.abs(item.net).toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. BUSINESS VS PERSONAL SPLIT AUDIT */}
        {activeReportTab === 'biz-vs-pers' && (
          <div className="bg-zinc-900/40 border border-zinc-800/80 p-6 rounded-2xl space-y-6 backdrop-blur-sm">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 uppercase font-mono tracking-wider flex items-center gap-1.5">
                <Sparkles size={16} className="text-emerald-400" />
                Mixed Money Split Audit
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">Visualize how much spent on personal survival vs. business operations from your unified financial universe.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div className="space-y-4">
                <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-800/50">
                  <span className="text-[10px] text-zinc-500 uppercase block font-mono font-bold">Total Operating Outflows</span>
                  <span className="text-xl font-bold font-mono text-zinc-100 block">
                    ${businessVsPersonal.totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-800/50">
                  <span className="text-[10px] text-zinc-500 uppercase block font-mono font-bold">Business Expense</span>
                  <span className="text-base font-bold font-mono text-zinc-200 block">
                    ${businessVsPersonal.bizSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({businessVsPersonal.bizPct.toFixed(1)}%)
                  </span>
                </div>

                <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-800/50">
                  <span className="text-[10px] text-zinc-500 uppercase block font-mono font-bold">Personal Spending</span>
                  <span className="text-base font-bold font-mono text-zinc-200 block">
                    ${businessVsPersonal.persSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })} ({businessVsPersonal.persPct.toFixed(1)}%)
                  </span>
                </div>
              </div>

              {/* Chart Visualizer */}
              <div className="md:col-span-2 flex flex-col items-center justify-center p-4 bg-zinc-950/20 border border-zinc-800/50 rounded-2xl h-64">
                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mb-4">Outflow Distribution Graph</span>
                {businessVsPersonal.totalSpent === 0 ? (
                  <p className="text-xs text-zinc-600">No recorded outflows to display.</p>
                ) : (
                  <div className="w-full max-w-sm space-y-6">
                    <div className="h-6 rounded-full w-full bg-zinc-800 overflow-hidden flex shadow-inner">
                      <div 
                        style={{ width: `${businessVsPersonal.bizPct}%` }} 
                        className="bg-emerald-500 transition-all duration-500"
                      />
                      <div 
                        style={{ width: `${businessVsPersonal.persPct}%` }} 
                        className="bg-purple-600 transition-all duration-500"
                      />
                    </div>

                    <div className="flex justify-between text-xs font-medium">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded bg-emerald-500" />
                        <div>
                          <span className="text-zinc-200 font-bold block">Business Operations</span>
                          <span className="text-[10px] text-zinc-500">Office space, SaaS, Consulting, Marketing</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-right">
                        <div className="h-3 w-3 rounded bg-purple-600" />
                        <div>
                          <span className="text-zinc-200 font-bold block">Personal Spending</span>
                          <span className="text-[10px] text-zinc-500">Groceries, Gifts, Family support</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 4. TAX RESERVE READINESS */}
        {activeReportTab === 'tax' && (
          <div className="bg-zinc-900/40 border border-zinc-800/80 p-6 rounded-2xl space-y-6 backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100 uppercase font-mono tracking-wider">Tax Reserve Readiness</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Auditing whether your Tax Savings reserve is prepared to meet estimated quarterly tax obligations.</p>
              </div>
              <div>
                {taxReport.isPrepared ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/20">
                    <CheckCircle size={14} /> Tax Reserves Prepared
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20">
                    <ShieldAlert size={14} /> Reserve Deficit Alert
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
              <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-800/50">
                <span className="text-[10px] text-zinc-500 uppercase block font-mono font-bold">Taxable Business Income</span>
                <span className="text-xl font-bold font-mono text-zinc-100 block">
                  ${taxReport.taxableIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-800/50">
                <span className="text-[10px] text-zinc-500 uppercase block font-mono font-bold">Projected Tax Liability ({taxReport.estTaxRate * 100}%)</span>
                <span className="text-xl font-bold font-mono text-amber-500 block">
                  ${taxReport.projectedTaxLiability.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-800/50">
                <span className="text-[10px] text-zinc-500 uppercase block font-mono font-bold">Current Tax Savings Balance</span>
                <span className="text-xl font-bold font-mono text-emerald-400 block">
                  ${taxReport.taxReserve.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="bg-zinc-950/20 p-5 border border-zinc-800/50 rounded-2xl space-y-4">
              <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider font-mono">Reserve Adequacy Check</span>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-zinc-400">Projected Tax Liability vs Savings Reserve</span>
                  <span className={`font-semibold ${taxReport.surplusOrDeficit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {taxReport.surplusOrDeficit >= 0 
                      ? `Surplus: +$${taxReport.surplusOrDeficit.toLocaleString('en-US', { minimumFractionDigits: 2 })}` 
                      : `Deficit: -$${Math.abs(taxReport.surplusOrDeficit).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                  </span>
                </div>

                <div className="h-4 rounded-full w-full bg-zinc-800 overflow-hidden relative shadow-inner">
                  <div 
                    style={{ width: `${Math.min(100, (taxReport.taxReserve / (taxReport.projectedTaxLiability || 1)) * 100)}%` }} 
                    className={`h-full transition-all duration-500 ${taxReport.isPrepared ? 'bg-emerald-500' : 'bg-amber-500'}`}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5. INTERACTIVE CUSTOM REPORT BUILDER WITH PRINTABLE EXPENSE OPTION */}
        {activeReportTab === 'custom-builder' && (
          <div className="space-y-6" id="custom-builder-workspace">
            
            {/* ADVANCED MULTI-OPTION FILTER GRID */}
            <div className="bg-zinc-900/40 border border-zinc-800/80 p-5 rounded-3xl space-y-4 backdrop-blur-sm">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Filter size={14} className="text-emerald-400" />
                  Custom ledger filter panel
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setFilterStartDate('');
                    setFilterEndDate('');
                    setFilterAccountId('all');
                    setFilterCounterparty('all');
                    setFilterTag('all');
                    setFilterMinAmount('');
                    setFilterMaxAmount('');
                  }}
                  className="text-[10px] text-amber-400 hover:underline font-semibold cursor-pointer"
                >
                  Reset Form
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {/* Date Start */}
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 font-mono">Date Start</label>
                  <input
                    type="date"
                    value={filterStartDate}
                    onChange={e => setFilterStartDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800/80 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/50 font-mono"
                  />
                </div>

                {/* Date End */}
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 font-mono">Date End</label>
                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={e => setFilterEndDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800/80 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/50 font-mono"
                  />
                </div>

                {/* Account Category Filter */}
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 font-mono">Category / COA Code</label>
                  <select
                    value={filterAccountId}
                    onChange={e => setFilterAccountId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800/80 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                  >
                    <option value="all">All Category Accounts</option>
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>({a.code}) {a.name}</option>
                    ))}
                  </select>
                </div>

                {/* Counterparty Filter */}
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 font-mono">Counterparty (Merchant)</label>
                  <select
                    value={filterCounterparty}
                    onChange={e => setFilterCounterparty(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800/80 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                  >
                    <option value="all">All Counterparties</option>
                    {uniqueCounterpartiesList.map(cp => (
                      <option key={cp} value={cp}>{cp}</option>
                    ))}
                  </select>
                </div>

                {/* Tag Filter */}
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 font-mono">Select Tag</label>
                  <select
                    value={filterTag}
                    onChange={e => setFilterTag(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800/80 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/50 cursor-pointer"
                  >
                    <option value="all">All Tags</option>
                    {uniqueTagsList.map(tag => (
                      <option key={tag} value={tag}>#{tag}</option>
                    ))}
                  </select>
                </div>

                {/* Minimum Amount */}
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 font-mono">Min Amount ($)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={filterMinAmount}
                    onChange={e => setFilterMinAmount(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800/80 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/50 font-mono"
                  />
                </div>

                {/* Maximum Amount */}
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1 font-mono">Max Amount ($)</label>
                  <input
                    type="number"
                    placeholder="5000.00"
                    value={filterMaxAmount}
                    onChange={e => setFilterMaxAmount(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800/80 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/50 font-mono"
                  />
                </div>

                {/* Print Trigger Cell */}
                <div className="flex items-end justify-end">
                  <button
                    type="button"
                    onClick={() => setPrintModeActive(true)}
                    disabled={filteredBuilderTransactions.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-2 px-4 text-xs font-bold transition-all w-full flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-40 disabled:pointer-events-none"
                  >
                    <Printer size={13} /> Expense Report Layout
                  </button>
                </div>
              </div>
            </div>

            {/* FILTERED SUMMARY METRICS CARD */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-zinc-950/40 p-4 rounded-2xl border border-zinc-850">
              <div className="p-3 bg-zinc-900/30 rounded-xl">
                <span className="text-[10px] uppercase font-mono text-zinc-500 font-bold block">Filtered Records</span>
                <span className="text-base font-bold text-zinc-200 block font-mono mt-0.5">{builderStats.count} entries</span>
              </div>
              <div className="p-3 bg-zinc-900/30 rounded-xl">
                <span className="text-[10px] uppercase font-mono text-zinc-500 font-bold block">Aggregated Revenue</span>
                <span className="text-base font-bold text-emerald-400 block font-mono mt-0.5">${builderStats.totalInflows.toFixed(2)}</span>
              </div>
              <div className="p-3 bg-zinc-900/30 rounded-xl">
                <span className="text-[10px] uppercase font-mono text-zinc-500 font-bold block">Aggregated Expenses</span>
                <span className="text-base font-bold text-rose-400 block font-mono mt-0.5">-${builderStats.totalOutflows.toFixed(2)}</span>
              </div>
              <div className="p-3 bg-zinc-900/30 rounded-xl">
                <span className="text-[10px] uppercase font-mono text-zinc-500 font-bold block">Documented Expenses</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-base font-bold text-emerald-400 font-mono">${builderStats.documentedExpenses.toFixed(2)}</span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    ({builderStats.totalOutflows > 0 ? Math.round((builderStats.documentedExpenses / builderStats.totalOutflows) * 100) : 100}%)
                  </span>
                </div>
              </div>
            </div>

            {/* EXPENSE LEDGER RESULT SPREADSHEET */}
            <div className="bg-zinc-900/40 rounded-2xl border border-zinc-800/80 shadow-2xl overflow-hidden backdrop-blur-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-zinc-300 border-collapse">
                  <thead>
                    <tr className="bg-zinc-950 font-mono text-[10px] text-zinc-400 uppercase tracking-wider border-b border-zinc-800 text-left select-none">
                      <th className="py-4 px-4 w-[110px]">Date</th>
                      <th className="py-4 px-3 min-w-[140px]">Counterparty</th>
                      <th className="py-4 px-3 min-w-[200px]">Memo Description</th>
                      <th className="py-4 px-3 min-w-[150px]">Mapped COA Category</th>
                      <th className="py-4 px-3 min-w-[110px]">Tags</th>
                      <th className="py-4 px-3 text-right w-[110px]">Amount</th>
                      <th className="py-4 px-4 text-center w-[130px]">Receipt Voucher</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {filteredBuilderTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-zinc-500 font-medium">No ledger entries match your filter settings. Reset the filters above to browse all transactions.</td>
                      </tr>
                    ) : (
                      filteredBuilderTransactions.map(tx => {
                        const txAttachments = attachments.filter(a => a.transactionId === tx.id);
                        const hasReceipt = txAttachments.length > 0;
                        
                        // Discover the exact categorization account for this transaction
                        const companionEntries = ledgerEntries.filter(le => le.transactionId === tx.id);
                        const mappedAccount = companionEntries.map(le => accounts.find(a => a.id === le.accountId)).find(a => a && ['expense', 'revenue'].includes(a.type));

                        return (
                          <tr key={tx.id} className="hover:bg-zinc-900/30 transition-all">
                            <td className="py-3 px-4 font-mono text-zinc-400">{tx.date}</td>
                            <td className="py-3 px-3 font-semibold text-zinc-200">{tx.counterparty}</td>
                            <td className="py-3 px-3 text-zinc-400 leading-snug max-w-xs truncate" title={tx.description}>
                              {tx.description}
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-medium text-zinc-300">
                                {mappedAccount ? `(${mappedAccount.code}) ${mappedAccount.name}` : 'Suspense / Unassigned'}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex flex-wrap gap-1">
                                {tx.tags.map(t => (
                                  <span key={t} className="text-[9px] bg-zinc-800/60 text-zinc-400 px-1.5 py-0.2 rounded border border-zinc-700/20">
                                    #{t}
                                  </span>
                                ))}
                                {tx.tags.length === 0 && <span className="text-zinc-600 italic text-[10px]">none</span>}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-semibold">
                              <span className={tx.amount < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                                {tx.amount < 0 ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {hasReceipt ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold border border-emerald-500/20">
                                  <CheckCircle size={10} /> Has Receipt
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] text-zinc-500 bg-zinc-950 px-2 py-0.5 rounded-full font-medium border border-zinc-800">
                                  <ShieldAlert size={10} /> missing
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* FULL PRINTABLE EXPENSE REPORT MODAL OVERLAY */}
      {printModeActive && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black p-4 md:p-8 animate-fadeIn" id="expense-report-print-modal">
          {/* Controls Bar */}
          <div className="max-w-4xl mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xl print:hidden">
            <div className="space-y-1">
              <h4 className="font-bold text-white text-sm font-display flex items-center gap-1.5">
                <Printer className="text-emerald-400" size={16} /> Print & Export Settings
              </h4>
              <p className="text-xs text-zinc-400">Customize the printable invoice sheet. Use Ctrl+P or click Print to export to PDF.</p>
            </div>

            {/* Customization Inputs */}
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <input
                type="text"
                placeholder="Report Title"
                value={printReportTitle}
                onChange={e => setPrintReportTitle(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-zinc-500 w-[160px]"
              />
              <input
                type="text"
                placeholder="Prepared For"
                value={printPreparedFor}
                onChange={e => setPrintPreparedFor(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-zinc-500 w-[180px]"
              />

              <div className="flex gap-2">
                <button
                  onClick={() => window.print()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-1.5 px-4 text-xs font-bold transition-all cursor-pointer shadow-md"
                >
                  Print Report
                </button>
                <button
                  onClick={() => setPrintModeActive(false)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl py-1.5 px-3 text-xs font-semibold cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>

          {/* PRINT DESIGN PREVIEW AREA (STRICT PAPER STYLING: HIGH CONTRAST LIGHT BG FOR PURE INK EFFICIENCY) */}
          <div className="max-w-4xl mx-auto bg-white text-zinc-900 p-8 md:p-12 rounded-3xl shadow-2xl border border-zinc-200 flex flex-col space-y-8 print:border-none print:p-0 print:shadow-none animate-scaleUp">
            
            {/* Printable Header */}
            <div className="flex justify-between items-start border-b-2 border-zinc-900 pb-6">
              <div className="space-y-1">
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest font-mono">Ledger Disclosure Document</span>
                <h1 className="text-3xl font-extrabold tracking-tight text-zinc-950 font-display">{printReportTitle}</h1>
                <p className="text-xs text-zinc-500">Prepared For: <span className="font-semibold text-zinc-800">{printPreparedFor}</span></p>
              </div>
              <div className="text-right font-mono text-[10px] text-zinc-500 space-y-0.5">
                <div>SYSTEM LOGS: VERIFIED</div>
                <div>GENERATED: {new Date().toLocaleDateString()}</div>
                <div>LEDGER REF: QIFI-EXP-{Date.now().toString().slice(-6)}</div>
              </div>
            </div>

            {/* Quick Report Bounds / Summary stats */}
            <div className="grid grid-cols-4 gap-4 bg-zinc-50 p-4 rounded-xl border border-zinc-200">
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-400 block font-mono">Date Range Boundary</span>
                <span className="text-xs text-zinc-800 font-semibold block">
                  {filterStartDate || 'Earliest'} <span className="text-zinc-400">to</span> {filterEndDate || 'Latest'}
                </span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-400 block font-mono">Postings Audited</span>
                <span className="text-xs text-zinc-800 font-semibold block font-mono">{filteredBuilderTransactions.length} events</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-400 block font-mono">Total Expenditures</span>
                <span className="text-xs text-rose-600 font-bold block font-mono">-${builderStats.totalOutflows.toFixed(2)}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-400 block font-mono">Revenues Aggregated</span>
                <span className="text-xs text-emerald-600 font-bold block font-mono">+${builderStats.totalInflows.toFixed(2)}</span>
              </div>
            </div>

            {/* EXPENSE TABLE (PRINT OPTIMIZED) */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 font-mono">Itemized Operating Postings</h3>
              
              <table className="w-full text-[11px] text-zinc-800 border-collapse">
                <thead>
                  <tr className="border-b-2 border-zinc-900 bg-zinc-100 font-mono text-[9px] text-zinc-600 uppercase text-left">
                    <th className="py-2.5 px-3 w-[85px]">Date</th>
                    <th className="py-2.5 px-3 min-w-[120px]">Counterparty</th>
                    <th className="py-2.5 px-3 min-w-[160px]">Memo Description</th>
                    <th className="py-2.5 px-3">COA Category</th>
                    <th className="py-2.5 px-3 text-right w-[95px]">Amount</th>
                    <th className="py-2.5 px-3 text-center w-[100px]">Doc Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {filteredBuilderTransactions.map(tx => {
                    const txAttachments = attachments.filter(a => a.transactionId === tx.id);
                    const companionEntries = ledgerEntries.filter(le => le.transactionId === tx.id);
                    const mappedAccount = companionEntries.map(le => accounts.find(a => a.id === le.accountId)).find(a => a && ['expense', 'revenue'].includes(a.type));

                    return (
                      <tr key={tx.id} className="align-top">
                        <td className="py-2 px-3 font-mono text-zinc-500">{tx.date}</td>
                        <td className="py-2 px-3 font-bold text-zinc-950">{tx.counterparty}</td>
                        <td className="py-2 px-3 text-zinc-600 italic leading-tight">{tx.description}</td>
                        <td className="py-2 px-3 font-mono">{mappedAccount ? `${mappedAccount.code} - ${mappedAccount.name}` : 'Suspense / Unassigned'}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold">
                          <span className={tx.amount < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                            {tx.amount < 0 ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          {txAttachments.length > 0 ? (
                            <span className="text-[9px] text-emerald-600 font-bold">DOCUMENTED</span>
                          ) : (
                            <span className="text-[9px] text-amber-600 font-bold font-mono">MISSING</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ATTACHED RECEIPTS VOUCHERS APPENDIX (PRINT THE RELATED RECEIPTS!) */}
            <div className="pt-8 border-t-2 border-zinc-900 page-break-before space-y-6">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 font-mono">Appendix: Receipt & Document Vouchers</h3>
                <p className="text-[10px] text-zinc-500 mt-0.5">Below are the digital representations of physical receipts, invoices, or autogenerated bank evidence matching the expense table.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {filteredBuilderTransactions
                  .filter(tx => attachments.some(a => a.transactionId === tx.id))
                  .map(tx => {
                    const txAttachments = attachments.filter(a => a.transactionId === tx.id);
                    return txAttachments.map(attach => (
                      <div key={attach.id} className="border border-zinc-200 p-4 rounded-xl flex flex-col space-y-3 bg-zinc-50 hover:bg-zinc-100 transition-all">
                        <div className="flex justify-between items-start border-b border-zinc-200 pb-2">
                          <div className="space-y-0.5">
                            <span className="font-bold text-zinc-900 text-xs block truncate max-w-[200px]">{tx.counterparty}</span>
                            <span className="text-[9px] text-zinc-500 font-mono block">TX Date: {tx.date} | ${Math.abs(tx.amount).toFixed(2)}</span>
                          </div>
                          <span className="text-[9px] font-mono font-bold bg-zinc-200 text-zinc-700 px-2 py-0.5 rounded">Voucher Document</span>
                        </div>

                        {/* Receipt image */}
                        <div className="flex items-center justify-center p-3 bg-white border border-zinc-200 rounded-lg min-h-[160px]">
                          {attach.dataUrl.startsWith('data:image') || attach.dataUrl.includes('unsplash') ? (
                            <img 
                              src={attach.dataUrl} 
                              alt={attach.fileName} 
                              referrerPolicy="no-referrer"
                              className="max-h-[180px] w-auto object-contain rounded shadow" 
                            />
                          ) : (
                            <div className="text-center space-y-1">
                              <FileText className="mx-auto text-zinc-400" size={32} />
                              <span className="text-[9px] text-zinc-500 block">Binary document content</span>
                            </div>
                          )}
                        </div>

                        <div className="text-[10px] text-zinc-600 leading-snug">
                          <span className="font-bold block text-[9px] uppercase tracking-wider text-zinc-400 font-mono">Compliance Metadata Notes:</span>
                          <span className="italic">{attach.notes || 'No meta-notes provided.'}</span>
                        </div>
                      </div>
                    ));
                  })}
                
                {filteredBuilderTransactions.filter(tx => attachments.some(a => a.transactionId === tx.id)).length === 0 && (
                  <div className="col-span-2 border-2 border-dashed border-zinc-200 p-8 rounded-xl text-center text-zinc-400 text-xs italic font-medium">
                    No matching receipts attached to the transactions in this report.
                  </div>
                )}
              </div>
            </div>

            {/* Signature Block */}
            <div className="pt-12 mt-12 border-t border-zinc-200 grid grid-cols-2 gap-8 text-[11px] text-zinc-600">
              <div className="space-y-12">
                <p>Prepared / Declared By:</p>
                <div className="border-b border-zinc-900 w-48 h-px" />
                <p className="font-mono text-[9px] text-zinc-500">Date Signed</p>
              </div>

              <div className="space-y-12 text-right">
                <p>Audited & Confirmed By:</p>
                <div className="border-b border-zinc-900 w-48 h-px ml-auto" />
                <p className="font-mono text-[9px] text-zinc-500">Date Checked</p>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
