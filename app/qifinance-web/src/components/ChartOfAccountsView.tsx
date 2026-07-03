/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import { useQiStore } from '../store';
import { Account, AccountType, Attachment } from '../types';
import { 
  Plus, Check, X, Shield, ArrowUpRight, ArrowDownLeft, 
  Layers, Heart, Database, Bookmark, PlusCircle, AlertCircle,
  FileText, CheckCircle, Eye, Calendar, Tag, ShieldCheck, Sparkles,
  Edit2, Trash2, ChevronRight, Upload, Info, Download
} from 'lucide-react';

const DEFAULT_CODES_BY_TYPE: Record<AccountType, { code: string; label: string }[]> = {
  asset: [
    { code: '1010', label: '1010 - Business Checking' },
    { code: '1020', label: '1020 - Tax Savings' },
    { code: '1030', label: '1030 - Petty Cash / Hand cash' },
    { code: '1100', label: '1100 - Accounts Receivable' },
    { code: '1210', label: '1210 - Loans Receivable' },
    { code: '1300', label: '1300 - Inventory Assets' },
    { code: '1400', label: '1400 - Prepaid Expenses' },
  ],
  liability: [
    { code: '2010', label: '2010 - Credit Card Liability' },
    { code: '2020', label: '2020 - Accounts Payable' },
    { code: '2100', label: '2100 - Accrued Liabilities' },
    { code: '2200', label: '2200 - Lines of Credit' },
    { code: '2300', label: '2300 - Long-term Loans / Mortgages' },
  ],
  equity: [
    { code: '3010', label: '3010 - Owner Capital / Contributions' },
    { code: '3020', label: '3020 - Retained Earnings' },
    { code: '3030', label: '3030 - Owner Drawings / Distributions' },
  ],
  revenue: [
    { code: '4010', label: '4010 - Service / Consulting Revenue' },
    { code: '4020', label: '4020 - Sales Revenue' },
    { code: '4030', label: '4030 - Interest & Investment Revenue' },
    { code: '4040', label: '4040 - Other Inflows / Gifts Received' },
  ],
  expense: [
    { code: '5010', label: '5010 - Rent & Office Space' },
    { code: '5020', label: '5020 - Software & SaaS Subscriptions' },
    { code: '5030', label: '5030 - Office Supplies & Devices' },
    { code: '5040', label: '5040 - Gifts, Caregiving & Support' },
    { code: '5050', label: '5050 - Travel & Lodging' },
    { code: '5060', label: '5060 - Groceries & Household' },
    { code: '5070', label: '5070 - Meals & Dining Out' },
    { code: '6010', label: '6010 - Utilities (Electric, Gas)' },
    { code: '6020', label: '6020 - Telecommunications (Phone, Net)' },
    { code: '6030', label: '6030 - Marketing & Client Acquisition' },
    { code: '6040', label: '6040 - Legal & Professional Fees' },
    { code: '6050', label: '6050 - Insurance' },
    { code: '7010', label: '7010 - Bank & Credit Fees' },
  ],
  clearing: [
    { code: '8010', label: '8010 - Credit Card Payment Clearing' },
    { code: '8020', label: '8020 - In-transit Funds Transfer' },
  ],
  suspense: [
    { code: '9999', label: '9999 - Uncategorized Suspense' },
  ]
};

