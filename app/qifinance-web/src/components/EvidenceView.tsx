/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef } from 'react';
import { useQiStore } from '../store';
import { Transaction, Attachment, Account, Counterparty, AccountabilityObligation } from '../types';
import AttachmentPreviewModal from './AttachmentPreviewModal';
import { 
  FileText, ShieldAlert, CheckCircle, Upload, Trash2, 
  Eye, Image as ImageIcon, Calendar, Plus, Tag, HelpCircle, 
  FileCheck, Table, LayoutGrid, Search, Filter, ArrowUpRight, ArrowDownLeft, X,
  Building2, Database, Bookmark, AlertCircle, Users
} from 'lucide-react';

export default function EvidenceView() {
  const { 
    transactions, 
    attachments, 
    addAttachment, 
    deleteAttachment,
    accounts,
    counterparties,
    obligations,
    financialAccounts
  } = useQiStore();

  // Tab: 'transactions' | 'accounts' | 'counterparties' | 'obligations'
  const [activeTab, setActiveTab] = useState<'transactions' | 'accounts' | 'counterparties' | 'obligations'>('transactions');

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterReceiptStatus, setFilterReceiptStatus] = useState<'all' | 'missing' | 'documented'>('all');
  const [filterBankAccountId, setFilterBankAccountId] = useState('all');
  const [filterCounterparty, setFilterCounterparty] = useState('all');
  
  // Modal viewer state
  const [viewingAttachment, setViewingAttachment] = useState<Attachment | null>(null);

  // New file creators inside this dashboard
  const [uploadEntityId, setUploadEntityId] = useState('');
  const [customNotes, setCustomNotes] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Transactions List Filters
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const hasReceipt = attachments.some(a => a.transactionId === t.id);
      if (filterReceiptStatus === 'missing' && hasReceipt) return false;
      if (filterReceiptStatus === 'documented' && !hasReceipt) return false;
      if (filterBankAccountId !== 'all' && t.sourceAccountId !== filterBankAccountId) return false;
      if (filterCounterparty !== 'all' && t.counterparty !== filterCounterparty) return false;

      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        return (
          t.description.toLowerCase().includes(query) ||
          t.counterparty.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [transactions, attachments, filterReceiptStatus, filterBankAccountId, filterCounterparty, searchTerm]);

  // 2. Account attachments filtered
  const filteredAccountAttachments = useMemo(() => {
    return attachments.filter(a => a.accountId).filter(a => {
      const acc = accounts.find(ac => ac.id === a.accountId);
      if (!acc) return false;
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        return (
          a.fileName.toLowerCase().includes(query) ||
          acc.name.toLowerCase().includes(query) ||
          (a.notes && a.notes.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [attachments, accounts, searchTerm]);

  // 3. Counterparty attachments filtered
  const filteredCpAttachments = useMemo(() => {
    return attachments.filter(a => a.counterpartyId).filter(a => {
      const cp = counterparties.find(c => c.id === a.counterpartyId);
      if (!cp) return false;
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        return (
          a.fileName.toLowerCase().includes(query) ||
          cp.name.toLowerCase().includes(query) ||
          (a.notes && a.notes.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [attachments, counterparties, searchTerm]);

  // 4. Obligation attachments filtered
  const filteredOblAttachments = useMemo(() => {
    return attachments.filter(a => a.obligationId).filter(a => {
      const obl = obligations.find(o => o.id === a.obligationId);
      const cpName = obl ? counterparties.find(c => c.id === obl.counterpartyId)?.name || '' : '';
      if (!obl) return false;
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        return (
          a.fileName.toLowerCase().includes(query) ||
          obl.description.toLowerCase().includes(query) ||
          cpName.toLowerCase().includes(query) ||
          (a.notes && a.notes.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [attachments, obligations, counterparties, searchTerm]);

  // Document metrics coverage
  const documentedCount = useMemo(() => {
    const outflows = transactions.filter(t => t.amount < 0);
    return outflows.filter(t => attachments.some(a => a.transactionId === t.id)).length;
  }, [transactions, attachments]);

  const handleGlobalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && uploadEntityId) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const notes = customNotes.trim() || 'Uploaded via central evidence manager';
          if (activeTab === 'accounts') {
            addAttachment(null, file.name, file.type, event.target.result as string, notes, null, uploadEntityId);
          } else if (activeTab === 'counterparties') {
            addAttachment(null, file.name, file.type, event.target.result as string, notes, null, null, uploadEntityId);
          } else if (activeTab === 'obligations') {
            addAttachment(null, file.name, file.type, event.target.result as string, notes, null, null, null, uploadEntityId);
          }
          setUploadEntityId('');
          setCustomNotes('');
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAutoGenerateReceipt = (tx: Transaction) => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#18181b';
      ctx.fillRect(0, 0, 400, 480);
      ctx.strokeStyle = '#3f3f46';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(15, 15, 370, 450);
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 20px monospace';
      ctx.fillText("QIFI DIGITAL RECEIPT", 45, 65);
      ctx.fillStyle = '#a1a1aa';
      ctx.font = '11px monospace';
      ctx.fillText(`TXN-ID : ${tx.id.toUpperCase()}`, 45, 100);
      ctx.fillText(`POSTED : ${tx.date}`, 45, 120);
      ctx.fillText(`SENDER : ${tx.counterparty.toUpperCase()}`, 45, 140);
      ctx.fillText(`STATUS : CLEARED SLATE`, 45, 160);
      
      ctx.strokeStyle = '#27272a';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(40, 180);
      ctx.lineTo(360, 180);
      ctx.stroke();

      ctx.fillStyle = '#e4e4e7';
      ctx.font = '12px monospace';
      ctx.fillText(tx.description.substring(0, 24).toUpperCase(), 45, 215);
      ctx.fillText("QTY    : 1", 45, 235);
      ctx.fillText(`AMOUNT : $${Math.abs(tx.amount).toFixed(2)}`, 45, 255);

      ctx.beginPath();
      ctx.moveTo(40, 290);
      ctx.lineTo(360, 290);
      ctx.stroke();

      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 15px monospace';
      ctx.fillText(`TOTAL PAID : $${Math.abs(tx.amount).toFixed(2)}`, 45, 330);

      ctx.fillStyle = '#f4f4f5';
      for (let i = 0; i < 40; i++) {
        const w = Math.random() > 0.4 ? 4 : 2;
        ctx.fillRect(60 + (i * 7), 370, w, 40);
      }
    }
    const mockBase64 = canvas.toDataURL('image/png');
    addAttachment(
      tx.id,
      `receipt_${tx.id.substring(3, 10)}.png`,
      'image/png',
      mockBase64,
      'Autogenerated evidence backup'
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white font-display">
            Sovereign Document Hub
          </h2>
          <p className="text-xs text-zinc-400 font-sans mt-0.5">
            Manage tax compliance evidence, invoices, bank agreements, and contract records.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="bg-zinc-950 p-1 rounded-xl flex border border-zinc-800 shrink-0">
          <button
            onClick={() => { setActiveTab('transactions'); setSearchTerm(''); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeTab === 'transactions' ? 'bg-emerald-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Transactions
          </button>
          <button
            onClick={() => { setActiveTab('accounts'); setSearchTerm(''); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeTab === 'accounts' ? 'bg-emerald-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Accounts
          </button>
          <button
            onClick={() => { setActiveTab('counterparties'); setSearchTerm(''); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeTab === 'counterparties' ? 'bg-emerald-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Partners
          </button>
          <button
            onClick={() => { setActiveTab('obligations'); setSearchTerm(''); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeTab === 'obligations' ? 'bg-emerald-600 text-white shadow-md' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Bills / IOUs
          </button>
        </div>
      </div>

      {/* SEARCH AND FILTERS */}
      <div className="bg-zinc-900/40 p-4 rounded-2xl border border-zinc-800/80 shadow-xl backdrop-blur-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
          <input
            type="text"
            placeholder={`Search document logs...`}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-700"
          />
        </div>

        {/* Global Inline Document Uploader for Non-Transaction tabs */}
        {activeTab !== 'transactions' && (
          <div className="flex flex-wrap gap-2 items-center w-full md:w-auto justify-end">
            <select
              value={uploadEntityId}
              onChange={e => setUploadEntityId(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-300 font-medium focus:outline-none"
            >
              <option value="">-- Choose entity to link doc --</option>
              {activeTab === 'accounts' && accounts.map(a => <option key={a.id} value={a.id}>({a.code}) {a.name}</option>)}
              {activeTab === 'counterparties' && counterparties.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              {activeTab === 'obligations' && obligations.map(o => {
                const cpName = counterparties.find(cp => cp.id === o.counterpartyId)?.name || 'Unknown';
                return <option key={o.id} value={o.id}>{cpName}: ${o.amount} ({o.description.substring(0,18)}...)</option>;
              })}
            </select>
            
            <input 
              type="text"
              placeholder="Notes/Purpose..."
              value={customNotes}
              onChange={e => setCustomNotes(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-100 focus:outline-none"
            />

            <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${uploadEntityId ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500' : 'bg-zinc-850 text-zinc-500 border-zinc-800 cursor-not-allowed'}`}>
              <Upload size={12} /> Link Document
              <input 
                type="file" 
                ref={fileInputRef}
                accept="image/*,application/pdf,text/*,.csv,.tsv,.txt,.md,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                capture="environment"
                className="hidden" 
                disabled={!uploadEntityId}
                onChange={handleGlobalFileUpload} 
              />
            </label>
          </div>
        )}

        {/* Transactions Tab specific filter controls */}
        {activeTab === 'transactions' && (
          <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
            <select
              value={filterReceiptStatus}
              onChange={e => setFilterReceiptStatus(e.target.value as any)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-300 focus:outline-none"
            >
              <option value="all">Status: All</option>
              <option value="missing">Missing Receipts</option>
              <option value="documented">Documented</option>
            </select>

            <select
              value={filterBankAccountId}
              onChange={e => setFilterBankAccountId(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none"
            >
              <option value="all">Account: All</option>
              {financialAccounts.map(fa => (
                <option key={fa.id} value={fa.id}>{fa.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* CONTENT LOGS BY ACTIVE TAB */}
      
      {/* 1. TRANSACTIONS TAB */}
      {activeTab === 'transactions' && (
        <div className="bg-zinc-900/40 rounded-2xl border border-zinc-800/80 shadow-2xl overflow-hidden backdrop-blur-sm animate-fadeIn">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300 border-collapse">
              <thead>
                <tr className="bg-zinc-950 text-zinc-400 uppercase tracking-wider text-[10px] font-mono border-b border-zinc-800/80">
                  <th className="py-4 px-4 w-[110px]">Date</th>
                  <th className="py-4 px-3">Merchant / Counterparty</th>
                  <th className="py-4 px-3">Memo Description</th>
                  <th className="py-4 px-3 text-right">Amount</th>
                  <th className="py-4 px-4 text-center">Receipt Status / Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {filteredTransactions.map(tx => {
                  const txAttachments = attachments.filter(a => a.transactionId === tx.id);
                  const hasReceipt = txAttachments.length > 0;
                  return (
                    <tr key={tx.id} className="hover:bg-zinc-900/30 transition-all">
                      <td className="py-3.5 px-4 font-mono text-zinc-400">{tx.date}</td>
                      <td className="py-3.5 px-3 font-semibold text-zinc-200">{tx.counterparty || 'Manual Entry'}</td>
                      <td className="py-3.5 px-3 text-zinc-300 truncate max-w-xs">{tx.description}</td>
                      <td className="py-3.5 px-3 text-right font-mono font-bold">
                        <span className={tx.amount < 0 ? 'text-rose-400' : 'text-emerald-400'}>
                          ${Math.abs(tx.amount).toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {hasReceipt ? (
                          <div className="flex items-center justify-between gap-2 bg-emerald-950/20 border border-emerald-900/30 py-1 px-2.5 rounded-lg">
                            <span className="text-emerald-400 font-bold truncate max-w-[150px]">{txAttachments[0].fileName}</span>
                            <div className="flex gap-1.5 shrink-0">
                              <button onClick={() => setViewingAttachment(txAttachments[0])} className="p-1 hover:text-white text-zinc-400 cursor-pointer"><Eye size={12} /></button>
                              <button onClick={() => deleteAttachment(txAttachments[0].id)} className="p-1 hover:text-rose-400 text-zinc-400 cursor-pointer"><Trash2 size={12} /></button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 justify-end">
                            <label className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 hover:border-emerald-500/40 hover:bg-emerald-500/5 text-zinc-400 hover:text-emerald-400 px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all">
                              <Upload size={11} /> Upload
                              <input type="file" accept="image/*,application/pdf,text/*,.csv,.tsv,.txt,.md,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx" capture="environment" className="hidden" onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  const file = e.target.files[0];
                                  const reader = new FileReader();
                                  reader.onload = (ev) => {
                                    if (ev.target?.result) addAttachment(tx.id, file.name, file.type, ev.target.result as string, 'Uploaded manually');
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }} />
                            </label>
                            <button onClick={() => handleAutoGenerateReceipt(tx)} className="flex items-center gap-1 bg-zinc-950 border border-zinc-800 hover:border-emerald-500/40 hover:bg-emerald-500/5 text-zinc-400 hover:text-emerald-400 px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition-all">Autogen</button>
                            <span className="text-[10px] text-amber-500 flex items-center gap-0.5"><ShieldAlert size={10} /> missing</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. ACCOUNTS TAB */}
      {activeTab === 'accounts' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
          {filteredAccountAttachments.length === 0 ? (
            <div className="col-span-2 bg-zinc-900/40 p-12 text-center border border-zinc-800/80 rounded-2xl">
              <Database className="mx-auto text-zinc-600 mb-2" size={32} />
              <span className="text-xs text-zinc-400 italic block">No account agreement files uploaded yet. Select a bank account above to upload files.</span>
            </div>
          ) : (
            filteredAccountAttachments.map(a => {
              const acc = accounts.find(ac => ac.id === a.accountId);
              return (
                <div key={a.id} className="bg-zinc-900/40 p-4 border border-zinc-800/80 rounded-xl flex justify-between items-center">
                  <div className="min-w-0 space-y-1">
                    <span className="text-xs font-semibold text-zinc-200 block truncate">{a.fileName}</span>
                    <div className="flex gap-1.5 text-[9px] text-zinc-500 font-mono">
                      <span>Account: {acc?.name}</span>
                      <span>•</span>
                      <span>Uploaded: {new Date(a.uploadedAt).toLocaleDateString()}</span>
                    </div>
                    {a.notes && <span className="text-[10px] text-zinc-400 italic block truncate max-w-xs">{a.notes}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <button onClick={() => setViewingAttachment(a)} className="text-zinc-400 hover:text-white cursor-pointer"><Eye size={14} /></button>
                    <button onClick={() => deleteAttachment(a.id)} className="text-zinc-400 hover:text-rose-450 cursor-pointer"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 3. PARTNERS / COUNTERPARTIES TAB */}
      {activeTab === 'counterparties' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
          {filteredCpAttachments.length === 0 ? (
            <div className="col-span-2 bg-zinc-900/40 p-12 text-center border border-zinc-800/80 rounded-2xl">
              <Users className="mx-auto text-zinc-600 mb-2" size={32} />
              <span className="text-xs text-zinc-400 italic block">No partner agreements or contract records links uploaded yet. Select a partner above to upload.</span>
            </div>
          ) : (
            filteredCpAttachments.map(a => {
              const cp = counterparties.find(c => c.id === a.counterpartyId);
              return (
                <div key={a.id} className="bg-zinc-900/40 p-4 border border-zinc-800/80 rounded-xl flex justify-between items-center">
                  <div className="min-w-0 space-y-1">
                    <span className="text-xs font-semibold text-zinc-200 block truncate">{a.fileName}</span>
                    <div className="flex gap-1.5 text-[9px] text-zinc-500 font-mono">
                      <span>Partner: {cp?.name}</span>
                      <span>•</span>
                      <span>Uploaded: {new Date(a.uploadedAt).toLocaleDateString()}</span>
                    </div>
                    {a.notes && <span className="text-[10px] text-zinc-400 italic block truncate max-w-xs">{a.notes}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <button onClick={() => setViewingAttachment(a)} className="text-zinc-400 hover:text-white cursor-pointer"><Eye size={14} /></button>
                    <button onClick={() => deleteAttachment(a.id)} className="text-zinc-400 hover:text-rose-450 cursor-pointer"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 4. OBLIGATIONS / BILLS TAB */}
      {activeTab === 'obligations' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
          {filteredOblAttachments.length === 0 ? (
            <div className="col-span-2 bg-zinc-900/40 p-12 text-center border border-zinc-800/80 rounded-2xl">
              <FileText className="mx-auto text-zinc-600 mb-2" size={32} />
              <span className="text-xs text-zinc-400 italic block">No obligation invoice documents or bills uploaded yet. Select a bill above to upload.</span>
            </div>
          ) : (
            filteredOblAttachments.map(a => {
              const obl = obligations.find(o => o.id === a.obligationId);
              const cp = obl ? counterparties.find(c => c.id === obl.counterpartyId) : null;
              return (
                <div key={a.id} className="bg-zinc-900/40 p-4 border border-zinc-800/80 rounded-xl flex justify-between items-center">
                  <div className="min-w-0 space-y-1">
                    <span className="text-xs font-semibold text-zinc-200 block truncate">{a.fileName}</span>
                    <div className="flex gap-1.5 text-[9px] text-zinc-500 font-mono">
                      <span>Obligation: {cp?.name || 'Partner'} (${obl?.amount})</span>
                      <span>•</span>
                      <span>Uploaded: {new Date(a.uploadedAt).toLocaleDateString()}</span>
                    </div>
                    {a.notes && <span className="text-[10px] text-zinc-400 italic block truncate max-w-xs">{a.notes}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <button onClick={() => setViewingAttachment(a)} className="text-zinc-400 hover:text-white cursor-pointer"><Eye size={14} /></button>
                    <button onClick={() => deleteAttachment(a.id)} className="text-zinc-400 hover:text-rose-455 cursor-pointer"><Trash2 size={14} /></button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <AttachmentPreviewModal attachment={viewingAttachment} onClose={() => setViewingAttachment(null)} />

    </div>
  );
}
