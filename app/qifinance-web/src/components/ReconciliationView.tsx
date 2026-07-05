/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQiStore } from '../store';
import { Statement, Transaction, Attachment } from '../types';
import AttachmentPreviewModal from './AttachmentPreviewModal';
import { 
  CheckCircle, AlertCircle, Calendar, Plus, Trash2, 
  ArrowRight, ShieldAlert, CheckSquare, Square, DollarSign,
  Upload, FileText, X, Filter, Eye, Tag, AlertTriangle
} from 'lucide-react';

export default function ReconciliationView() {
  const { 
    statements, 
    transactions, 
    accounts, 
    addStatement, 
    updateStatement,
    deleteStatement, 
    toggleReconcileTransaction,
    setStatementReconciled,
    getAccountBalance,
    addManualTransaction,
    attachments,
    addAttachment,
    deleteAttachment
  } = useQiStore();

  // Selected statement being reconciled actively
  const [activeStatementId, setActiveStatementId] = useState<string | null>(null);

  // New statement form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [stmtAccount, setStmtAccount] = useState('assets-checking');
  const [stmtStart, setStmtStart] = useState('2026-06-01');
  const [stmtEnd, setStmtEnd] = useState('2026-06-30');
  const [stmtOpening, setStmtOpening] = useState('0.00');
  const [stmtClosing, setStmtClosing] = useState('');

  // Filtering candidate transactions
  const [txFilter, setTxFilter] = useState<'all' | 'inflows' | 'outflows'>('all');

  // Quick transaction / adjustment form state
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickAmount, setQuickAmount] = useState('');
  const [quickType, setQuickType] = useState<'inflow' | 'outflow'>('outflow');
  const [quickDesc, setQuickDesc] = useState('');
  const [quickCounterparty, setQuickCounterparty] = useState('');
  const [quickCategory, setQuickCategory] = useState('suspense-uncategorized');
  const [quickTags, setQuickTags] = useState('');
  const [quickDate, setQuickDate] = useState('');

  // Drag and Drop State
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview State
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

  // Bypass popup alerts
  const [confirmVoidStmtId, setConfirmVoidStmtId] = useState<string | null>(null);
  const [confirmDeleteAttachmentId, setConfirmDeleteAttachmentId] = useState<string | null>(null);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);

  const activeStatement = useMemo(() => {
    return statements.find(s => s.id === activeStatementId) || null;
  }, [statements, activeStatementId]);

  // Prepopulate opening balance from last reconciled/created statement
  useEffect(() => {
    const matchingStmts = statements.filter(s => s.accountId === stmtAccount);
    if (matchingStmts.length > 0) {
      // Find the one with the latest end date
      const sorted = [...matchingStmts].sort((a, b) => b.endDate.localeCompare(a.endDate));
      setStmtOpening(String(sorted[0].closingBalance));
    } else {
      setStmtOpening('0.00');
    }
  }, [stmtAccount, statements]);

  // Set default date for quick transaction when activeStatement changes
  useEffect(() => {
    if (activeStatement) {
      setQuickDate(activeStatement.endDate);
    }
  }, [activeStatement]);

  // Find transactions belonging to active statement parameters
  const candidateTransactions = useMemo(() => {
    if (!activeStatement) return [];

    return transactions.filter(t => {
      // 1. Must be the same account
      if (t.sourceAccountId !== activeStatement.accountId) return false;
      
      // 2. Must lie inside date range
      const tDate = t.date;
      return tDate >= activeStatement.startDate && tDate <= activeStatement.endDate;
    });
  }, [transactions, activeStatement]);

  // Filter transactions in view
  const filteredTransactions = useMemo(() => {
    return candidateTransactions.filter(t => {
      if (txFilter === 'inflows') return t.amount > 0;
      if (txFilter === 'outflows') return t.amount < 0;
      return true;
    });
  }, [candidateTransactions, txFilter]);

  // Find statement attachments
  const activeStatementAttachments = useMemo(() => {
    if (!activeStatementId) return [];
    return attachments.filter(a => a.statementId === activeStatementId);
  }, [attachments, activeStatementId]);

  // Calculate reconciliation status
  const reconciliationMetrics = useMemo(() => {
    if (!activeStatement) return null;

    const targetNetChange = activeStatement.closingBalance - activeStatement.openingBalance;
    
    // Transactions actively matched/linked to this statement
    const matchedTxs = candidateTransactions.filter(t => t.reconciliationId === activeStatement.id);
    const matchedSum = matchedTxs.reduce((sum, t) => sum + t.amount, 0);
    const variance = targetNetChange - matchedSum;

    return {
      targetNetChange,
      matchedSum,
      variance,
      isBalanced: Math.abs(variance) < 0.01,
      matchedCount: matchedTxs.length
    };
  }, [activeStatement, candidateTransactions]);

  const handleCreateStatement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!stmtClosing) return;

    addStatement({
      accountId: stmtAccount,
      startDate: stmtStart,
      endDate: stmtEnd,
      openingBalance: Number(stmtOpening) || 0,
      closingBalance: Number(stmtClosing)
    });

    setStmtClosing('');
    setShowAddForm(false);
  };

  const handleToggleTx = (txId: string, isMatched: boolean) => {
    if (!activeStatementId) return;
    toggleReconcileTransaction(txId, isMatched ? null : activeStatementId);
  };

  // Bulk selectors for current filter view
  const handleSelectAll = () => {
    if (!activeStatementId || activeStatement?.isReconciled) return;
    filteredTransactions.forEach(t => {
      if (t.reconciliationId !== activeStatementId) {
        toggleReconcileTransaction(t.id, activeStatementId);
      }
    });
  };

  const handleDeselectAll = () => {
    if (!activeStatementId || activeStatement?.isReconciled) return;
    filteredTransactions.forEach(t => {
      if (t.reconciliationId === activeStatementId) {
        toggleReconcileTransaction(t.id, null);
      }
    });
  };

  const handleFinalize = () => {
    if (!activeStatementId || !reconciliationMetrics?.isBalanced) return;
    setStatementReconciled(activeStatementId, true);
    alert("Reconciliation complete! Statement period has been verified and locked.");
  };

  const handleUnfinalize = () => {
    if (!activeStatementId) return;
    setStatementReconciled(activeStatementId, false);
  };

  // Quick add transaction inside active reconciliation workspace
  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setQuickAddError(null);
    if (!activeStatement || !quickAmount || !quickDate || !quickDesc) return;

    const absAmt = Math.abs(Number(quickAmount));
    if (isNaN(absAmt) || absAmt <= 0) {
      setQuickAddError("Please enter a valid positive amount.");
      return;
    }

    // Amount sign from the perspective of the source statement account
    const computedAmount = quickType === 'inflow' ? absAmt : -absAmt;

    const tagsArr = quickTags
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    // Build the transaction
    const txData: Omit<Transaction, 'id' | 'createdAt'> = {
      date: quickDate,
      description: quickDesc,
      rawDescription: quickDesc.toUpperCase(),
      amount: computedAmount,
      sourceAccountId: activeStatement.accountId,
      tags: tagsArr,
      counterparty: quickCounterparty || 'Adjustment Entry',
      reconciliationId: activeStatement.id, // Auto-reconcile it instantly
      importBatchId: null
    };

    addManualTransaction(txData, quickCategory);

    // Reset Form
    setQuickAmount('');
    setQuickDesc('');
    setQuickCounterparty('');
    setQuickTags('');
    setQuickCategory('suspense-uncategorized');
    setShowQuickAdd(false);
  };

  // Upload Handlers
  const handleFileUpload = (files: FileList | null) => {
    if (!files || !files[0] || !activeStatementId) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        addAttachment(
          null, // No single transactionId; statement-level attachment
          file.name,
          file.type,
          e.target.result as string,
          `Statement upload for period ending ${activeStatement?.endDate}`,
          activeStatementId
        );
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fadeIn">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white font-display">
            Verify Statement Matches
          </h2>
          <p className="text-xs text-zinc-400 font-sans mt-0.5">
            Make sure your bank statements match your transaction log perfectly to ensure zero mistakes.
          </p>
        </div>
        {!activeStatementId && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/30 text-white px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-lg"
          >
            {showAddForm ? 'Cancel' : 'New Statement Period'}
          </button>
        )}
      </div>

      {/* NEW STATEMENT PERIOD POPUP FORM */}
      {showAddForm && !activeStatementId && (
        <form onSubmit={handleCreateStatement} className="bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800/80 shadow-2xl backdrop-blur-md space-y-4 animate-fadeIn">
          <h3 className="font-semibold text-zinc-100 text-sm flex items-center gap-1.5 font-display">
            <Calendar className="text-emerald-400" size={16} />
            Enter Bank Statement Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Account selection */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Select Account</label>
              <select
                value={stmtAccount}
                onChange={e => setStmtAccount(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-750"
              >
                {accounts.filter(a => ['asset', 'liability'].includes(a.type)).map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            {/* Start Date */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Start Date</label>
              <input 
                type="date"
                value={stmtStart}
                onChange={e => setStmtStart(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-750"
                required
              />
            </div>
            {/* End Date */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">End Date</label>
              <input 
                type="date"
                value={stmtEnd}
                onChange={e => setStmtEnd(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-750"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Opening Balance */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">
                Statement Opening Balance ($)
                <span className="text-[10px] text-emerald-400 lowercase font-normal ml-1.5">(auto-fetched from previous)</span>
              </label>
              <input 
                type="number"
                step="0.01"
                placeholder="e.g. 0.00 or 15000.00"
                value={stmtOpening}
                onChange={e => setStmtOpening(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-750 font-mono"
                required
              />
            </div>
            {/* Closing Balance */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Statement Ending Balance ($)</label>
              <input 
                type="number"
                step="0.01"
                placeholder="e.g. 10900.00"
                value={stmtClosing}
                onChange={e => setStmtClosing(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-750 font-mono"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button 
              type="button" 
              onClick={() => setShowAddForm(false)}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-xs font-semibold shadow-sm cursor-pointer"
            >
              Create Statement Cycle
            </button>
          </div>
        </form>
      )}

      {/* DASHBOARD LIST OF STATEMENTS */}
      {!activeStatementId ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {statements.length === 0 ? (
            <div className="bg-zinc-900/40 p-8 rounded-2xl border border-zinc-800/80 shadow-xl text-center md:col-span-2 space-y-3 backdrop-blur-sm animate-fadeIn">
              <ShieldAlert className="mx-auto text-zinc-500" size={28} />
              <p className="text-zinc-300 font-semibold text-sm">No bank statements added yet.</p>
              <p className="text-zinc-500 text-xs">Add a bank statement above to start matching your transactions.</p>
            </div>
          ) : (
            statements.map(stmt => {
              const acc = accounts.find(a => a.id === stmt.accountId);
              const stmtAttachments = attachments.filter(a => a.statementId === stmt.id);
              return (
                <div key={stmt.id} className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/80 shadow-xl flex flex-col justify-between space-y-4 backdrop-blur-sm animate-fadeIn">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-zinc-100 text-sm font-display">{acc?.name}</span>
                      {stmt.isReconciled ? (
                        <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                          <CheckCircle size={10} /> Verified Match
                        </span>
                      ) : (
                        <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5">
                          <AlertCircle size={10} /> Pending Match
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-400">
                      Statement Cycle: <span className="font-semibold text-zinc-200">{stmt.startDate}</span> to <span className="font-semibold text-zinc-200">{stmt.endDate}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-zinc-950 p-3 rounded-xl text-xs border border-zinc-850">
                    <div>
                      <span className="text-zinc-400 block font-medium">Opening Balance:</span>
                      <span className="font-semibold text-zinc-200 font-mono">${stmt.openingBalance.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400 block font-medium">Ending Balance:</span>
                      <span className="font-semibold text-zinc-200 font-mono">${stmt.closingBalance.toFixed(2)}</span>
                    </div>
                  </div>

                  {stmtAttachments.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                      <FileText size={12} className="text-emerald-400" />
                      <span>{stmtAttachments.length} document{stmtAttachments.length > 1 ? 's' : ''} attached</span>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 pt-2 border-t border-zinc-800/40">
                    {confirmVoidStmtId === stmt.id ? (
                      <div className="flex items-center justify-between bg-rose-950/20 px-3 py-1.5 rounded-xl border border-rose-500/20 text-[11px] w-full">
                        <span className="text-rose-400 font-medium">Void statement and unlink transactions?</span>
                        <div className="flex gap-1.5 shrink-0">
                          <button
                            onClick={() => {
                              deleteStatement(stmt.id);
                              setConfirmVoidStmtId(null);
                            }}
                            className="bg-rose-600 hover:bg-rose-500 text-white font-bold px-2 py-0.5 rounded cursor-pointer"
                          >
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmVoidStmtId(null)}
                            className="text-zinc-400 hover:text-zinc-200 px-1"
                          >
                            No
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center w-full">
                        <button
                          onClick={() => setConfirmVoidStmtId(stmt.id)}
                          className="text-zinc-400 hover:text-rose-400 cursor-pointer"
                          title="Void Statement"
                        >
                          <Trash2 size={14} />
                        </button>

                        <button
                          onClick={() => setActiveStatementId(stmt.id)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all border border-emerald-500/30 shadow-md"
                        >
                          Open Verification <ArrowRight size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* MASTER ACTIVE RECONCILIATION WORKSPACE */
        activeStatement && reconciliationMetrics && (
          <div className="bg-zinc-900/40 rounded-2xl border border-zinc-800/80 shadow-2xl overflow-hidden animate-fadeIn space-y-6 p-6 backdrop-blur-sm">
            
            {/* Top Workspace status bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/60 pb-4">
              <div>
                <button 
                  onClick={() => {
                    setActiveStatementId(null);
                    setShowQuickAdd(false);
                  }}
                  className="text-xs font-bold text-zinc-400 hover:underline mb-1 flex items-center gap-1 cursor-pointer"
                >
                  ← Exit Verification Workspace
                </button>
                <h3 className="font-bold text-zinc-100 text-base leading-snug font-display">
                  Verifying: {accounts.find(a => a.id === activeStatement.accountId)?.name}
                </h3>
                <span className="text-xs text-zinc-400 font-mono">
                  Cycle Boundaries: {activeStatement.startDate} to {activeStatement.endDate}
                </span>
              </div>

              {/* LOCK / STATUS CONTROLS */}
              <div>
                {activeStatement.isReconciled ? (
                  <div className="space-y-1 text-right">
                    <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm">
                      <CheckCircle size={14} /> Period Verified & Locked
                    </span>
                    <button 
                      onClick={handleUnfinalize}
                      className="text-[10px] text-zinc-500 font-semibold hover:underline cursor-pointer"
                    >
                      Unlock statement to modify matches
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleFinalize}
                    disabled={!reconciliationMetrics.isBalanced}
                    className={`px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer ${
                      reconciliationMetrics.isBalanced
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                        : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    }`}
                  >
                    <CheckCircle size={14} /> Lock & Verify Statement
                  </button>
                )}
              </div>
            </div>

            {/* EDIT BALANCES DYNAMICALLY IN RECONCILIATION */}
            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-3">
              <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Statement Balances Ledger Values</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] text-zinc-400 font-medium mb-1">Opening Balance ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    disabled={activeStatement.isReconciled}
                    value={activeStatement.openingBalance}
                    onChange={e => {
                      updateStatement({
                        ...activeStatement,
                        openingBalance: Number(e.target.value) || 0
                      });
                    }}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-100 font-mono focus:outline-none focus:border-zinc-700 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-zinc-400 font-medium mb-1">Ending Balance ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    disabled={activeStatement.isReconciled}
                    value={activeStatement.closingBalance}
                    onChange={e => {
                      updateStatement({
                        ...activeStatement,
                        closingBalance: Number(e.target.value) || 0
                      });
                    }}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-100 font-mono focus:outline-none focus:border-zinc-700 disabled:opacity-50"
                  />
                </div>
              </div>
            </div>

            {/* LIVE COMPUTATION VITAL BOX */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-zinc-950 p-5 rounded-2xl border border-zinc-850 text-xs">
              
              <div className="space-y-1">
                <span className="text-zinc-400 font-medium">Statement Net Change (A)</span>
                <div className="text-lg font-bold font-mono text-zinc-100">
                  ${reconciliationMetrics.targetNetChange.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[10px] text-zinc-500 block font-mono">Ending - Opening</span>
              </div>

              <div className="space-y-1">
                <span className="text-zinc-400 font-medium">Transaction Log Sum (B)</span>
                <div className="text-lg font-bold font-mono text-zinc-100">
                  ${reconciliationMetrics.matchedSum.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                <span className="text-[10px] text-zinc-500 block font-mono">{reconciliationMetrics.matchedCount} selected items</span>
              </div>

              <div className="space-y-1">
                <span className="text-zinc-400 font-medium">Remaining Difference (A - B)</span>
                <div className={`text-xl font-extrabold font-mono tracking-tight ${
                  reconciliationMetrics.isBalanced ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  ${reconciliationMetrics.variance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </div>
                {reconciliationMetrics.isBalanced ? (
                  <span className="text-[10px] text-emerald-400 font-semibold block flex items-center gap-0.5 mt-0.5">
                    <CheckCircle size={10} /> Balanced! Perfect Match.
                  </span>
                ) : (
                  <span className="text-[10px] text-rose-400 font-semibold block flex items-center gap-0.5 mt-0.5 animate-pulse">
                    <AlertCircle size={10} /> Pending match. Enter correct Ending Balance or check matching transactions.
                  </span>
                )}
              </div>

            </div>

            {/* QUICK ACTIONS ROW */}
            <div className="flex flex-wrap gap-2 items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={activeStatement.isReconciled}
                  onClick={() => setShowQuickAdd(!showQuickAdd)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    showQuickAdd
                      ? 'bg-zinc-800 border-zinc-700 text-zinc-300'
                      : 'bg-emerald-600/15 border-emerald-500/20 text-emerald-400 hover:bg-emerald-600/25'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Plus size={14} /> Quick Add Entry / Adjustment
                </button>
              </div>

              <span className="text-[11px] text-zinc-400">
                Found {candidateTransactions.length} matching transactions posted during this cycle
              </span>
            </div>

            {/* QUICK TRANSACTION ENTRY INLINE FORM */}
            {showQuickAdd && !activeStatement.isReconciled && (
              <form onSubmit={handleQuickAddSubmit} className="bg-zinc-950 p-5 rounded-2xl border border-zinc-800/80 space-y-4 animate-fadeIn">
                <div className="flex justify-between items-center pb-2 border-b border-zinc-850">
                  <h4 className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <DollarSign size={14} className="text-emerald-400" />
                    Quick Post & Link Transaction / Adjustment
                  </h4>
                  <button 
                    type="button" 
                    onClick={() => setShowQuickAdd(false)}
                    className="text-zinc-500 hover:text-zinc-300 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                {quickAddError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 animate-fadeIn">
                    <span>⚠️</span>
                    <span>{quickAddError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {/* Amount & Sign */}
                  <div>
                    <label className="block text-[10px] text-zinc-400 font-semibold mb-1">Entry Sign</label>
                    <div className="grid grid-cols-2 gap-1 bg-zinc-900 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setQuickType('outflow')}
                        className={`py-1 text-center font-semibold rounded-lg ${
                          quickType === 'outflow' ? 'bg-zinc-800 text-rose-400' : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Outflow (-)
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickType('inflow')}
                        className={`py-1 text-center font-semibold rounded-lg ${
                          quickType === 'inflow' ? 'bg-zinc-800 text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Inflow (+)
                      </button>
                    </div>
                  </div>

                  {/* Absolute Amount */}
                  <div>
                    <label className="block text-[10px] text-zinc-400 font-semibold mb-1">Amount ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 24.99"
                      value={quickAmount}
                      onChange={e => setQuickAmount(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-zinc-100 font-mono focus:outline-none focus:border-zinc-700"
                    />
                  </div>

                  {/* Transaction Date */}
                  <div>
                    <label className="block text-[10px] text-zinc-400 font-semibold mb-1">Transaction Date</label>
                    <input
                      type="date"
                      required
                      min={activeStatement.startDate}
                      max={activeStatement.endDate}
                      value={quickDate}
                      onChange={e => setQuickDate(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-zinc-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  {/* Counterparty */}
                  <div>
                    <label className="block text-[10px] text-zinc-400 font-semibold mb-1">Counterparty</label>
                    <input
                      type="text"
                      placeholder="e.g. Bank Fee, Chevron, Rent Co"
                      value={quickCounterparty}
                      onChange={e => setQuickCounterparty(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-zinc-700"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-[10px] text-zinc-400 font-semibold mb-1">Description / Memo</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Statement adjustment, interest expense"
                      value={quickDesc}
                      onChange={e => setQuickDesc(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-zinc-100 focus:outline-none focus:border-zinc-700"
                    />
                  </div>

                  {/* Offset/Category Account */}
                  <div>
                    <label className="block text-[10px] text-zinc-400 font-semibold mb-1">Offset (Category/Fee) Account</label>
                    <select
                      value={quickCategory}
                      onChange={e => setQuickCategory(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-zinc-200 focus:outline-none focus:border-zinc-750"
                    >
                      {accounts.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.code} - {a.name} ({a.type})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <div className="w-1/2">
                    <label className="block text-[10px] text-zinc-400 font-semibold mb-1">Tags (Comma separated)</label>
                    <input
                      type="text"
                      placeholder="e.g. adjustment, reconcile, bank-fee"
                      value={quickTags}
                      onChange={e => setQuickTags(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowQuickAdd(false)}
                      className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 px-3 py-1.5 rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/20 text-white px-4 py-1.5 rounded-xl font-bold cursor-pointer"
                    >
                      Post Entry
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* DRAG AND DROP BANK STATEMENT FILE ATTACHMENTS */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-zinc-100 font-display flex items-center gap-1.5">
                <Upload size={16} className="text-emerald-400" />
                Upload Bank Statement Document
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Upload Zone */}
                {!activeStatement.isReconciled ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-2 ${
                      isDragging 
                        ? 'border-emerald-400 bg-emerald-500/5' 
                        : 'border-zinc-800 hover:border-zinc-750 bg-zinc-950/20'
                    }`}
                  >
                    <input 
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => handleFileUpload(e.target.files)}
                      className="hidden"
                      accept="image/*,application/pdf,text/*,.csv,.tsv,.txt,.md,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                    />
                    <Upload size={24} className="text-zinc-500 animate-pulse" />
                    <span className="text-xs font-semibold text-zinc-300">Drag statement file here, or click to upload</span>
                    <span className="text-[10px] text-zinc-500">Supports images, PDF documents, or spreadsheets</span>
                  </div>
                ) : (
                  <div className="border border-zinc-850 bg-zinc-950/20 p-5 rounded-2xl flex flex-col justify-center items-center text-center space-y-1.5">
                    <CheckCircle size={20} className="text-emerald-500" />
                    <span className="text-xs font-semibold text-zinc-400">Statement period is locked</span>
                    <span className="text-[10px] text-zinc-500">Unlock statement period to modify bank attachments</span>
                  </div>
                )}

                {/* Attached Statements Files list */}
                <div className="bg-zinc-950/30 border border-zinc-850 p-4 rounded-2xl flex flex-col space-y-2.5">
                  <span className="text-xs font-bold text-zinc-300 block border-b border-zinc-850 pb-1.5">Statement Attachments ({activeStatementAttachments.length})</span>
                  {activeStatementAttachments.length === 0 ? (
                    <span className="text-[11px] text-zinc-500 italic py-4 block text-center">No PDF or image statements uploaded for this cycle.</span>
                  ) : (
                    <div className="divide-y divide-zinc-900 overflow-y-auto max-h-36 pr-1 space-y-1">
                      {activeStatementAttachments.map(a => (
                        <div key={a.id} className="flex justify-between items-center py-1.5 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText size={14} className="text-emerald-400 shrink-0" />
                            <div className="min-w-0">
                              <span className="text-zinc-200 block truncate font-medium">{a.fileName}</span>
                              <span className="text-[9px] text-zinc-500 font-mono block">Uploaded: {new Date(a.uploadedAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => setPreviewAttachment(a)}
                              className="p-1 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white cursor-pointer"
                              title="Preview document"
                            >
                              <Eye size={13} />
                            </button>
                            {!activeStatement.isReconciled && (
                              confirmDeleteAttachmentId === a.id ? (
                                <div className="flex items-center gap-1.5 bg-rose-950/40 border border-rose-500/20 rounded px-1.5 py-0.5 text-[10px]">
                                  <span className="text-rose-400 font-medium">Delete?</span>
                                  <button
                                    onClick={() => {
                                      deleteAttachment(a.id);
                                      setConfirmDeleteAttachmentId(null);
                                    }}
                                    className="text-white hover:text-rose-400 font-bold px-1 cursor-pointer"
                                    title="Confirm Delete"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteAttachmentId(null)}
                                    className="text-zinc-400 hover:text-white px-1 cursor-pointer"
                                    title="Cancel"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteAttachmentId(a.id)}
                                  className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-rose-400 cursor-pointer"
                                  title="Delete document"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* CANDIDATE TRANSACTIONS CHECKBOX TABLE */}
            <div className="space-y-4 border-t border-zinc-800/50 pt-4">
              
              {/* FILTER BAR AND BULK CONTROLS */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-950 p-3 rounded-2xl border border-zinc-850">
                {/* Filter pills */}
                <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-xl">
                  <button
                    onClick={() => setTxFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                      txFilter === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    All Posted ({candidateTransactions.length})
                  </button>
                  <button
                    onClick={() => setTxFilter('inflows')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                      txFilter === 'inflows' ? 'bg-emerald-950/40 text-emerald-300' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Deposits / Inflows ({candidateTransactions.filter(t => t.amount > 0).length})
                  </button>
                  <button
                    onClick={() => setTxFilter('outflows')}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                      txFilter === 'outflows' ? 'bg-rose-950/40 text-rose-300' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Payments / Outflows ({candidateTransactions.filter(t => t.amount < 0).length})
                  </button>
                </div>

                {/* Select All / Deselect All */}
                {!activeStatement.isReconciled && filteredTransactions.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSelectAll}
                      className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-bold text-zinc-300 px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                    >
                      Select All in View
                    </button>
                    <button
                      onClick={handleDeselectAll}
                      className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-bold text-zinc-300 px-3 py-1.5 rounded-lg cursor-pointer transition-all"
                    >
                      Deselect All in View
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-bold text-zinc-100 font-display">Select Matches From Date Range</h4>
                
                {filteredTransactions.length === 0 ? (
                  <p className="text-xs text-zinc-500 py-6 italic text-center bg-zinc-950/40 border border-zinc-850 rounded-xl">
                    {candidateTransactions.length === 0 
                      ? 'No transactions posted in this statement date range.' 
                      : 'No transactions match the selected filter type.'}
                  </p>
                ) : (
                  <div className="divide-y divide-zinc-900 border border-zinc-850 rounded-xl bg-zinc-950 overflow-hidden text-xs">
                    {filteredTransactions.map(t => {
                      const isMatched = t.reconciliationId === activeStatement.id;
                      return (
                        <div 
                          key={t.id}
                          onClick={() => !activeStatement.isReconciled && handleToggleTx(t.id, isMatched)}
                          className={`px-4 py-3 flex items-center justify-between gap-4 transition-all ${
                            activeStatement.isReconciled ? 'cursor-default' : 'cursor-pointer hover:bg-zinc-900/40'
                          } ${isMatched ? 'bg-emerald-500/5' : ''}`}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Checkbox */}
                            {!activeStatement.isReconciled && (
                              <div className="text-zinc-500 hover:text-emerald-400 shrink-0">
                                {isMatched ? (
                                  <CheckSquare size={18} className="text-emerald-400" />
                                ) : (
                                  <Square size={18} />
                                )}
                              </div>
                            )}
                            {activeStatement.isReconciled && (
                              <CheckCircle size={16} className="text-emerald-500 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-zinc-200 truncate">{t.counterparty}</span>
                                {t.tags.length > 0 && (
                                  <span className="flex items-center gap-0.5 text-[9px] text-zinc-500 font-mono">
                                    <Tag size={8} /> {t.tags[0]}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-zinc-500 block font-mono mt-0.5">{t.date} · {t.description}</span>
                            </div>
                          </div>

                          <span className={`font-mono font-bold text-right shrink-0 ${t.amount < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {t.amount < 0 ? '-' : '+'}${Math.abs(t.amount).toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>
        )
      )}

      <AttachmentPreviewModal attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} titlePrefix="Statement document" />
      {/* Legacy preview markup kept inert until the modal cleanup pass. */}
      {false && previewAttachment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full flex flex-col max-h-[85vh] overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center px-4 py-3 border-b border-zinc-800">
              <div className="min-w-0">
                <h4 className="font-semibold text-zinc-100 text-sm truncate">{previewAttachment.fileName}</h4>
                <p className="text-[10px] text-zinc-400 font-mono">Statement attachment uploaded on {new Date(previewAttachment.uploadedAt).toLocaleString()}</p>
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