export default function ChartOfAccountsView() {
  const { 
    accounts, 
    addAccount, 
    updateAccount, 
    deleteAccount, 
    getAccountBalance,
    statements,
    attachments,
    transactions,
    exportData,
    importData,
    addAttachment
  } = useQiStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const accountDocInputRef = useRef<HTMLInputElement>(null);

  // New account form state
  const [showForm, setShowForm] = useState(false);
  const [newCodeSelection, setNewCodeSelection] = useState('1010');
  const [newCustomCode, setNewCustomCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<AccountType>('asset');
  const [newDesc, setNewDesc] = useState('');
  const [newInstitution, setNewInstitution] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newRoutingNumber, setNewRoutingNumber] = useState('');
  const [newParentAccountId, setNewParentAccountId] = useState('');

  // Selected account for deep inspect panel
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  
  // Drawer Editing states
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editInstitution, setEditInstitution] = useState('');
  const [editAccountNumber, setEditAccountNumber] = useState('');
  const [editRoutingNumber, setEditRoutingNumber] = useState('');
  const [editParentAccountId, setEditParentAccountId] = useState('');
  const [editCodeSelection, setEditCodeSelection] = useState('');
  const [editCustomCode, setEditCustomCode] = useState('');

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

  // Attachments on this specific account
  const accountDocAttachments = useMemo(() => {
    if (!selectedAccountId) return [];
    return attachments.filter(a => a.accountId === selectedAccountId);
  }, [attachments, selectedAccountId]);

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

  // Auto select default code preset when type changes in New Account Form
  const handleTypeChange = (type: AccountType) => {
    setNewType(type);
    const presets = DEFAULT_CODES_BY_TYPE[type];
    if (presets && presets.length > 0) {
      setNewCodeSelection(presets[0].code);
    } else {
      setNewCodeSelection('custom');
    }
  };

  const handleStartEdit = (account: Account) => {
    setIsEditing(true);
    setEditName(account.name);
    setEditDesc(account.description);
    setEditInstitution(account.institution || '');
    setEditAccountNumber(account.accountNumber || '');
    setEditRoutingNumber(account.routingNumber || '');
    setEditParentAccountId(account.parentAccountId || '');

    const presets = DEFAULT_CODES_BY_TYPE[account.type] || [];
    const isPreset = presets.some(p => p.code === account.code);
    if (isPreset) {
      setEditCodeSelection(account.code);
      setEditCustomCode('');
    } else {
      setEditCodeSelection('custom');
      setEditCustomCode(account.code);
    }
  };

  const handleSaveEdit = () => {
    if (!selectedAccount) return;
    const finalCode = editCodeSelection === 'custom' ? editCustomCode : editCodeSelection;
    if (!finalCode || !editName) return;

    updateAccount({
      ...selectedAccount,
      name: editName,
      code: finalCode,
      description: editDesc,
      institution: editInstitution,
      accountNumber: editAccountNumber,
      routingNumber: editRoutingNumber,
      parentAccountId: editParentAccountId || null
    });
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (!selectedAccountId) return;
    if (window.confirm("Are you sure you want to delete or disable this account? If it is already used in transactions, it will be soft-disabled.")) {
      deleteAccount(selectedAccountId);
      setSelectedAccountId(null);
      setIsEditing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCode = newCodeSelection === 'custom' ? newCustomCode : newCodeSelection;
    if (!finalCode || !newName) return;

    const newId = `${newType}-${newName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    addAccount({
      id: newId,
      code: finalCode,
      name: newName,
      type: newType,
      description: newDesc,
      institution: newInstitution,
      accountNumber: newAccountNumber,
      routingNumber: newRoutingNumber,
      parentAccountId: newParentAccountId || null
    });

    setNewName('');
    setNewCustomCode('');
    setNewDesc('');
    setNewInstitution('');
    setNewAccountNumber('');
    setNewRoutingNumber('');
    setNewParentAccountId('');
    setShowForm(false);
  };

  // Safe file upload for Account Documents
  const handleAccountDocUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedAccountId) return;
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          addAttachment(
            null, // transactionId
            file.name,
            file.type,
            event.target.result as string,
            'Agreement or statement doc stored on Account',
            null, // statementId
            selectedAccountId // accountId
          );
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Instant export / import backup
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

  // Group accounts with their nesting structure
  const groupedAccounts = useMemo(() => {
    const activeAccs = accounts.filter(a => a.isActive);
    
    // Maps each account to its child accounts
    const parentToChildren = new Map<string, Account[]>();
    activeAccs.forEach(acc => {
      if (acc.parentAccountId) {
        const list = parentToChildren.get(acc.parentAccountId) || [];
        list.push(acc);
        parentToChildren.set(acc.parentAccountId, list);
      }
    });

    const getNested = (type: AccountType) => {
      const typeAccs = activeAccs.filter(a => a.type === type);
      // Root accounts are those without parent, or parent doesn't exist/different type
      const roots = typeAccs.filter(a => !a.parentAccountId || !typeAccs.some(p => p.id === a.parentAccountId));
      
      const result: { account: Account; depth: number }[] = [];
      const traverse = (acc: Account, depth: number) => {
        result.push({ account: acc, depth });
        const children = parentToChildren.get(acc.id) || [];
        // sort by code or name
        children.sort((a, b) => a.code.localeCompare(b.code));
        children.forEach(child => traverse(child, depth + 1));
      };

      roots.sort((a, b) => a.code.localeCompare(b.code));
      roots.forEach(r => traverse(r, 0));
      return result;
    };

    return {
      asset: getNested('asset'),
      liability: getNested('liability'),
      equity: getNested('equity'),
      revenue: getNested('revenue'),
      expense: getNested('expense'),
      clearing: getNested('clearing'),
      suspense: getNested('suspense'),
    };
  }, [accounts]);

  const aggregates = useMemo(() => {
    const getSum = (type: AccountType) => 
      accounts.filter(a => a.type === type && a.isActive).reduce((sum, a) => sum + getAccountBalance(a.id), 0);
    return {
      assets: getSum('asset'),
      liabilities: getSum('liability'),
      equity: getSum('equity'),
      revenue: getSum('revenue'),
      expenses: getSum('expense'),
    };
  }, [accounts, getAccountBalance]);

  // List of other accounts that can be selected as a parent in dropdowns
  const parentCandidates = useMemo(() => {
    return accounts.filter(a => a.isActive);
  }, [accounts]);

  // Custom rendering list inside Bento blocks
  const renderAccountRow = (acc: Account, depth: number) => {
    const balance = getAccountBalance(acc.id);
    const isOutflowColor = ['expense', 'liability'].includes(acc.type);
    
    return (
      <div 
        key={acc.id} 
        onClick={() => setSelectedAccountId(acc.id)}
        className="flex justify-between items-center py-2.5 text-xs hover:bg-zinc-900/50 px-2 rounded-xl transition-all cursor-pointer border border-transparent hover:border-zinc-800/40 select-none group"
        style={{ paddingLeft: `${Math.max(8, depth * 22)}px` }}
        title="Click to inspect, edit, or attach documents"
      >
        <div className="flex items-center gap-2 min-w-0">
          {depth > 0 && (
            <span className="text-zinc-600 font-mono select-none">↳</span>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono text-[9px] bg-zinc-800/70 px-1.5 py-0.5 rounded text-zinc-400 border border-zinc-700/20">{acc.code}</span>
              <span className="font-semibold text-zinc-200 truncate">{acc.name}</span>
              {acc.institution && (
                <span className="text-[9px] text-zinc-500 bg-zinc-950 px-1 py-0.2 rounded border border-zinc-900">{acc.institution}</span>
              )}
            </div>
            {acc.description && (
              <span className="text-[10px] text-zinc-500 block mt-0.5 truncate">{acc.description}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-mono font-semibold ${isOutflowColor && balance !== 0 ? 'text-rose-400' : 'text-zinc-200'}`}>
            ${balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
          <ChevronRight size={13} className="text-zinc-600 group-hover:text-zinc-300 transition-all shrink-0" />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 relative">
      
      {/* HEADER CONTROLS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white font-display">
            Chart of Accounts (COA)
          </h2>
          <p className="text-xs text-zinc-400 font-sans mt-0.5">
            Configure parent groupings, routing/account numbers, and institutional links. Click any account to manage agreements, edit details, or upload documents.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Backup export/import shortcuts */}
          <button
            onClick={handleBackup}
            className="inline-flex items-center gap-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all"
            title="Download full JSON Database"
          >
            <Download size={13} /> Export Backup
          </button>
          
          <label className="inline-flex items-center gap-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all">
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
            onClick={() => {
              setShowForm(!showForm);
              setIsEditing(false);
            }}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/30 text-white px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-lg"
          >
            {showForm ? 'Cancel' : 'New Account / Category'}
          </button>
        </div>
      </div>

      {/* NEW ACCOUNT / CATEGORY CREATION FORM */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800/80 shadow-2xl backdrop-blur-md space-y-4 animate-fadeIn">
          <h3 className="font-semibold text-zinc-100 text-sm flex items-center gap-1.5 font-display">
            <PlusCircle className="text-emerald-400" size={16} />
            Configure New Account Category
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Account / Category Type</label>
              <select
                value={newType}
                onChange={e => handleTypeChange(e.target.value as AccountType)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700"
              >
                <option value="asset">Asset (Checking, Savings, Loans Out)</option>
                <option value="liability">Liability (Credit Cards, Loan Debt)</option>
                <option value="equity">Equity (Owner Contributions)</option>
                <option value="revenue">Revenue (Sales, Retainers, Inflows)</option>
                <option value="expense">Expense (Rent, Software, Dining)</option>
                <option value="clearing">Clearing ( CC Payments, Transfers)</option>
                <option value="suspense">Suspense (Unclassified)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Category Code Default</label>
              <select
                value={newCodeSelection}
                onChange={e => setNewCodeSelection(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700"
              >
                {(DEFAULT_CODES_BY_TYPE[newType] || []).map(p => (
                  <option key={p.code} value={p.code}>{p.label}</option>
                ))}
                <option value="custom">Create custom code...</option>
              </select>
            </div>
            {newCodeSelection === 'custom' && (
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Custom Code Number</label>
                <input 
                  type="text" 
                  placeholder="e.g. 5080, 1040"
                  value={newCustomCode} 
                  onChange={e => setNewCustomCode(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-700"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Account Name</label>
              <input 
                type="text" 
                placeholder="e.g. Chase Business Checking"
                value={newName} 
                onChange={e => setNewName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-700"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Institution (Optional)</label>
              <input 
                type="text" 
                placeholder="e.g. Chase Bank, AMEX"
                value={newInstitution} 
                onChange={e => setNewInstitution(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-700"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Account Number (Optional)</label>
              <input 
                type="text" 
                placeholder="e.g. xxxxx1234"
                value={newAccountNumber} 
                onChange={e => setNewAccountNumber(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-700"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Routing Number (Optional)</label>
              <input 
                type="text" 
                placeholder="e.g. 021000021"
                value={newRoutingNumber} 
                onChange={e => setNewRoutingNumber(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-700"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Parent Group (Optional)</label>
              <select
                value={newParentAccountId}
                onChange={e => setNewParentAccountId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700"
              >
                <option value="">-- No Parent / Top Level --</option>
                {parentCandidates.map(p => (
                  <option key={p.id} value={p.id}>({p.code}) {p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Description</label>
            <input 
              type="text" 
              placeholder="Primary purpose or audit details..."
              value={newDesc} 
              onChange={e => setNewDesc(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-700"
            />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button 
              type="button" 
              onClick={() => setShowForm(false)}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
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
          <div className="divide-y divide-zinc-800/40 max-h-64 overflow-y-auto pr-1 space-y-0.5">
            {groupedAccounts.asset.map(node => renderAccountRow(node.account, node.depth))}
          </div>
        </div>

        {/* GROUP 2: LIABILITIES */}
        <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/80 shadow-xl backdrop-blur-sm space-y-3">
          <div className="flex justify-between items-center border-b border-zinc-800/60 pb-2">
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5 font-display">
              <Layers size={16} className="text-zinc-400" />
              Liabilities (Credit Cards & Loans)
            </h3>
            <span className="font-mono text-xs font-bold text-rose-400 bg-rose-950/20 border border-rose-900/30 px-2 py-0.5 rounded-lg">
              ${aggregates.liabilities.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="divide-y divide-zinc-800/40 max-h-64 overflow-y-auto pr-1 space-y-0.5">
            {groupedAccounts.liability.map(node => renderAccountRow(node.account, node.depth))}
          </div>
        </div>

        {/* GROUP 2.5: EQUITY */}
        <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/80 shadow-xl backdrop-blur-sm space-y-3">
          <div className="flex justify-between items-center border-b border-zinc-800/60 pb-2">
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5 font-display">
              <Sparkles size={16} className="text-purple-400 bg-purple-950/30 border border-purple-900/30 rounded" />
              Equity (Capital & Contributions)
            </h3>
            <span className="font-mono text-xs font-bold text-purple-400 bg-purple-950/20 border border-purple-500/20 px-2 py-0.5 rounded-lg">
              ${aggregates.equity.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="divide-y divide-zinc-800/40 max-h-64 overflow-y-auto pr-1 space-y-0.5">
            {groupedAccounts.equity.map(node => renderAccountRow(node.account, node.depth))}
          </div>
        </div>

        {/* GROUP 3: REVENUES */}
        <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/80 shadow-xl backdrop-blur-sm space-y-3">
          <div className="flex justify-between items-center border-b border-zinc-800/60 pb-2">
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5 font-display">
              <ArrowUpRight size={16} className="text-emerald-400 bg-emerald-950/30 border border-emerald-900/30 rounded" />
              Income & Revenue
            </h3>
            <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-950/20 border border-emerald-900/30 px-2 py-0.5 rounded-lg">
              ${aggregates.revenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="divide-y divide-zinc-800/40 max-h-64 overflow-y-auto pr-1 space-y-0.5">
            {groupedAccounts.revenue.map(node => renderAccountRow(node.account, node.depth))}
          </div>
        </div>

        {/* GROUP 4: EXPENSES */}
        <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/80 shadow-xl backdrop-blur-sm space-y-3 md:col-span-2">
          <div className="flex justify-between items-center border-b border-zinc-800/60 pb-2">
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5 font-display">
              <ArrowDownLeft size={16} className="text-rose-400 bg-rose-950/30 border border-rose-900/30 rounded" />
              Expense Categories & Outflows
            </h3>
            <span className="font-mono text-xs font-bold text-zinc-200 bg-zinc-800/60 border border-zinc-700/30 px-2 py-0.5 rounded-lg">
              ${aggregates.expenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="divide-y divide-zinc-800/40 max-h-[400px] overflow-y-auto pr-1 space-y-0.5">
            {groupedAccounts.expense.map(node => renderAccountRow(node.account, node.depth))}
          </div>
        </div>

        {/* GROUP 5: CLEARING & SUSPENSE */}
        <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/80 shadow-xl backdrop-blur-sm space-y-3 md:col-span-2">
          <div className="flex justify-between items-center border-b border-zinc-800/60 pb-2">
            <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5 font-display">
              <Bookmark size={16} className="text-zinc-400" />
              Clearing & Uncategorized Suspense
            </h3>
            <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
              ${(getAccountBalance('suspense-uncategorized') + getAccountBalance('clearing-cc-payment')).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Clearing */}
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Clearing / Transit</span>
              {groupedAccounts.clearing.map(node => renderAccountRow(node.account, node.depth))}
            </div>
            {/* Suspense */}
            <div className="space-y-1">
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Suspense / Unreviewed</span>
              {groupedAccounts.suspense.map(node => renderAccountRow(node.account, node.depth))}
            </div>
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
              onClick={() => {
                setSelectedAccountId(null);
                setIsEditing(false);
              }}
              className="text-zinc-400 hover:text-white p-1.5 hover:bg-zinc-900 rounded-xl cursor-pointer transition-all border border-zinc-850"
            >
              <X size={16} />
            </button>
          </div>

          {/* Content area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            
            {/* Edit / Delete Buttons */}
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => isEditing ? handleSaveEdit() : handleStartEdit(selectedAccount)}
                className="inline-flex items-center gap-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all"
              >
                {isEditing ? <Check size={14} className="text-emerald-400" /> : <Edit2 size={13} />}
                {isEditing ? 'Save Changes' : 'Edit Details'}
              </button>
              
              <button
                onClick={handleDelete}
                className="inline-flex items-center gap-1 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/30 text-rose-400 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all"
              >
                <Trash2 size={13} />
                Delete Account
              </button>
            </div>

            {isEditing ? (
              /* DRAWER EDIT FORM */
              <div className="bg-zinc-900/40 p-4 rounded-xl border border-zinc-850 space-y-4 animate-fadeIn">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase">Account Name</label>
                  <input 
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase">Category Code</label>
                    <select
                      value={editCodeSelection}
                      onChange={e => setEditCodeSelection(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                    >
                      {(DEFAULT_CODES_BY_TYPE[selectedAccount.type] || []).map(p => (
                        <option key={p.code} value={p.code}>{p.label}</option>
                      ))}
                      <option value="custom">Custom code...</option>
                    </select>
                  </div>
                  {editCodeSelection === 'custom' && (
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 uppercase">Custom Code</label>
                      <input 
                        type="text"
                        value={editCustomCode}
                        onChange={e => setEditCustomCode(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase">Institution / Bank Name</label>
                  <input 
                    type="text"
                    value={editInstitution}
                    onChange={e => setEditInstitution(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase">Account Number</label>
                    <input 
                      type="text"
                      value={editAccountNumber}
                      onChange={e => setEditAccountNumber(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 uppercase">Routing Number</label>
                    <input 
                      type="text"
                      value={editRoutingNumber}
                      onChange={e => setEditRoutingNumber(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase">Parent Group / Nesting</label>
                  <select
                    value={editParentAccountId}
                    onChange={e => setEditParentAccountId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700"
                  >
                    <option value="">-- No Parent (Top Level) --</option>
                    {parentCandidates.filter(a => a.id !== selectedAccount.id).map(p => (
                      <option key={p.id} value={p.id}>({p.code}) {p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase">Description</label>
                  <input 
                    type="text"
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700"
                  />
                </div>
                
                <div className="flex justify-end gap-2 border-t border-zinc-800 pt-3">
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1 rounded text-xs"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveEdit}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1 rounded text-xs font-semibold"
                  >
                    Save Details
                  </button>
                </div>
              </div>
            ) : (
              /* STATIC VIEWS */
              <>
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

                {/* routing and account number details block */}
                {(selectedAccount.institution || selectedAccount.accountNumber || selectedAccount.routingNumber) && (
                  <div className="bg-zinc-900/20 p-3.5 rounded-xl border border-zinc-850 text-xs space-y-2">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider block">Security & Bank Credentials</span>
                    <div className="grid grid-cols-2 gap-2 text-zinc-400 font-mono text-[11px]">
                      {selectedAccount.institution && (
                        <div className="col-span-2">
                          <span className="text-zinc-500">Institution:</span> <span className="text-zinc-200 font-bold">{selectedAccount.institution}</span>
                        </div>
                      )}
                      {selectedAccount.accountNumber && (
                        <div>
                          <span className="text-zinc-500">Account #:</span> <span className="text-zinc-200 font-bold">{selectedAccount.accountNumber}</span>
                        </div>
                      )}
                      {selectedAccount.routingNumber && (
                        <div>
                          <span className="text-zinc-500">Routing #:</span> <span className="text-zinc-200 font-bold">{selectedAccount.routingNumber}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Account Description */}
                <div className="space-y-1.5">
                  <span className="text-zinc-400 text-[11px] font-bold uppercase tracking-wider block">Purposes & Audit description</span>
                  <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-900/20 border border-zinc-850 p-3 rounded-xl">
                    {selectedAccount.description || 'No descriptive memo saved for this category.'}
                  </p>
                </div>
              </>
            )}

            {/* AGREEMENTS, CONTRACTS & EVIDENCE DOCUMENTS (Account Level attachments) */}
            <div className="space-y-3 border-t border-zinc-800/80 pt-4">
              <div className="flex justify-between items-center">
                <span className="text-zinc-400 text-[11px] font-bold uppercase tracking-wider block flex items-center gap-1.5">
                  <FileText size={14} className="text-zinc-400" />
                  Account Documents & Agreements ({accountDocAttachments.length})
                </span>
                
                {/* Account document uploader button */}
                <label className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 hover:border-emerald-500/40 text-zinc-400 hover:text-emerald-400 px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all">
                  <Upload size={10} /> Add Agreement File
                  <input 
                    type="file" 
                    ref={accountDocInputRef}
                    accept="image/*,application/pdf,.csv,.xlsx,.txt" 
                    className="hidden" 
                    onChange={handleAccountDocUpload} 
                  />
                </label>
              </div>

              {accountDocAttachments.length === 0 ? (
                <div className="p-4 border border-zinc-850 bg-zinc-950/40 text-center rounded-xl">
                  <span className="text-zinc-500 text-xs italic block">No account agreements, contracts, or credentials documentation attached.</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {accountDocAttachments.map(a => (
                    <div key={a.id} className="bg-zinc-900/30 border border-zinc-850 p-2.5 rounded-xl space-y-2 flex flex-col justify-between">
                      <div className="space-y-1">
                        <span className="text-zinc-300 font-semibold text-[10px] block truncate" title={a.fileName}>{a.fileName}</span>
                        <span className="text-[8px] text-zinc-500 font-mono block">Uploaded: {new Date(a.uploadedAt).toLocaleDateString()}</span>
                      </div>
                      <button
                        onClick={() => setPreviewAttachment(a)}
                        className="bg-zinc-950 hover:bg-zinc-900 text-emerald-400 hover:text-emerald-300 text-[10px] py-1 text-center font-bold border border-zinc-900 hover:border-zinc-850 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-all"
                      >
                        <Eye size={11} /> Open Document
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* STATEMENT RECONCILIATIONS SECTION */}
            <div className="space-y-3 border-t border-zinc-800/80 pt-4">
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
            <div className="space-y-3 border-t border-zinc-800/80 pt-4">
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
              onClick={() => {
                setSelectedAccountId(null);
                setIsEditing(false);
              }}
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
                  <p className="text-zinc-500 text-[11px] max-w-sm">Spreadsheets, PDF statements or invoices can be opened or downloaded in your system workspace file browser.</p>
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
