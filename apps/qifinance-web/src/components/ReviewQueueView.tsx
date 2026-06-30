/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useQiStore } from '../store';
import { RawImportedRow, Account } from '../types';
import { 
  Check, X, ChevronRight, HelpCircle, AlertTriangle, 
  Settings, Tag, HelpCircle as HelpIcon, Sparkles, Plus, AlertCircle,
  Table, CreditCard, CheckSquare, Square, Trash2, Edit, Save, Undo, Play, Layers
} from 'lucide-react';

export default function ReviewQueueView() {
  const { 
    rawRows, 
    accounts, 
    rules, 
    approveRow, 
    ignoreRow,
    addRule,
    updateRawRow,
    bulkApproveRows,
    bulkIgnoreRows
  } = useQiStore();

  // Find all raw pending rows
  const pendingRows = useMemo(() => rawRows.filter(r => r.status === 'pending'), [rawRows]);
  
  // View Mode: 'sheet' | 'swiper'
  const [viewMode, setViewMode] = useState<'sheet' | 'swiper'>('sheet');
  
  // Selected rows for bulk operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Card Swiper State
  const [currentIndex, setCurrentIndex] = useState(0);

  // Normalization form state for active card
  const [activeRow, setActiveRow] = useState<RawImportedRow | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCounterparty, setEditCounterparty] = useState('');
  const [editAccountId, setEditAccountId] = useState('suspense-uncategorized');
  const [editTagsText, setEditTagsText] = useState('');
  
  // Rule Creation form state
  const [showRuleCreator, setShowRuleCreator] = useState(false);
  const [rulePattern, setRulePattern] = useState('');
  const [ruleDesc, setRuleDesc] = useState('');

  // State-based rule application prompt (replaces blocking alert/confirm)
  const [ruleApplyPrompt, setRuleApplyPrompt] = useState<{
    pattern: string;
    suggestedAccountId: string;
    suggestedTags: string[];
    suggestedCounterparty: string;
    matchingRowIds: string[];
  } | null>(null);

  // Bulk Edit Form State (for sheets style)
  const [bulkAccountId, setBulkAccountId] = useState('');
  const [bulkCounterparty, setBulkCounterparty] = useState('');
  const [bulkTagsText, setBulkTagsText] = useState('');

  // Synchronize state when active card changes (for swiper)
  useEffect(() => {
    if (pendingRows.length > 0 && viewMode === 'swiper') {
      const idx = Math.min(currentIndex, pendingRows.length - 1);
      const row = pendingRows[idx];
      setActiveRow(row);
      setEditDate(row.date);
      setEditDescription(row.memo ? `${row.description} (${row.memo})` : row.description);
      setEditCounterparty(row.suggestedCounterparty || '');
      setEditAccountId(row.suggestedAccountId || 'suspense-uncategorized');
      setEditTagsText(row.suggestedTags ? row.suggestedTags.join(', ') : '');
      
      const firstWord = row.description.split(' ')[0] || '';
      setRulePattern(firstWord.toLowerCase());
      setRuleDesc(`Auto-suggest ${firstWord} entries`);
    } else {
      setActiveRow(null);
    }
  }, [currentIndex, pendingRows, viewMode]);

  // Handle Select All checkbox in Sheet mode
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(pendingRows.map(r => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  // Handle single checkbox toggle
  const handleToggleSelect = (rowId: string) => {
    if (selectedIds.includes(rowId)) {
      setSelectedIds(selectedIds.filter(id => id !== rowId));
    } else {
      setSelectedIds([...selectedIds, rowId]);
    }
  };

  const handleApprove = () => {
    if (!activeRow) return;
    
    const tags = editTagsText
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    approveRow(activeRow.id, {
      date: editDate,
      description: editDescription,
      counterparty: editCounterparty || 'Unassigned Merchant',
      accountId: editAccountId,
      tags,
      amount: activeRow.amount
    });

    if (currentIndex >= pendingRows.length - 1 && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleIgnore = () => {
    if (!activeRow) return;
    ignoreRow(activeRow.id);
    if (currentIndex >= pendingRows.length - 1 && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  // Handles inline Approve for a single sheet row
  const handleApproveRow = (row: RawImportedRow) => {
    const tags = row.suggestedTags || [];
    approveRow(row.id, {
      date: row.date,
      description: row.memo ? `${row.description} (${row.memo})` : row.description,
      counterparty: row.suggestedCounterparty || 'Unassigned Merchant',
      accountId: row.suggestedAccountId || 'suspense-uncategorized',
      tags,
      amount: row.amount
    });
    // Remove from selection if approved
    setSelectedIds(prev => prev.filter(id => id !== row.id));
  };

  // Bulk Approve Selected Sheet Rows
  const handleBulkApprove = () => {
    const approvals = pendingRows
      .filter(row => selectedIds.includes(row.id))
      .map(row => {
        const tags = row.suggestedTags || [];
        return {
          rowId: row.id,
          data: {
            date: row.date,
            description: row.memo ? `${row.description} (${row.memo})` : row.description,
            counterparty: row.suggestedCounterparty || 'Unassigned Merchant',
            accountId: row.suggestedAccountId || 'suspense-uncategorized',
            tags,
            amount: row.amount
          }
        };
      });

    if (approvals.length === 0) return;
    bulkApproveRows(approvals);
    setSelectedIds([]);
  };

  // Bulk Ignore Selected Sheet Rows
  const handleBulkIgnore = () => {
    if (selectedIds.length === 0) return;
    bulkIgnoreRows(selectedIds);
    setSelectedIds([]);
  };

  // Bulk Edit Selected Column values (Category, Counterparty, Tags)
  const handleApplyBulkEdit = () => {
    if (selectedIds.length === 0) return;

    selectedIds.forEach(id => {
      const updates: Partial<RawImportedRow> = {};
      if (bulkAccountId) updates.suggestedAccountId = bulkAccountId;
      if (bulkCounterparty) updates.suggestedCounterparty = bulkCounterparty;
      if (bulkTagsText !== '') {
        updates.suggestedTags = bulkTagsText.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      }
      updateRawRow(id, updates);
    });

    // Reset Bulk inputs
    setBulkAccountId('');
    setBulkCounterparty('');
    setBulkTagsText('');
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rulePattern) return;

    const patternLower = rulePattern.trim().toLowerCase();
    const targetAccountId = editAccountId;
    const targetTags = editTagsText.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const targetCounterparty = editCounterparty;

    addRule({
      pattern: patternLower,
      suggestedAccountId: targetAccountId,
      suggestedTags: targetTags,
      suggestedCounterparty: targetCounterparty,
      description: ruleDesc
    });

    setShowRuleCreator(false);

    // Identify pending matching rows (excluding current row if running from Swiper card)
    const matchingPendingRows = pendingRows.filter(row => {
      const isMatch = row.description.toLowerCase().includes(patternLower);
      return isMatch;
    });

    if (matchingPendingRows.length > 0) {
      setRuleApplyPrompt({
        pattern: patternLower,
        suggestedAccountId: targetAccountId,
        suggestedTags: targetTags,
        suggestedCounterparty: targetCounterparty,
        matchingRowIds: matchingPendingRows.map(r => r.id)
      });
    }
  };

  // Process the actual batch rule execution now
  const executeRulePromptNow = () => {
    if (!ruleApplyPrompt) return;
    
    ruleApplyPrompt.matchingRowIds.forEach(id => {
      updateRawRow(id, {
        suggestedAccountId: ruleApplyPrompt.suggestedAccountId,
        suggestedTags: ruleApplyPrompt.suggestedTags,
        suggestedCounterparty: ruleApplyPrompt.suggestedCounterparty
      });
    });

    setRuleApplyPrompt(null);
  };

  if (pendingRows.length === 0) {
    return (
      <div className="bg-zinc-900/40 p-8 rounded-2xl border border-zinc-800/80 shadow-2xl text-center space-y-4 max-w-lg mx-auto backdrop-blur-sm animate-fadeIn" id="review-cleared-card">
        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
          <Check size={32} />
        </div>
        <h3 className="text-xl font-bold text-zinc-100 font-display">
          Review Queue Cleared!
        </h3>
        <p className="text-zinc-400 text-sm font-sans">
          All imported transactions have been reviewed, categorized, and added to your transaction log. Your accounts are up-to-date.
        </p>
        <p className="text-xs text-zinc-500 font-mono">
          Upload more bank CSV exports inside the "Import Transactions" workspace to ingest new raw events.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* CARD STATUS HEADER & TOGGLE */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white font-display flex items-center gap-2" id="review-title">
            Pending Money Review
          </h2>
          <p className="text-sm text-zinc-400 font-sans mt-0.5">
            Review, correct, and post raw imported bank statement rows to your balanced double-entry ledger.
          </p>
        </div>
        
        {/* VIEW MODE TOGGLE */}
        <div className="flex bg-zinc-950 border border-zinc-800 p-1 rounded-xl self-start sm:self-center shrink-0">
          <button
            onClick={() => setViewMode('sheet')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'sheet'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Table size={14} /> Excel Sheet View
          </button>
          <button
            onClick={() => setViewMode('swiper')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'swiper'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <CreditCard size={14} /> Swipe Card View
          </button>
        </div>
      </div>

      {/* RULE BATCH PROMPT BANNER */}
      {ruleApplyPrompt && (
        <div className="bg-amber-500/10 border-2 border-amber-500/30 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-bounce-short shadow-xl" id="rule-batch-banner">
          <div className="flex items-start gap-3">
            <Sparkles className="text-amber-400 shrink-0 mt-1" size={24} />
            <div>
              <h4 className="font-bold text-amber-200 text-sm font-display">Run Rule Over Rest of Transactions?</h4>
              <p className="text-xs text-zinc-300 mt-1">
                We found <span className="font-bold text-white">{ruleApplyPrompt.matchingRowIds.length}</span> matching pending transactions containing <span className="font-mono bg-zinc-950 px-1.5 py-0.5 rounded text-amber-300">"{ruleApplyPrompt.pattern}"</span>. 
                Do you want to run this rule now to automatically map their category, merchant, and tags?
              </p>
            </div>
          </div>
          <div className="flex gap-2.5 w-full md:w-auto shrink-0 justify-end">
            <button
              onClick={() => setRuleApplyPrompt(null)}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer w-full md:w-auto"
            >
              Skip
            </button>
            <button
              onClick={executeRulePromptNow}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1 w-full md:w-auto shadow-md"
            >
              <Play size={12} fill="currentColor" /> Apply to {ruleApplyPrompt.matchingRowIds.length} rows now
            </button>
          </div>
        </div>
      )}

      {/* VIEW: SHEET STYLE LEDGER (DEFAULT) */}
      {viewMode === 'sheet' && (
        <div className="space-y-4 animate-fadeIn" id="sheets-ledger-container">
          {/* BULK ACTION PANEL */}
          <div className={`p-4 rounded-2xl border transition-all duration-300 ${
            selectedIds.length > 0 
              ? 'bg-zinc-900 border-emerald-500/40 shadow-xl opacity-100 scale-100' 
              : 'bg-zinc-900/40 border-zinc-800/80 opacity-60 pointer-events-none'
          }`}>
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg ${selectedIds.length > 0 ? 'bg-emerald-950 text-emerald-400' : 'bg-zinc-950 text-zinc-600'}`}>
                  <Layers size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                    Bulk operations panel
                  </h3>
                  <p className="text-[11px] text-zinc-400 font-sans mt-0.5">
                    {selectedIds.length} row(s) selected. Set bulk classification values or execute bulk ledger approvals.
                  </p>
                </div>
              </div>

              {/* Bulk Form and Actions */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Bulk Category dropdown */}
                <select
                  value={bulkAccountId}
                  onChange={e => setBulkAccountId(e.target.value)}
                  disabled={selectedIds.length === 0}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/50 cursor-pointer min-w-[140px]"
                >
                  <option value="">-- Bulk Category --</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>({a.code}) {a.name}</option>
                  ))}
                </select>

                {/* Bulk Merchant input */}
                <input
                  type="text"
                  placeholder="Bulk Merchant..."
                  value={bulkCounterparty}
                  disabled={selectedIds.length === 0}
                  onChange={e => setBulkCounterparty(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/50 placeholder:text-zinc-600 w-[130px]"
                />

                {/* Bulk Tags input */}
                <input
                  type="text"
                  placeholder="Bulk Tags (comma)..."
                  value={bulkTagsText}
                  disabled={selectedIds.length === 0}
                  onChange={e => setBulkTagsText(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500/50 placeholder:text-zinc-600 w-[130px]"
                />

                <button
                  type="button"
                  onClick={handleApplyBulkEdit}
                  disabled={selectedIds.length === 0 || (!bulkAccountId && !bulkCounterparty && bulkTagsText === '')}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-40"
                >
                  Apply Edits
                </button>

                <div className="h-6 w-px bg-zinc-800 hidden md:block" />

                {/* Bulk Actions */}
                <button
                  type="button"
                  onClick={handleBulkIgnore}
                  disabled={selectedIds.length === 0}
                  className="bg-rose-950/30 hover:bg-rose-900/30 text-rose-400 border border-rose-900/30 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-40"
                >
                  Bulk Ignore
                </button>

                <button
                  type="button"
                  onClick={handleBulkApprove}
                  disabled={selectedIds.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-40 shadow-lg shadow-emerald-950/20"
                >
                  Approve Selected ({selectedIds.length})
                </button>
              </div>
            </div>
          </div>

          {/* MAIN SPREADSHEET TABLE */}
          <div className="bg-zinc-900/40 rounded-2xl border border-zinc-800/80 shadow-2xl overflow-hidden backdrop-blur-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs text-zinc-300">
                <thead>
                  <tr className="bg-zinc-950 text-zinc-400 uppercase tracking-wider text-[10px] font-mono border-b border-zinc-800/80 select-none">
                    {/* Checkbox Header */}
                    <th className="py-4 px-4 text-center w-12">
                      <input 
                        type="checkbox"
                        checked={pendingRows.length > 0 && selectedIds.length === pendingRows.length}
                        onChange={handleSelectAll}
                        className="rounded bg-zinc-950 border-zinc-800 text-emerald-500 focus:ring-0 cursor-pointer w-4 h-4"
                      />
                    </th>
                    <th className="py-4 px-3 w-[120px]">Date</th>
                    <th className="py-4 px-3 min-w-[180px]">Raw Bank Statement Text</th>
                    <th className="py-4 px-3 min-w-[140px]">Normalized Merchant</th>
                    <th className="py-4 px-3 min-w-[140px]">Normalized Memo / Description</th>
                    <th className="py-4 px-3 min-w-[180px]">Account Category Mapping</th>
                    <th className="py-4 px-3 min-w-[140px]">Tags (Comma separated)</th>
                    <th className="py-4 px-3 text-right w-[100px]">Amount</th>
                    <th className="py-4 px-4 text-center w-[110px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40 font-sans">
                  {pendingRows.map((row) => {
                    const isSelected = selectedIds.includes(row.id);
                    const suggestedTagsString = row.suggestedTags ? row.suggestedTags.join(', ') : '';

                    return (
                      <tr 
                        key={row.id}
                        className={`transition-all ${
                          isSelected 
                            ? 'bg-emerald-950/10 hover:bg-emerald-950/15' 
                            : 'hover:bg-zinc-900/30'
                        }`}
                      >
                        {/* Checkbox Cell */}
                        <td className="py-3 px-4 text-center">
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(row.id)}
                            className="rounded bg-zinc-950 border-zinc-800 text-emerald-500 focus:ring-0 cursor-pointer w-4 h-4"
                          />
                        </td>

                        {/* Date Cell */}
                        <td className="py-3 px-3">
                          <input 
                            type="date"
                            value={row.date}
                            onChange={e => updateRawRow(row.id, { date: e.target.value })}
                            className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-700 focus:border-emerald-500/50 rounded-lg px-2 py-1.5 text-xs text-zinc-100 focus:outline-none transition-all font-mono"
                          />
                        </td>

                        {/* Statement (Read-only) */}
                        <td className="py-3 px-3">
                          <div className="font-mono text-zinc-400 max-w-[240px] truncate leading-normal" title={row.description}>
                            {row.description}
                          </div>
                        </td>

                        {/* Counterparty / Merchant Cell */}
                        <td className="py-3 px-3">
                          <input 
                            type="text"
                            placeholder="e.g. Apple Store, Landlord"
                            value={row.suggestedCounterparty || ''}
                            onChange={e => updateRawRow(row.id, { suggestedCounterparty: e.target.value })}
                            className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-700 focus:border-emerald-500/50 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none transition-all"
                          />
                        </td>

                        {/* Memo Cell */}
                        <td className="py-3 px-3">
                          <input 
                            type="text"
                            placeholder="Memo note..."
                            value={row.memo || ''}
                            onChange={e => updateRawRow(row.id, { memo: e.target.value })}
                            className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-700 focus:border-emerald-500/50 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none transition-all"
                          />
                        </td>

                        {/* Account Mapping Cell */}
                        <td className="py-3 px-3">
                          <select
                            value={row.suggestedAccountId || 'suspense-uncategorized'}
                            onChange={e => updateRawRow(row.id, { suggestedAccountId: e.target.value })}
                            className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-700 focus:border-emerald-500/50 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none transition-all cursor-pointer"
                          >
                            {accounts.map(a => (
                              <option key={a.id} value={a.id}>
                                ({a.code}) {a.name} — {a.type.toUpperCase()}
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Tags Cell */}
                        <td className="py-3 px-3">
                          <div className="relative flex items-center">
                            <Tag size={10} className="absolute left-2.5 text-zinc-600" />
                            <input 
                              type="text"
                              placeholder="tax, mom, caregiving"
                              value={suggestedTagsString}
                              onChange={e => updateRawRow(row.id, { 
                                suggestedTags: e.target.value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) 
                              })}
                              className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-700 focus:border-emerald-500/50 rounded-lg pl-6 pr-2 py-1.5 text-xs text-zinc-100 focus:outline-none transition-all font-mono"
                            />
                          </div>
                        </td>

                        {/* Amount Cell */}
                        <td className="py-3 px-3 text-right font-mono font-semibold">
                          <span className={row.amount < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                            {row.amount < 0 ? '-' : '+'}${Math.abs(row.amount).toFixed(2)}
                          </span>
                        </td>

                        {/* Actions Cell */}
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleApproveRow(row)}
                              className="p-1.5 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-400 rounded-lg border border-emerald-900/30 transition-all cursor-pointer"
                              title="Approve and save to double-entry log"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={() => ignoreRow(row.id)}
                              className="p-1.5 bg-zinc-950 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-900/30 text-zinc-500 rounded-lg border border-zinc-800 transition-all cursor-pointer"
                              title="Ignore this transaction"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: MOBILE-FRIENDLY CARD SWIPER */}
      {viewMode === 'swiper' && activeRow && (
        <div className="bg-zinc-900/40 rounded-3xl border border-zinc-800/80 shadow-2xl overflow-hidden flex flex-col transition-all backdrop-blur-sm animate-fadeIn max-w-2xl mx-auto" id="swiper-card-view">
          
          {/* Card Top / Core Amount and Raw Data */}
          <div className="p-6 bg-zinc-950 border-b border-zinc-800/80 text-white space-y-3">
            <div className="flex justify-between items-start">
              <span className="text-[10px] uppercase font-bold text-zinc-400 font-mono tracking-wider">
                Raw Bank Transaction
              </span>
              <span className="text-xs text-zinc-400 font-mono">{activeRow.date}</span>
            </div>

            <div className="flex justify-between items-baseline">
              <h3 className="font-mono text-3xl font-bold tracking-tight text-white">
                {activeRow.amount < 0 ? '-' : '+'}${Math.abs(activeRow.amount).toFixed(2)}
              </h3>
              
              {activeRow.suggestedAccountId && activeRow.suggestedAccountId !== 'suspense-uncategorized' ? (
                <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-400 text-xs px-2.5 py-1 rounded-full font-medium">
                  <Sparkles size={12} /> AI/Rule Suggested
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-400 text-xs px-2.5 py-1 rounded-full font-medium">
                  <AlertCircle size={12} /> Needs Assignment
                </span>
              )}
            </div>

            <div>
              <span className="text-xs text-zinc-400 font-mono">Bank Statement Line:</span>
              <p className="font-mono text-sm font-semibold text-zinc-200 mt-0.5 select-all leading-snug">
                {activeRow.description}
              </p>
            </div>
          </div>

          {/* Card Body / Normalization controls */}
          <div className="p-6 space-y-4 text-xs">
            
            <div className="grid grid-cols-2 gap-4">
              {/* Adjusted Date */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Adjusted Date
                </label>
                <input 
                  type="date"
                  value={editDate}
                  onChange={e => setEditDate(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700"
                />
              </div>

              {/* Counterparty Merchant */}
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Normalized Merchant
                </label>
                <input 
                  type="text"
                  placeholder="e.g. Apple Store, Landlord"
                  value={editCounterparty}
                  onChange={e => setEditCounterparty(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700"
                />
              </div>
            </div>

            {/* Description Memo */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Normalized Memo / Details
              </label>
              <input 
                type="text"
                placeholder="Write a clear human description..."
                value={editDescription}
                onChange={e => setEditDescription(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700"
              />
            </div>

            {/* Account Mapping */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  Select Account Category
                </label>
                <span className="text-[10px] text-zinc-500">Select an account or category</span>
              </div>
              <select
                value={editAccountId}
                onChange={e => setEditAccountId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 cursor-pointer"
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    ({a.code}) {a.name} — {a.type.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags Input */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                  <Tag size={12} /> Tags (Comma separated)
                </label>
                <span className="text-[10px] text-zinc-500">e.g. mom, business, caregiving</span>
              </div>
              <input 
                type="text"
                placeholder="reimbursable, tax, caregiving"
                value={editTagsText}
                onChange={e => setEditTagsText(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700"
              />
            </div>

            {/* Rule Builder Trigger */}
            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
              <span className="text-xs text-zinc-400">Tired of categorizing this?</span>
              <button
                type="button"
                onClick={() => setShowRuleCreator(!showRuleCreator)}
                className="text-xs text-emerald-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <Settings size={12} /> Make Category Rule
              </button>
            </div>

            {/* RULE CREATOR COLLAPSIBLE POPUP */}
            {showRuleCreator && (
              <form onSubmit={handleCreateRule} className="bg-emerald-950/20 p-4 rounded-2xl border border-emerald-500/10 space-y-3 animate-fadeIn">
                <div className="flex items-center gap-1.5 font-bold text-emerald-400 text-xs">
                  <Sparkles size={14} /> Automated Rule Creator
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-emerald-400 font-semibold mb-0.5">If bank text contains:</label>
                    <input 
                      type="text" 
                      value={rulePattern} 
                      onChange={e => setRulePattern(e.target.value)} 
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-emerald-400 font-semibold mb-0.5">Rule Memo:</label>
                    <input 
                      type="text" 
                      value={ruleDesc} 
                      onChange={e => setRuleDesc(e.target.value)} 
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700"
                    />
                  </div>
                </div>

                <p className="text-[10px] text-emerald-400/80 leading-snug">
                  This will automatically match future raw imports and map them to <span className="font-semibold">Category: {editAccountId}</span> with tags <span className="font-semibold">[{editTagsText || 'none'}]</span>.
                </p>

                <div className="flex justify-end gap-2 pt-1">
                  <button 
                    type="button" 
                    onClick={() => setShowRuleCreator(false)}
                    className="bg-zinc-850 text-zinc-300 rounded-lg px-3 py-1.5 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="bg-emerald-600 text-white rounded-lg px-3.5 py-1.5 text-xs font-semibold hover:bg-emerald-500 cursor-pointer"
                  >
                    Save Rule
                  </button>
                </div>
              </form>
            )}

          </div>

          {/* Card Footer / Actions */}
          <div className="border-t border-zinc-800/80 bg-zinc-950/60 p-4 grid grid-cols-2 gap-3 shrink-0">
            <button
              onClick={handleIgnore}
              className="flex items-center justify-center gap-2 border border-zinc-800 bg-zinc-900 hover:bg-rose-500/10 hover:text-rose-400 text-zinc-300 rounded-2xl py-3 font-semibold text-sm transition-all cursor-pointer shadow-sm"
              title="Ignore row"
            >
              <X size={16} /> Skip / Ignore
            </button>

            <button
              onClick={handleApprove}
              className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl py-3 font-bold text-sm transition-all cursor-pointer border border-emerald-500/30 shadow-md"
              title="Add to Transaction Log"
            >
              <Check size={16} /> Approve & Log
            </button>
          </div>

        </div>
      )}

      {/* QUICK WORKFLOW TIPS */}
      <div className="p-4 bg-zinc-950/40 border border-zinc-800/80 rounded-2xl flex items-start gap-2.5 backdrop-blur-sm max-w-2xl mx-auto">
        <HelpIcon className="text-zinc-500 shrink-0 mt-0.5" size={16} />
        <div className="text-xs text-zinc-400 space-y-1">
          <p className="font-semibold text-zinc-200 font-display">Ingestion Workflow Advice:</p>
          <p>
            When you approve rows, QiFi creates balanced dual-entry postings, updates running ledger balances, and clears items from this review queue instantly.
          </p>
        </div>
      </div>
    </div>
  );
}
