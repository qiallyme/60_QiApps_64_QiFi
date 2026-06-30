/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useQiStore } from '../store';
import { Transaction, Attachment } from '../types';
import { 
  FileText, ShieldAlert, CheckCircle, Upload, Trash2, 
  Eye, Image as ImageIcon, Calendar, Plus, Tag, HelpCircle, 
  FileCheck, Table, LayoutGrid, Search, Filter, ArrowUpRight, ArrowDownLeft, X
} from 'lucide-react';

export default function EvidenceView() {
  const { 
    transactions, 
    attachments, 
    addAttachment, 
    deleteAttachment,
    accounts,
    counterparties
  } = useQiStore();

  // Tab View Mode: 'grid' | 'ledger'
  const [viewMode, setViewMode] = useState<'grid' | 'ledger'>('ledger');

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterReceiptStatus, setFilterReceiptStatus] = useState<'all' | 'missing' | 'documented'>('all');
  const [filterBankAccountId, setFilterBankAccountId] = useState('all');
  const [filterCounterparty, setFilterCounterparty] = useState('all');
  const [filterTag, setFilterTag] = useState('all');
  const [filterFlowType, setFilterFlowType] = useState<'all' | 'outflow' | 'inflow'>('all');
  
  // Selected Attachment to view in modal
  const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null);

  // Dynamic filter lists
  const uniqueTags = useMemo(() => {
    const tagsSet = new Set<string>();
    transactions.forEach(t => t.tags.forEach(tag => tagsSet.add(tag)));
    return Array.from(tagsSet).sort();
  }, [transactions]);

  const uniqueCounterparties = useMemo(() => {
    const cpSet = new Set<string>();
    transactions.forEach(t => {
      if (t.counterparty) cpSet.add(t.counterparty);
    });
    return Array.from(cpSet).sort();
  }, [transactions]);

  const bankAccounts = useMemo(() => {
    return accounts.filter(a => ['asset', 'liability'].includes(a.type));
  }, [accounts]);

  // Filter logic
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      // 1. Filter by Receipt Status
      const hasReceipt = attachments.some(a => a.transactionId === t.id);
      if (filterReceiptStatus === 'missing' && hasReceipt) return false;
      if (filterReceiptStatus === 'documented' && !hasReceipt) return false;

      // 2. Filter by Bank Account
      if (filterBankAccountId !== 'all' && t.sourceAccountId !== filterBankAccountId) return false;

      // 3. Filter by Counterparty
      if (filterCounterparty !== 'all' && t.counterparty !== filterCounterparty) return false;

      // 4. Filter by Tag
      if (filterTag !== 'all' && !t.tags.includes(filterTag)) return false;

      // 5. Filter by Flow Type
      if (filterFlowType === 'outflow' && t.amount > 0) return false;
      if (filterFlowType === 'inflow' && t.amount < 0) return false;

      // 6. Search Term Match
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const matchesText = 
          t.description.toLowerCase().includes(query) ||
          t.counterparty.toLowerCase().includes(query) ||
          (t.rawDescription && t.rawDescription.toLowerCase().includes(query));
        if (!matchesText) return false;
      }

      return true;
    });
  }, [transactions, attachments, filterReceiptStatus, filterBankAccountId, filterCounterparty, filterTag, filterFlowType, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const outflows = transactions.filter(t => t.amount < 0);
    const outflowWithReceipts = outflows.filter(t => attachments.some(a => a.transactionId === t.id));
    const coveragePercentage = outflows.length > 0 ? Math.round((outflowWithReceipts.length / outflows.length) * 100) : 100;
    
    return {
      totalOutflows: outflows.length,
      documentedCount: outflowWithReceipts.length,
      missingCount: outflows.length - outflowWithReceipts.length,
      coveragePercentage
    };
  }, [transactions, attachments]);

  const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>, txId: string) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          addAttachment(
            txId,
            file.name,
            file.type,
            event.target.result as string,
            'Receipt uploaded manually'
          );
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Automated Mock Receipt generator
  const handleAutoGenerateReceipt = (tx: Transaction) => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // background
      ctx.fillStyle = '#18181b'; // zinc-900 background matching theme
      ctx.fillRect(0, 0, 400, 500);

      // border dashed
      ctx.strokeStyle = '#3f3f46'; // zinc-700
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(15, 15, 370, 470);

      // Receipt header
      ctx.fillStyle = '#10b981'; // emerald-500
      ctx.font = 'bold 22px monospace';
      ctx.fillText("QIFI DIGITAL RECEIPT", 40, 65);
      
      ctx.fillStyle = '#a1a1aa'; // zinc-400
      ctx.font = '11px monospace';
      ctx.fillText(`TXN-ID : ${tx.id.toUpperCase()}`, 40, 100);
      ctx.fillText(`POSTED : ${tx.date}`, 40, 120);
      ctx.fillText(`SENDER : ${tx.counterparty.toUpperCase()}`, 40, 140);
      ctx.fillText(`STATUS : LEDGER CLEARED`, 40, 160);

      // line separator
      ctx.strokeStyle = '#27272a'; // zinc-800
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(40, 180);
      ctx.lineTo(360, 180);
      ctx.stroke();

      // items
      ctx.fillStyle = '#e4e4e7'; // zinc-200
      ctx.font = '13px monospace';
      ctx.fillText(tx.description.substring(0, 24).toUpperCase(), 40, 215);
      ctx.fillText("QTY    : 1", 40, 235);
      ctx.fillText(`AMOUNT : $${Math.abs(tx.amount).toFixed(2)}`, 40, 255);
      ctx.fillText("FEE    : $0.00 (WAIVED)", 40, 275);

      ctx.beginPath();
      ctx.moveTo(40, 305);
      ctx.lineTo(360, 305);
      ctx.stroke();

      // total
      ctx.fillStyle = '#34d399'; // emerald-400
      ctx.font = 'bold 16px monospace';
      ctx.fillText(`TOTAL PAID : $${Math.abs(tx.amount).toFixed(2)}`, 40, 345);

      // barcode
      ctx.fillStyle = '#f4f4f5'; // zinc-100
      for (let i = 0; i < 42; i++) {
        const w = Math.random() > 0.4 ? 4 : 2;
        ctx.fillRect(55 + (i * 7), 390, w, 45);
      }
      ctx.fillStyle = '#71717a'; // zinc-500
      ctx.font = '9px monospace';
      ctx.fillText("* DOUBLE ENTRY REGISTERED *", 110, 460);
    }

    const mockBase64 = canvas.toDataURL('image/png');
    addAttachment(
      tx.id,
      `receipt_${tx.id.substring(3, 10)}_${Date.now().toString().slice(-4)}.png`,
      'image/png',
      mockBase64,
      `Autogenerated on ${new Date().toLocaleDateString()}`
    );
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white font-display" id="receipts-title">
            Receipts & Financial Documents
          </h2>
          <p className="text-sm text-zinc-400 font-sans mt-0.5">
            Attach source evidence to transaction ledger items for tax compliance and audit-ready records.
          </p>
        </div>

        {/* WORKSPACE VIEW TOGGLE */}
        <div className="bg-zinc-950 p-1 rounded-xl flex self-start sm:self-center border border-zinc-800 shrink-0">
          <button
            onClick={() => setViewMode('ledger')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'ledger'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Table size={14} /> Documents Ledger View
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <LayoutGrid size={14} /> Receipt Cards Grid
          </button>
        </div>
      </div>

      {/* QUICK STATUS SUMMARY */}
      <div className="bg-zinc-900/40 border border-zinc-800/80 p-5 rounded-2xl grid grid-cols-1 sm:grid-cols-4 gap-4 shadow-xl backdrop-blur-sm">
        <div className="sm:col-span-2 flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-emerald-950/40 text-emerald-400 border border-emerald-900/30">
            <FileCheck size={22} />
          </div>
          <div>
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider block font-mono">Documentation Coverage</span>
            <span className="text-lg font-bold text-white mt-0.5 block font-display">
              {stats.documentedCount} of {stats.totalOutflows} Expenses Documented
            </span>
          </div>
        </div>
        <div className="flex flex-col justify-center border-t sm:border-t-0 sm:border-l border-zinc-800/60 sm:pl-5">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Missing Receipts</span>
          <span className="text-xl font-bold text-amber-400 mt-0.5 font-mono">{stats.missingCount} pending</span>
        </div>
        <div className="flex flex-col justify-center border-t sm:border-t-0 sm:border-l border-zinc-800/60 sm:pl-5">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider font-mono">Coverage Velocity</span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-xl font-bold text-emerald-400 mt-0.5 font-mono">{stats.coveragePercentage}%</span>
            <span className="text-[10px] text-zinc-400">target 100%</span>
          </div>
        </div>
      </div>

      {/* COMPREHENSIVE FILTER PANEL */}
      <div className="bg-zinc-900/40 p-4 rounded-2xl border border-zinc-800/80 shadow-xl backdrop-blur-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          
          {/* Search Box */}
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" size={15} />
            <input
              type="text"
              placeholder="Search memo/merchant..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-700"
            />
          </div>

          {/* Filtering controls */}
          <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
              <Filter size={13} />
              Filters:
            </div>

            {/* Receipt Status Filter */}
            <select
              value={filterReceiptStatus}
              onChange={e => setFilterReceiptStatus(e.target.value as any)}
              className="bg-zinc-950/85 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 font-medium focus:outline-none focus:border-zinc-700"
            >
              <option value="all">Receipt Status: All</option>
              <option value="missing">Missing Receipts</option>
              <option value="documented">Documented Only</option>
            </select>

            {/* Bank Account Filter */}
            <select
              value={filterBankAccountId}
              onChange={e => setFilterBankAccountId(e.target.value)}
              className="bg-zinc-950/85 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 font-medium focus:outline-none focus:border-zinc-700"
            >
              <option value="all">Bank Account: All</option>
              {bankAccounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>

            {/* Counterparty Filter */}
            <select
              value={filterCounterparty}
              onChange={e => setFilterCounterparty(e.target.value)}
              className="bg-zinc-950/85 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 font-medium focus:outline-none focus:border-zinc-700"
            >
              <option value="all">Counterparty: All</option>
              {uniqueCounterparties.map(cp => (
                <option key={cp} value={cp}>{cp}</option>
              ))}
            </select>

            {/* Tag Filter */}
            <select
              value={filterTag}
              onChange={e => setFilterTag(e.target.value)}
              className="bg-zinc-950/85 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 font-medium focus:outline-none focus:border-zinc-700"
            >
              <option value="all">Tag: All</option>
              {uniqueTags.map(t => (
                <option key={t} value={t}>#{t}</option>
              ))}
            </select>

            {/* Flow Type Filter */}
            <select
              value={filterFlowType}
              onChange={e => setFilterFlowType(e.target.value as any)}
              className="bg-zinc-950/85 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 font-medium focus:outline-none focus:border-zinc-700"
            >
              <option value="all">Transaction Type: All</option>
              <option value="outflow">Outflow (Expense)</option>
              <option value="inflow">Inflow (Income)</option>
            </select>

          </div>
        </div>
      </div>

      {/* FILTERED RESULTS COUNT */}
      <div className="flex justify-between items-center text-xs text-zinc-400">
        <span>Showing {filteredTransactions.length} of {transactions.length} total ledger transactions</span>
        {(searchTerm || filterReceiptStatus !== 'all' || filterBankAccountId !== 'all' || filterCounterparty !== 'all' || filterTag !== 'all' || filterFlowType !== 'all') && (
          <button
            onClick={() => {
              setSearchTerm('');
              setFilterReceiptStatus('all');
              setFilterBankAccountId('all');
              setFilterCounterparty('all');
              setFilterTag('all');
              setFilterFlowType('all');
            }}
            className="text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* VIEW 1: SPREADSHEET LEDGER VIEW */}
      {viewMode === 'ledger' && (
        <div className="bg-zinc-900/40 rounded-2xl border border-zinc-800/80 shadow-2xl overflow-hidden backdrop-blur-sm animate-fadeIn" id="receipts-ledger-table-container">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs text-zinc-300">
              <thead>
                <tr className="bg-zinc-950 text-zinc-400 uppercase tracking-wider text-[10px] font-mono border-b border-zinc-800/80 select-none">
                  <th className="py-4 px-4 w-[110px]">Date</th>
                  <th className="py-4 px-3 min-w-[140px]">Counterparty / Merchant</th>
                  <th className="py-4 px-3 min-w-[180px]">Memo Description</th>
                  <th className="py-4 px-3 min-w-[130px]">Bank Account</th>
                  <th className="py-4 px-3 min-w-[130px]">Flow Type</th>
                  <th className="py-4 px-3 min-w-[140px]">Tags</th>
                  <th className="py-4 px-3 text-right w-[110px]">Amount</th>
                  <th className="py-4 px-4 text-center min-w-[180px]">Receipt Document Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40 font-sans">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 px-4 text-center text-zinc-500 font-medium">
                      No matching transactions found with the active filters.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map(tx => {
                    const txAttachments = attachments.filter(a => a.transactionId === tx.id);
                    const hasReceipt = txAttachments.length > 0;
                    const bankAcc = accounts.find(a => a.id === tx.sourceAccountId);

                    return (
                      <tr key={tx.id} className="hover:bg-zinc-900/30 transition-all">
                        {/* Date */}
                        <td className="py-3 px-4 font-mono text-zinc-400">{tx.date}</td>

                        {/* Counterparty */}
                        <td className="py-3 px-3 font-semibold text-zinc-200">{tx.counterparty}</td>

                        {/* Memo */}
                        <td className="py-3 px-3 text-zinc-300 leading-normal max-w-xs truncate" title={tx.description}>
                          {tx.description}
                        </td>

                        {/* Bank Account */}
                        <td className="py-3 px-3">
                          <span className="font-mono text-[10px] bg-zinc-950 border border-zinc-800 px-2 py-1 rounded text-zinc-400">
                            {bankAcc?.name || 'Manual'}
                          </span>
                        </td>

                        {/* Flow Type */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1 text-[11px]">
                            {tx.amount < 0 ? (
                              <span className="text-rose-400 flex items-center gap-0.5 font-medium">
                                <ArrowDownLeft size={12} /> Outflow
                              </span>
                            ) : (
                              <span className="text-emerald-400 flex items-center gap-0.5 font-medium">
                                <ArrowUpRight size={12} /> Inflow
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Tags */}
                        <td className="py-3 px-3">
                          <div className="flex flex-wrap gap-1 max-w-[150px]">
                            {tx.tags.map(tag => (
                              <span key={tag} className="text-[9px] bg-zinc-800/40 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-700/20">
                                #{tag}
                              </span>
                            ))}
                            {tx.tags.length === 0 && <span className="text-zinc-600 italic text-[10px]">none</span>}
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="py-3 px-3 text-right font-mono font-semibold">
                          <span className={tx.amount < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                            {tx.amount < 0 ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
                          </span>
                        </td>

                        {/* Document Status / Action */}
                        <td className="py-3 px-4">
                          {hasReceipt ? (
                            <div className="flex items-center justify-between gap-2 bg-emerald-950/20 border border-emerald-900/30 py-1 px-2.5 rounded-lg">
                              <span className="text-emerald-400 text-[11px] font-bold flex items-center gap-1 truncate max-w-[120px]" title={txAttachments[0].fileName}>
                                <CheckCircle size={12} /> {txAttachments[0].fileName}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  onClick={() => setViewingAttachment(txAttachments[0])}
                                  className="p-1 hover:bg-zinc-800 hover:text-white rounded text-zinc-400 transition-all cursor-pointer"
                                  title="View receipt document"
                                >
                                  <Eye size={12} />
                                </button>
                                <button
                                  onClick={() => deleteAttachment(txAttachments[0].id)}
                                  className="p-1 hover:bg-zinc-800 hover:text-rose-400 rounded text-zinc-400 transition-all cursor-pointer"
                                  title="Remove attachment"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {/* Photo upload button */}
                              <label className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 hover:border-emerald-500/40 hover:bg-emerald-500/5 text-zinc-400 hover:text-emerald-400 px-2 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all shrink-0">
                                <Upload size={12} /> Upload
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  className="hidden" 
                                  onChange={(e) => handleFileLoad(e, tx.id)} 
                                />
                              </label>

                              {/* Autogenerate receipt */}
                              <button
                                onClick={() => handleAutoGenerateReceipt(tx)}
                                className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 hover:border-emerald-500/40 hover:bg-emerald-500/5 text-zinc-400 hover:text-emerald-400 px-2 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer transition-all shrink-0"
                                title="Instantly construct a professional mockup invoice receipt"
                              >
                                <ImageIcon size={12} /> Autogen
                              </button>

                              <span className="text-[10px] text-amber-500 font-medium flex items-center gap-0.5 shrink-0">
                                <ShieldAlert size={10} /> missing
                              </span>
                            </div>
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
      )}

      {/* VIEW 2: TRADITIONAL GRID VIEW */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn" id="receipts-grid-container">
          {filteredTransactions.length === 0 ? (
            <div className="bg-zinc-900/40 p-12 rounded-2xl border border-zinc-800/80 shadow-xl text-center md:col-span-2 space-y-3 backdrop-blur-sm">
              <CheckCircle className="mx-auto text-emerald-400" size={32} />
              <p className="text-zinc-300 font-semibold text-sm">No expenses match this filter!</p>
              <p className="text-zinc-500 text-xs">Everything is neatly documented, or no transaction logs exist.</p>
            </div>
          ) : (
            filteredTransactions.map(tx => {
              const txAttachments = attachments.filter(a => a.transactionId === tx.id);
              const sourceAcc = accounts.find(a => a.id === tx.sourceAccountId);

              return (
                <div key={tx.id} className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/80 shadow-xl flex flex-col justify-between space-y-4 backdrop-blur-sm hover:border-zinc-700/60 transition-all">
                  
                  {/* Top Section */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-zinc-100 text-sm block truncate max-w-[180px]">{tx.counterparty}</span>
                      <span className={`font-mono font-bold text-sm ${tx.amount < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {tx.amount < 0 ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400 flex items-center gap-1.5 flex-wrap">
                      <Calendar size={12} />
                      <span>{tx.date}</span>
                      <span>•</span>
                      <span className="font-mono bg-zinc-800/60 text-zinc-300 text-[10px] px-1.5 py-0.5 rounded border border-zinc-700/20">{sourceAcc?.name}</span>
                    </div>
                    <p className="text-xs text-zinc-500 italic line-clamp-1">{tx.description}</p>
                    {/* Tags */}
                    {tx.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {tx.tags.map(t => (
                          <span key={t} className="text-[9px] text-zinc-400 bg-zinc-800/30 px-1.5 py-0.2 rounded">#{t}</span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Attachments Display */}
                  {txAttachments.length > 0 ? (
                    <div className="space-y-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Receipts Attached:</div>
                      {txAttachments.map(attach => (
                        <div key={attach.id} className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 flex gap-3 items-center">
                          {attach.dataUrl.startsWith('data:image') || attach.dataUrl.includes('unsplash') ? (
                            <img 
                              src={attach.dataUrl} 
                              alt={attach.fileName} 
                              referrerPolicy="no-referrer"
                              onClick={() => setViewingAttachment(attach)}
                              className="w-12 h-12 rounded object-cover border border-zinc-800 shrink-0 cursor-pointer hover:opacity-80 transition-all" 
                            />
                          ) : (
                            <div className="w-12 h-12 bg-zinc-900 text-zinc-400 rounded flex items-center justify-center shrink-0">
                              <FileText size={18} />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-semibold text-zinc-200 block truncate leading-tight">{attach.fileName}</span>
                            <span className="text-[10px] text-zinc-400 block mt-0.5 italic">{attach.notes}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setViewingAttachment(attach)}
                              className="text-zinc-400 hover:text-white cursor-pointer"
                              title="Inspect document"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => deleteAttachment(attach.id)}
                              className="text-zinc-400 hover:text-rose-400 cursor-pointer"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* Upload Prompt */
                    <div className="space-y-3">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                        <ShieldAlert size={12} /> Missing Receipt
                      </div>
                      
                      {/* Photo Upload Options */}
                      <div className="grid grid-cols-2 gap-2">
                        
                        <label className="border border-dashed border-zinc-800 hover:border-emerald-500/50 bg-zinc-950 hover:bg-emerald-500/5 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition-all h-20">
                          <Upload className="text-zinc-400 hover:text-emerald-400 mb-1" size={18} />
                          <span className="text-[10px] font-bold text-zinc-400">Upload Photo</span>
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => handleFileLoad(e, tx.id)} 
                          />
                        </label>

                        <button
                          onClick={() => handleAutoGenerateReceipt(tx)}
                          className="border border-dashed border-zinc-800 hover:border-emerald-500/50 bg-zinc-950 hover:bg-emerald-500/5 rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition-all h-20 text-zinc-400 hover:text-emerald-400"
                        >
                          <ImageIcon className="text-zinc-400 mb-1" size={18} />
                          <span className="text-[10px] font-bold">Auto Receipt</span>
                        </button>

                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* LIGHTBOX DOCUMENT VIEW MODAL */}
      {viewingAttachment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md animate-fadeIn" id="document-lightbox">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl max-w-lg w-full flex flex-col animate-scaleUp">
            {/* Header */}
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/40">
              <div className="flex items-center gap-2">
                <FileText className="text-emerald-400" size={18} />
                <h3 className="font-bold text-white text-sm truncate max-w-[280px] font-display">{viewingAttachment.fileName}</h3>
              </div>
              <button
                onClick={() => setViewingAttachment(null)}
                className="text-zinc-400 hover:text-white bg-zinc-800 p-1.5 rounded-lg transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Document Content */}
            <div className="p-6 flex items-center justify-center bg-zinc-950 min-h-[300px]">
              {viewingAttachment.dataUrl.startsWith('data:image') || viewingAttachment.dataUrl.includes('unsplash') ? (
                <img 
                  src={viewingAttachment.dataUrl} 
                  alt={viewingAttachment.fileName} 
                  referrerPolicy="no-referrer"
                  className="max-h-[400px] w-auto object-contain rounded-xl border border-zinc-800 shadow-lg" 
                />
              ) : (
                <div className="text-center space-y-2">
                  <FileText className="mx-auto text-zinc-600" size={64} />
                  <p className="text-zinc-400 text-xs">Binary document format ({viewingAttachment.fileType})</p>
                </div>
              )}
            </div>

            {/* Notes Footer */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-950/25 space-y-1.5">
              <span className="text-[10px] uppercase font-mono text-zinc-500 font-bold">Description / OCR Meta Notes:</span>
              <p className="text-xs text-zinc-300 italic leading-relaxed">
                {viewingAttachment.notes || 'No meta-notes written.'}
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
