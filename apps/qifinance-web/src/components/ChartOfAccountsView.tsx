/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useQiStore } from '../store';
import { Account, AccountType, Attachment } from '../types';
import { 
  Plus, Check, X, Shield, ArrowUpRight, ArrowDownLeft, 
  Layers, Heart, Database, Bookmark, PlusCircle, AlertCircle,
  FileText, CheckCircle, Eye, Calendar, Tag, ShieldCheck, Sparkles
} from 'lucide-react';

export default function ChartOfAccountsView() {
  const { 
    accounts, 
    addAccount, 
    updateAccount, 
    deleteAccount, 
    getAccountBalance,
    statements,
    attachments,
    transactions
  } = useQiStore();

  // New account form state
  const [showForm, setShowForm] = useState(() => {
    return !!localStorage.getItem('qifi_draft_account');
  });
  const [newCode, setNewCode] = useState(() => {
    const draft = localStorage.getItem('qifi_draft_account');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.newCode !== undefined) return parsed.newCode;
      } catch (e) {}
    }
    return '';
  });

  const [newName, setNewName] = useState(() => {
    const draft = localStorage.getItem('qifi_draft_account');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.newName !== undefined) return parsed.newName;
      } catch (e) {}
    }
    return '';
  });

  const [newType, setNewType] = useState<AccountType>(() => {
    const draft = localStorage.getItem('qifi_draft_account');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.newType) return parsed.newType;
      } catch (e) {}
    }
    return 'expense';
  });

  const [newDesc, setNewDesc] = useState(() => {
    const draft = localStorage.getItem('qifi_draft_account');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.newDesc !== undefined) return parsed.newDesc;
      } catch (e) {}
    }
    return '';
  });

  const [isDraftSaved, setIsDraftSaved] = useState(false);

  // Selected account for deep inspect panel (Reconciliations and Attachments)
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

  const selectedAccount = useMemo(() => {
    return accounts.find(a => a.id === selectedAccountId) || null;
  }, [accounts, selectedAccountId]);

  // Find reconciliations for selected account
  const accountStatements = useMemo(() => {
    if (!selectedAccountId) return [];
    return statements.filter(s => s.accountId === selectedAccountId);
  }, [statements, selectedAccountId]);

  // Find all transactions for selected account
  const accountTransactions = useMemo(() => {
    if (!selectedAccountId) return [];
    return transactions.filter(t => t.sourceAccountId === selectedAccountId);
  }, [transactions, selectedAccountId]);

  // Find transaction-level attachments for this account
  const transactionAttachments = useMemo(() => {
    if (accountTransactions.length === 0) return [];
    const txIds = new Set(accountTransactions.map(t => t.id));
    return attachments.filter(a => a.transactionId && txIds.has(a.transactionId));
  }, [attachments, accountTransactions]);

  // Find statement-level attachments for this account
  const statementAttachments = useMemo(() => {
    if (accountStatements.length === 0) return [];
    const stmtIds = new Set(accountStatements.map(s => s.id));
    return attachments.filter(a => a.statementId && stmtIds.has(a.statementId));
  }, [attachments, accountStatements]);

  const handleAutosaveDraft = (code: string, name: string, type: AccountType, desc: string) => {
    localStorage.setItem('qifi_draft_account', JSON.stringify({
      newCode: code,
      newName: name,
      newType: type,
      newDesc: desc
    }));
    setIsDraftSaved(true);
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const code = e.target.value;
    setNewCode(code);
    handleAutosaveDraft(code, newName, newType, newDesc);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setNewName(name);
    handleAutosaveDraft(newCode, name, newType, newDesc);
  };

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const type = e.target.value as AccountType;
    setNewType(type);
    handleAutosaveDraft(newCode, newName, type, newDesc);
  };

  const handleDescChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const desc = e.target.value;
    setNewDesc(desc);
    handleAutosaveDraft(newCode, newName, newType, desc);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newName) return;

    addAccount({
      code: newCode,
      name: newName,
      type: newType,
      description: newDesc
    });

    setNewCode('');
    setNewName('');
    setNewDesc('');
    setNewType('expense');
    localStorage.removeItem('qifi_draft_account');
    setIsDraftSaved(false);
    setShowForm(false);
  };

  const groupedAccounts = useMemo(() => {
    return {
      asset: accounts.filter(a => a.type === 'asset' && a.isActive),
      liability: accounts.filter(a => a.type === 'liability' && a.isActive),
      equity: accounts.filter(a => a.type === 'equity' && a.isActive),
      revenue: accounts.filter(a => a.type === 'revenue' && a.isActive),
      expense: accounts.filter(a => a.type === 'expense' && a.isActive),
      clearing: accounts.filter(a => a.type === 'clearing' && a.isActive),
      suspense: accounts.filter(a => a.type === 'suspense' && a.isActive)
    };
  }, [accounts]);

  const aggregates = useMemo(() => {
    return {
      assets: groupedAccounts.asset.reduce((sum, a) => sum + getAccountBalance(a.id), 0),
      liabilities: groupedAccounts.liability.reduce((sum, a) => sum + getAccountBalance(a.id), 0),
      equity: groupedAccounts.equity.reduce((sum, a) => sum + getAccountBalance(a.id), 0),
      revenue: groupedAccounts.revenue.reduce((sum, a) => sum + getAccountBalance(a.id), 0),
      expenses: groupedAccounts.expense.reduce((sum, a) => sum + getAccountBalance(a.id), 0),
    };
  }, [groupedAccounts, getAccountBalance]);

  return (
    <div className="space-y-6 relative">
      
      {/* HEADER CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white font-display">
            Chart of Accounts (COA)
          </h2>
          <p className="text-xs text-zinc-400 font-sans mt-0.5">
            Design your custom chart of accounts. Click on any account to view its statement reconciliations, historical balances, and attached files.
          </p>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/30 text-white px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-lg self-start sm:self-center"
        >
          {showForm ? 'Cancel' : 'New Account Category'}
        </button>
      </div>

      {/* DRAFT SAVED NEW ACCOUNT CREATION FORM */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800/80 shadow-2xl backdrop-blur-md space-y-4 animate-fadeIn">
          <h3 className="font-semibold text-zinc-100 text-sm flex items-center gap-1.5 font-display">
            <PlusCircle className="text-emerald-400" size={16} />
            Configure Account Category
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Category Code</label>
              <input 
                type="text" 
                placeholder="e.g. 1030, 5080"
                value={newCode} 
                onChange={handleCodeChange}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-700"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Category Name</label>
              <input 
                type="text" 
                placeholder="e.g. Reimbursable Gas, Loans Mom"
                value={newName} 
                onChange={handleNameChange}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-700"
                required
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Category Type</label>
              <select
                value={newType}
                onChange={handleTypeChange}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700"
              >
                <option value="asset">Asset (Savings, Cash, Loans Out)</option>
                <option value="liability">Liability (Credit Cards, Debts Due)</option>
                <option value="equity">Equity (Capital Funding)</option>
                <option value="revenue">Income / Revenue (Sales, Gifts Recv)</option>
                <option value="expense">Expense (Rent, Software, Food)</option>
                <option value="clearing">Clearing (Transfer holding)</option>
                <option value="suspense">Suspense (Unclassified)</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Description</label>
            <input 
              type="text" 
              placeholder="Primary purpose or audit details..."
              value={newDesc} 
              onChange={handleDescChange}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-700"
            />
          </div>
          <div className="flex justify-end items-center gap-3 pt-1">
            {isDraftSaved && (
              <span className="text-zinc-500 text-[11px] flex items-center gap-1.5 animate-fadeIn mr-auto">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                Draft autosaved
              </span>
            )}
            <button 
              type="button" 
              onClick={() => {
                setNewName('');
                setNewCode('');
                setNewDesc('');
                setNewType('expense');
                localStorage.removeItem('qifi_draft_account');
                setIsDraftSaved(false);
                setShowForm(false);
              }}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-xs font-semibold shadow-sm cursor-pointer"
            >
              Save Account
            </button>
          </div>
        </form>
      )}

      {/* BENTO CHART SECTIONS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* GROUP 1: ASSETS */}
        <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/80 shadow-xl backdrop-blur-sm space-y-3">
          <div className="flex justify-between items-center border-b border-zinc-800/60 pb-2">
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5 font-display">
              <Database size={16} className="text-zinc-400" />
              Assets (Savings, Checking, Cash)
            </h3>
            <span className="font-mono text-xs font-bold text-zinc-200 bg-zinc-800/60 px-2 py-0.5 rounded-lg border border-zinc-700/30">
              ${aggregates.assets.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="divide-y divide-zinc-800/40 max-h-60 overflow-y-auto pr-1 space-y-0.5">
            {groupedAccounts.asset.map(a => (
              <div 
                key={a.id} 
                onClick={() => setSelectedAccountId(a.id)}
                className="flex justify-between items-center py-2 text-xs hover:bg-zinc-900/40 px-2 rounded-xl transition-all cursor-pointer border border-transparent hover:border-zinc-800/45"
                title="Click to view details, reconciliations and files"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[9px] bg-zinc-800/60 px-1.5 py-0.5 rounded text-zinc-400 border border-zinc-700/20">{a.code}</span>
                    <span className="font-semibold text-zinc-200">{a.name}</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 block mt-0.5">{a.description}</span>
                </div>
                <span className="font-mono font-semibold text-zinc-200">
                  ${getAccountBalance(a.id).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* GROUP 2: LIABILITIES */}
        <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/80 shadow-xl backdrop-blur-sm space-y-3">
          <div className="flex justify-between items-center border-b border-zinc-800/60 pb-2">
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5 font-display">
              <Layers size={16} className="text-zinc-400" />
              Liabilities (Credit Cards & Debts)
            </h3>
            <span className="font-mono text-xs font-bold text-rose-400 bg-rose-950/20 border border-rose-900/30 px-2 py-0.5 rounded-lg">
              ${aggregates.liabilities.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="divide-y divide-zinc-800/40 max-h-60 overflow-y-auto pr-1 space-y-0.5">
            {groupedAccounts.liability.map(a => (
              <div 
                key={a.id} 
                onClick={() => setSelectedAccountId(a.id)}
                className="flex justify-between items-center py-2 text-xs hover:bg-zinc-900/40 px-2 rounded-xl transition-all cursor-pointer border border-transparent hover:border-zinc-800/45"
                title="Click to view details, reconciliations and files"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[9px] bg-zinc-800/60 px-1.5 py-0.5 rounded text-zinc-400 border border-zinc-700/20">{a.code}</span>
                    <span className="font-semibold text-zinc-200">{a.name}</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 block mt-0.5">{a.description}</span>
                </div>
                <span className="font-mono font-semibold text-rose-400">
                  ${getAccountBalance(a.id).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* GROUP 2.5: EQUITY */}
        <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/80 shadow-xl backdrop-blur-sm space-y-3 animate-fadeIn">
          <div className="flex justify-between items-center border-b border-zinc-800/60 pb-2">
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5 font-display">
              <Sparkles size={16} className="text-purple-400 bg-purple-950/30 border border-purple-900/30 rounded" />
              Equity (Capital & Contributions)
            </h3>
            <span className="font-mono text-xs font-bold text-purple-400 bg-purple-950/20 border border-purple-500/20 px-2 py-0.5 rounded-lg">
              ${aggregates.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="divide-y divide-zinc-800/40 max-h-60 overflow-y-auto pr-1 space-y-0.5">
            {groupedAccounts.equity.length === 0 ? (
              <div className="py-4 text-center text-zinc-500 text-xs font-sans">
                No active Equity accounts.
              </div>
            ) : (
              groupedAccounts.equity.map(a => (
                <div 
                  key={a.id} 
                  onClick={() => setSelectedAccountId(a.id)}
                  className="flex justify-between items-center py-2 text-xs hover:bg-zinc-900/40 px-2 rounded-xl transition-all cursor-pointer border border-transparent hover:border-zinc-800/45"
                  title="Click to view details, reconciliations and files"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[9px] bg-zinc-800/60 px-1.5 py-0.5 rounded text-zinc-400 border border-zinc-700/20">{a.code}</span>
                      <span className="font-semibold text-zinc-200">{a.name}</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 block mt-0.5">{a.description}</span>
                  </div>
                  <span className="font-mono font-semibold text-purple-400">
                    ${getAccountBalance(a.id).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* GROUP 3: REVENUES */}
        <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/80 shadow-xl backdrop-blur-sm space-y-3">
          <div className="flex justify-between items-center border-b border-zinc-800/60 pb-2">
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5 font-display">
              <ArrowUpRight size={16} className="text-emerald-400 bg-emerald-950/30 border border-emerald-900/30 rounded" />
              Income & Inflows
            </h3>
            <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 px-2 py-0.5 rounded-lg">
              ${aggregates.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="divide-y divide-zinc-800/40 max-h-60 overflow-y-auto pr-1 space-y-0.5">
            {groupedAccounts.revenue.map(a => (
              <div 
                key={a.id} 
                onClick={() => setSelectedAccountId(a.id)}
                className="flex justify-between items-center py-2 text-xs hover:bg-zinc-900/40 px-2 rounded-xl transition-all cursor-pointer border border-transparent hover:border-zinc-800/45"
                title="Click to view details, reconciliations and files"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[9px] bg-zinc-800/60 px-1.5 py-0.5 rounded text-zinc-400 border border-zinc-700/20">{a.code}</span>
                    <span className="font-semibold text-zinc-200">{a.name}</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 block mt-0.5">{a.description}</span>
                </div>
                <span className="font-mono font-semibold text-emerald-400">
                  ${getAccountBalance(a.id).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* GROUP 4: EXPENSES */}
        <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/80 shadow-xl backdrop-blur-sm space-y-3">
          <div className="flex justify-between items-center border-b border-zinc-800/60 pb-2">
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5 font-display">
              <ArrowDownLeft size={16} className="text-rose-400 bg-rose-950/30 border border-rose-900/30 rounded" />
              Expenses & Outflows
            </h3>
            <span className="font-mono text-xs font-bold text-zinc-200 bg-zinc-800/60 border border-zinc-700/30 px-2 py-0.5 rounded-lg">
              ${aggregates.expenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="divide-y divide-zinc-800/40 max-h-60 overflow-y-auto pr-1 space-y-0.5">
            {groupedAccounts.expense.map(a => (
              <div 
                key={a.id} 
                onClick={() => setSelectedAccountId(a.id)}
                className="flex justify-between items-center py-2 text-xs hover:bg-zinc-900/40 px-2 rounded-xl transition-all cursor-pointer border border-transparent hover:border-zinc-800/45"
                title="Click to view details, reconciliations and files"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[9px] bg-zinc-800/60 px-1.5 py-0.5 rounded text-zinc-400 border border-zinc-700/20">{a.code}</span>
                    <span className="font-semibold text-zinc-200">{a.name}</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 block mt-0.5">{a.description}</span>
                </div>
                <span className="font-mono font-semibold text-zinc-300">
                  ${getAccountBalance(a.id).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* GROUP 5: CLEARING & SUSPENSE */}
        <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/80 shadow-xl backdrop-blur-sm space-y-3 md:col-span-2">
          <div className="flex justify-between items-center border-b border-zinc-800/60 pb-2">
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5 font-display">
              <Bookmark size={16} className="text-zinc-400" />
              Temporary & Uncategorized holding
            </h3>
            <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
              ${(getAccountBalance('suspense-uncategorized') + getAccountBalance('clearing-cc-payment')).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[...groupedAccounts.clearing, ...groupedAccounts.suspense].map(a => (
              <div 
                key={a.id} 
                onClick={() => setSelectedAccountId(a.id)}
                className="bg-zinc-950/60 p-3.5 rounded-xl flex justify-between items-center text-xs border border-zinc-800/60 hover:bg-zinc-900/40 transition-all cursor-pointer border border-transparent hover:border-zinc-800/45"
                title="Click to view details, reconciliations and files"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[9px] bg-zinc-800/60 px-1.5 py-0.5 rounded text-zinc-400 border border-zinc-700/20">{a.code}</span>
                    <span className="font-semibold text-zinc-200">{a.name}</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 block mt-0.5">{a.description}</span>
                </div>
                <span className="font-mono font-semibold text-zinc-300">
                  ${getAccountBalance(a.id).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ACCOUNT DETAIL DRAWER (RIGHT-HAND SLIDE-IN PANEL) */}
      {selectedAccount && (
        <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[480px] bg-zinc-950/95 border-l border-zinc-800/80 shadow-2xl flex flex-col justify-between animate-slideIn backdrop-blur-lg">
          
          {/* Header */}
          <div className="p-5 border-b border-zinc-800/80 flex justify-between items-center">
            <div className="min-w-0">
              <span className="text-[10px] bg-zinc-850 border border-zinc-800 px-2 py-0.5 rounded-lg text-zinc-400 font-mono font-bold uppercase">{selectedAccount.type}</span>
              <h3 className="font-bold text-white text-base font-display mt-1.5 flex items-center gap-1.5 leading-tight">
                {selectedAccount.name}
              </h3>
              <span className="text-xs text-zinc-500 font-mono">Account Code: {selectedAccount.code}</span>
            </div>
            <button 
              onClick={() => setSelectedAccountId(null)}
              className="text-zinc-400 hover:text-white p-1.5 hover:bg-zinc-900 rounded-xl cursor-pointer transition-all border border-zinc-850"
            >
              <X size={16} />
            </button>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            
            {/* Account Summary metrics */}
            <div className="bg-zinc-900/50 p-4 rounded-2xl border border-zinc-800/80 flex items-center justify-between">
              <div>
                <span className="text-zinc-500 text-[10px] font-bold uppercase block tracking-wider">Current Running Balance</span>
                <span className="text-white text-2xl font-extrabold font-mono tracking-tight block mt-0.5">
                  ${getAccountBalance(selectedAccount.id).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <ShieldCheck className="text-emerald-500/20 shrink-0" size={38} />
            </div>

            {/* Account Description */}
            <div className="space-y-1.5">
              <span className="text-zinc-400 text-[11px] font-bold uppercase tracking-wider block">Purposes & Audit description</span>
              <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/20 border border-zinc-850 p-3 rounded-xl">
                {selectedAccount.description || 'No descriptive memo saved for this category.'}
              </p>
            </div>

            {/* STATEMENT RECONCILIATIONS SECTION */}
            <div className="space-y-3">
              <span className="text-zinc-400 text-[11px] font-bold uppercase tracking-wider block flex items-center gap-1.5">
                <Calendar size={14} className="text-zinc-400" />
                Statement Verification & Reconciliations ({accountStatements.length})
              </span>
              
              {accountStatements.length === 0 ? (
                <div className="p-4 border border-zinc-850 bg-zinc-950/40 text-center rounded-xl space-y-1">
                  <span className="text-zinc-500 text-xs italic block">No statement reconciliation records found.</span>
                  <span className="text-[10px] text-zinc-600 block">Reconcile checking or card accounts in the "Verify Statement Matches" tab.</span>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {accountStatements.map(stmt => {
                    const stmtAtts = statementAttachments.filter(a => a.statementId === stmt.id);
                    return (
                      <div key={stmt.id} className="bg-zinc-900/30 border border-zinc-850 rounded-xl p-3.5 space-y-3">
                        <div className="flex justify-between items-center">
                          <div className="text-[11px] font-mono font-bold text-zinc-300">
                            {stmt.startDate} to {stmt.endDate}
                          </div>
                          {stmt.isReconciled ? (
                            <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                              <CheckCircle size={8} /> Verified
                            </span>
                          ) : (
                            <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                              <AlertCircle size={8} /> Pending
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-2 rounded-lg text-[10px] font-mono border border-zinc-900">
                          <div>
                            <span className="text-zinc-500 block">Opening:</span>
                            <span className="text-zinc-300 font-bold">${stmt.openingBalance.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500 block">Ending:</span>
                            <span className="text-zinc-300 font-bold">${stmt.closingBalance.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Statement Documents */}
                        {stmtAtts.length > 0 && (
                          <div className="space-y-1.5 border-t border-zinc-900 pt-2">
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">Attached statement documents:</span>
                            <div className="space-y-1">
                              {stmtAtts.map(a => (
                                <div key={a.id} className="flex justify-between items-center text-[10px] bg-zinc-950 p-1.5 rounded border border-zinc-900">
                                  <span className="text-zinc-300 truncate max-w-[200px] font-medium">{a.fileName}</span>
                                  <button
                                    onClick={() => setPreviewAttachment(a)}
                                    className="text-emerald-400 hover:text-emerald-300 hover:underline flex items-center gap-0.5 cursor-pointer"
                                  >
                                    <Eye size={10} /> View
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* TRANSACTION RECEIPTS & EVIDENCE */}
            <div className="space-y-3">
              <span className="text-zinc-400 text-[11px] font-bold uppercase tracking-wider block flex items-center gap-1.5">
                <FileText size={14} className="text-zinc-400" />
                Transaction Receipts & Proofs ({transactionAttachments.length})
              </span>

              {transactionAttachments.length === 0 ? (
                <div className="p-4 border border-zinc-850 bg-zinc-950/40 text-center rounded-xl">
                  <span className="text-zinc-500 text-xs italic">No transaction-level receipts or attachments found on this account.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {transactionAttachments.map(a => {
                    const tx = accountTransactions.find(t => t.id === a.transactionId);
                    return (
                      <div key={a.id} className="bg-zinc-900/30 border border-zinc-850 p-2.5 rounded-xl space-y-2 flex flex-col justify-between">
                        <div className="space-y-1">
                          <span className="text-zinc-300 font-semibold text-[10px] block truncate">{a.fileName}</span>
                          <span className="text-[9px] text-zinc-500 font-mono block">Linked Transaction:</span>
                          <span className="text-[10px] text-zinc-400 truncate block font-medium">{tx?.counterparty || 'Support file'} · ${Math.abs(tx?.amount || 0).toFixed(2)}</span>
                        </div>
                        <button
                          onClick={() => setPreviewAttachment(a)}
                          className="bg-zinc-950 hover:bg-zinc-900 text-emerald-400 hover:text-emerald-300 text-[10px] py-1 text-center font-bold border border-zinc-900 hover:border-zinc-850 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"
                        >
                          <Eye size={11} /> Inspect Receipt
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Footer */}
          <div className="p-4 border-t border-zinc-850 bg-zinc-950/80 flex justify-end">
            <button 
              onClick={() => setSelectedAccountId(null)}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold px-4 py-2 rounded-xl cursor-pointer transition-all border border-zinc-700"
            >
              Close Account View
            </button>
          </div>
        </div>
      )}

      {/* SUB-MODAL PREVIEW ATTACHMENT */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full flex flex-col max-h-[85vh] overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center px-4 py-3 border-b border-zinc-800">
              <div className="min-w-0">
                <h4 className="font-semibold text-zinc-100 text-sm truncate">{previewAttachment.fileName}</h4>
                <p className="text-[10px] text-zinc-400 font-mono">Attachment uploaded on {new Date(previewAttachment.uploadedAt).toLocaleString()}</p>
              </div>
              <button 
                onClick={() => setPreviewAttachment(null)}
                className="text-zinc-400 hover:text-white p-1 hover:bg-zinc-800 rounded cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex items-center justify-center bg-zinc-950/50 flex-1">
              {previewAttachment.fileType.startsWith('image/') ? (
                <img 
                  src={previewAttachment.dataUrl} 
                  alt={previewAttachment.fileName} 
                  referrerPolicy="no-referrer"
                  className="max-h-[50vh] object-contain rounded border border-zinc-800 shadow"
                />
              ) : (
                <div className="p-8 text-center space-y-3">
                  <FileText size={48} className="mx-auto text-emerald-400 animate-pulse" />
                  <p className="text-zinc-200 text-xs font-semibold">Non-Image File Format ({previewAttachment.fileType})</p>
                  <p className="text-zinc-500 text-[11px] max-w-sm">Spreadsheets, CSV exports, or text statements can be opened or downloaded in your system workspace file browser.</p>
                  <a 
                    href={previewAttachment.dataUrl} 
                    download={previewAttachment.fileName}
                    className="inline-block bg-zinc-800 hover:bg-zinc-750 text-zinc-200 border border-zinc-700 hover:border-zinc-650 px-4 py-2 rounded-xl text-xs font-bold transition-all"
                  >
                    Download / Save File
                  </a>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-zinc-800 flex justify-end">
              <button 
                onClick={() => setPreviewAttachment(null)}
                className="bg-zinc-800 hover:bg-zinc-750 text-zinc-300 text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
