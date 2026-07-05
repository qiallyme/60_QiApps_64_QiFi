/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useQiStore } from '../store';
import { AccountabilityObligation } from '../types';
import AttachmentPreviewModal from './AttachmentPreviewModal';
import { 
  ShieldAlert, AlertTriangle, CheckSquare, PlusCircle, Calendar, 
  Trash2, User, Building2, HelpCircle, Tag, DollarSign, RefreshCw, Check
} from 'lucide-react';

export default function AccountabilityView() {
  const { 
    obligations, 
    counterparties, 
    addObligation, 
    updateObligation, 
    deleteObligation,
    attachments,
    addAttachment,
    deleteAttachment
  } = useQiStore();

  const [expandedOblId, setExpandedOblId] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<any>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleOblFileUpload = (oblId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          addAttachment(
            null,
            file.name,
            file.type,
            event.target.result as string,
            'Linked invoice or receipt proof',
            null,
            null,
            null,
            oblId
          );
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Filters
  const [activeFilter, setActiveFilter] = useState<string>('active'); // active, all, resolved, owed_to_me, i_owe, reimbursable, disputed
  const [showAddForm, setShowAddForm] = useState(() => {
    return !!localStorage.getItem('qifi_draft_obligation_global');
  });

  // New Obligation Form State
  const [oblAmount, setOblAmount] = useState(() => {
    const draft = localStorage.getItem('qifi_draft_obligation_global');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.oblAmount !== undefined) return parsed.oblAmount;
      } catch (e) {}
    }
    return '';
  });

  const [oblCpId, setOblCpId] = useState(() => {
    const draft = localStorage.getItem('qifi_draft_obligation_global');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.oblCpId !== undefined) return parsed.oblCpId;
      } catch (e) {}
    }
    return '';
  });

  const [oblType, setOblType] = useState<AccountabilityObligation['type']>(() => {
    const draft = localStorage.getItem('qifi_draft_obligation_global');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.oblType) return parsed.oblType;
      } catch (e) {}
    }
    return 'owed_to_me';
  });

  const [oblDesc, setOblDesc] = useState(() => {
    const draft = localStorage.getItem('qifi_draft_obligation_global');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.oblDesc !== undefined) return parsed.oblDesc;
      } catch (e) {}
    }
    return '';
  });

  const [oblDueDate, setOblDueDate] = useState(() => {
    const draft = localStorage.getItem('qifi_draft_obligation_global');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.oblDueDate !== undefined) return parsed.oblDueDate;
      } catch (e) {}
    }
    return '';
  });

  const [isDraftSaved, setIsDraftSaved] = useState(false);

  React.useEffect(() => {
    const hasValue = !!(
      oblAmount ||
      oblCpId ||
      oblDesc ||
      oblDueDate ||
      oblType !== 'owed_to_me'
    );

    if (hasValue) {
      const draft = {
        oblAmount,
        oblCpId,
        oblType,
        oblDesc,
        oblDueDate
      };
      localStorage.setItem('qifi_draft_obligation_global', JSON.stringify(draft));
      setIsDraftSaved(true);
    } else {
      localStorage.removeItem('qifi_draft_obligation_global');
      setIsDraftSaved(false);
    }
  }, [oblAmount, oblCpId, oblType, oblDesc, oblDueDate]);

  // Map counterparties by id for quick name lookups
  const cpMap = useMemo(() => {
    const map = new Map<string, string>();
    counterparties.forEach(cp => map.set(cp.id, cp.name));
    return map;
  }, [counterparties]);

  // Calculations for summary boxes
  const summaries = useMemo(() => {
    const active = obligations.filter(o => o.status === 'active');
    
    const owedToMe = active
      .filter(o => ['owed_to_me', 'reimbursable', 'pending_reimbursement'].includes(o.type))
      .reduce((sum, o) => sum + o.amount, 0);

    const iOwe = active
      .filter(o => o.type === 'i_owe')
      .reduce((sum, o) => sum + o.amount, 0);

    const disputed = active
      .filter(o => o.type === 'disputed')
      .reduce((sum, o) => sum + o.amount, 0);

    return {
      owedToMe,
      iOwe,
      disputed,
      net: owedToMe - iOwe
    };
  }, [obligations]);

  // Filter lists
  const filteredObligations = useMemo(() => {
    return obligations.filter(ob => {
      if (activeFilter === 'all') return true;
      if (activeFilter === 'active') return ob.status === 'active';
      if (activeFilter === 'resolved') return ob.status === 'resolved';
      if (activeFilter === 'owed_to_me') return ob.status === 'active' && ['owed_to_me', 'reimbursable', 'pending_reimbursement'].includes(ob.type);
      if (activeFilter === 'i_owe') return ob.status === 'active' && ob.type === 'i_owe';
      if (activeFilter === 'reimbursable') return ob.status === 'active' && ob.type === 'reimbursable';
      if (activeFilter === 'disputed') return ob.status === 'active' && ob.type === 'disputed';
      return true;
    });
  }, [obligations, activeFilter]);

  // Submit Obligation
  const handleAddObligation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!oblCpId || !oblAmount || isNaN(parseFloat(oblAmount)) || !oblDesc.trim()) return;

    addObligation({
      counterpartyId: oblCpId,
      amount: parseFloat(oblAmount),
      type: oblType,
      description: oblDesc.trim(),
      dueDate: oblDueDate || undefined,
      status: 'active',
      transactionId: null
    });

    setOblAmount('');
    setOblCpId('');
    setOblType('owed_to_me');
    setOblDesc('');
    setOblDueDate('');
    localStorage.removeItem('qifi_draft_obligation_global');
    setIsDraftSaved(false);
    setShowAddForm(false);
  };

  const handleToggleStatus = (ob: AccountabilityObligation) => {
    updateObligation({
      ...ob,
      status: ob.status === 'active' ? 'resolved' : 'active'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white font-display flex items-center gap-2">
            <ShieldAlert className="text-emerald-400" size={24} />
            Accountability & Obligations
          </h2>
          <p className="text-xs text-zinc-400">
            Track IOUs, reimbursable business expenses, and personal debts to keep your cash reality clean.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
        >
          <PlusCircle size={15} /> Record Accountability IOU
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Receivables */}
        <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/80 shadow-xl backdrop-blur-sm">
          <span className="text-[10px] uppercase font-bold text-zinc-500 font-mono tracking-wider">Net Position</span>
          <div className={`text-2xl font-extrabold tracking-tight font-mono mt-1 ${summaries.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {summaries.net >= 0 ? '+' : '-'}${Math.abs(summaries.net).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-zinc-500 block mt-1">Pending relationship adjustments</span>
        </div>

        {/* Owed To Me */}
        <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/80 shadow-xl backdrop-blur-sm">
          <span className="text-[10px] uppercase font-bold text-zinc-500 font-mono tracking-wider">Owed To You</span>
          <div className="text-2xl font-extrabold tracking-tight font-mono text-emerald-400 mt-1">
            ${summaries.owedToMe.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-zinc-500 block mt-1">Loans & Work Reimbursements</span>
        </div>

        {/* I Owe */}
        <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/80 shadow-xl backdrop-blur-sm">
          <span className="text-[10px] uppercase font-bold text-zinc-500 font-mono tracking-wider">You Owe</span>
          <div className="text-2xl font-extrabold tracking-tight font-mono text-rose-400 mt-1">
            ${summaries.iOwe.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-zinc-500 block mt-1">Outstanding bills or personal IOUs</span>
        </div>

        {/* Disputed */}
        <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/80 shadow-xl backdrop-blur-sm">
          <span className="text-[10px] uppercase font-bold text-zinc-500 font-mono tracking-wider">Disputed Entries</span>
          <div className="text-2xl font-extrabold tracking-tight font-mono text-amber-500 mt-1">
            ${summaries.disputed.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-zinc-500 block mt-1">Unreconciled disputed items</span>
        </div>
      </div>

      {/* Record IOU Form */}
      {showAddForm && (
        <form onSubmit={handleAddObligation} className="bg-zinc-900/60 p-5 rounded-2xl border border-zinc-800/80 shadow-2xl backdrop-blur-md space-y-4 animate-fadeIn">
          <h3 className="font-semibold text-zinc-100 text-sm flex items-center gap-1.5">
            <PlusCircle size={16} className="text-emerald-400" />
            Record Accountability entry
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Counterparty */}
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Select Partner</label>
              <select
                required
                value={oblCpId}
                onChange={e => setOblCpId(e.target.value)}
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700"
              >
                <option value="">-- Choose Partner --</option>
                {counterparties.map(cp => (
                  <option key={cp.id} value={cp.id}>{cp.name} ({cp.isBusiness ? 'Business' : 'Personal'})</option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Obligation Amount ($)</label>
              <input
                required
                type="number"
                step="0.01"
                placeholder="0.00"
                value={oblAmount}
                onChange={e => setOblAmount(e.target.value)}
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Obligation Category</label>
              <select
                value={oblType}
                onChange={e => setOblType(e.target.value as any)}
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-700"
              >
                <option value="owed_to_me">Owed To Me (Loan)</option>
                <option value="i_owe">I Owe Them (Debt)</option>
                <option value="reimbursable">Reimbursable Business Expense</option>
                <option value="pending_reimbursement">Pending Reimbursement</option>
                <option value="disputed">Disputed Item</option>
                <option value="needs_evidence">Missing Receipt / Needs Proof</option>
                <option value="needs_explanation">Needs Explanatory Memo</option>
              </select>
            </div>

            {/* Due date */}
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Due Date (Optional)</label>
              <input
                type="date"
                value={oblDueDate}
                onChange={e => setOblDueDate(e.target.value)}
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700 font-mono"
              />
            </div>

            <div className="sm:col-span-2 md:col-span-4">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Description / Memo</label>
              <input
                required
                type="text"
                placeholder="Details of what this obligation represents"
                value={oblDesc}
                onChange={e => setOblDesc(e.target.value)}
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700"
              />
            </div>
          </div>

          <div className="flex justify-end items-center gap-3 pt-2 border-t border-zinc-800/40">
            {isDraftSaved && (
              <span className="text-zinc-500 text-[11px] flex items-center gap-1.5 animate-fadeIn mr-auto">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                Draft autosaved
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setOblAmount('');
                setOblCpId('');
                setOblType('owed_to_me');
                setOblDesc('');
                setOblDueDate('');
                localStorage.removeItem('qifi_draft_obligation_global');
                setIsDraftSaved(false);
                setShowAddForm(false);
              }}
              className="text-xs text-zinc-400 hover:text-white px-3 py-1.5 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-xs font-semibold shadow-sm cursor-pointer"
            >
              Record Obligation
            </button>
          </div>
        </form>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-3">
        {[
          { id: 'active', label: 'Unresolved Active' },
          { id: 'all', label: 'All Entries' },
          { id: 'owed_to_me', label: 'Owed to Me' },
          { id: 'i_owe', label: 'I Owe' },
          { id: 'reimbursable', label: 'Reimbursables' },
          { id: 'disputed', label: 'Disputes' },
          { id: 'resolved', label: 'Resolved History' }
        ].map(filter => {
          const isSelected = activeFilter === filter.id;
          return (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-all cursor-pointer ${
                isSelected 
                  ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/30 shadow-md' 
                  : 'hover:bg-zinc-800/30 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {/* List */}
      <div className="bg-zinc-900/30 border border-zinc-800/80 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-zinc-300">
            <thead className="text-[10px] text-zinc-500 uppercase bg-zinc-950/20 border-b border-zinc-800/80 font-mono tracking-wider">
              <tr>
                <th scope="col" className="px-5 py-3">Status</th>
                <th scope="col" className="px-5 py-3">Partner / Relation</th>
                <th scope="col" className="px-5 py-3">Explanation</th>
                <th scope="col" className="px-5 py-3 font-mono">Due Date</th>
                <th scope="col" className="px-5 py-3 font-mono text-right">Amount</th>
                <th scope="col" className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredObligations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-zinc-500">
                    No obligations recorded in this filter view.
                  </td>
                </tr>
              ) : (
                filteredObligations.flatMap(ob => {
                  const isOwed = ['owed_to_me', 'reimbursable', 'pending_reimbursement'].includes(ob.type);
                  const isResolved = ob.status === 'resolved';
                  const partnerName = cpMap.get(ob.counterpartyId) || 'Unknown Partner';
                  const oblAtts = attachments.filter(a => a.obligationId === ob.id);
                  const isExpanded = expandedOblId === ob.id;

                  return [
                    <tr 
                      key={ob.id} 
                      onClick={() => setExpandedOblId(isExpanded ? null : ob.id)}
                      className={`hover:bg-zinc-800/20 transition-colors cursor-pointer select-none ${
                        isResolved ? 'opacity-50 line-through text-zinc-500' : ''
                      } ${isExpanded ? 'bg-zinc-800/10' : ''}`}
                    >
                      {/* Status */}
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1 text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md border ${
                          isResolved
                            ? 'bg-zinc-800 text-zinc-400 border-zinc-800'
                            : isOwed 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {isResolved ? 'Resolved' : ob.type.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Partner Name */}
                      <td className="px-5 py-4 font-semibold text-zinc-200">
                        {partnerName}
                      </td>

                      {/* Description */}
                      <td className="px-5 py-4 font-sans max-w-sm whitespace-normal text-zinc-300">
                        <div className="flex items-center gap-2">
                          <span>{ob.description}</span>
                          {oblAtts.length > 0 && (
                            <span className="bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 text-[9px] px-1.5 py-0.2 rounded-md font-mono flex items-center gap-0.5 font-bold">
                              📎 {oblAtts.length} File
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Due Date */}
                      <td className="px-5 py-4 font-mono text-zinc-400">
                        {ob.dueDate || 'No deadline'}
                      </td>

                      {/* Amount */}
                      <td className={`px-5 py-4 font-mono font-bold text-right ${
                        isResolved 
                          ? 'text-zinc-500'
                          : isOwed 
                            ? 'text-emerald-400' 
                            : 'text-rose-400'
                      }`}>
                        {isOwed ? '+' : '-'}${ob.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>

                      {/* Action */}
                      <td className="px-5 py-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleToggleStatus(ob)}
                            className={`p-1.5 rounded-lg border text-xs cursor-pointer flex items-center gap-1 ${
                              isResolved
                                ? 'text-zinc-400 border-zinc-800 hover:text-white'
                                : 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10'
                            }`}
                            title={isResolved ? 'Re-open Entry' : 'Resolve Obligation'}
                          >
                            <Check size={12} />
                            <span className="text-[9px] uppercase font-bold">{isResolved ? 'Re-open' : 'Resolve'}</span>
                          </button>
                          <button
                            onClick={() => deleteObligation(ob.id)}
                            className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-zinc-800/40 rounded-lg cursor-pointer transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>,
                    isExpanded && (
                      <tr key={`${ob.id}-expanded`} className="bg-zinc-950/40 border-b border-zinc-800/60 font-sans">
                        <td colSpan={6} className="px-5 py-4 space-y-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block">Supporting Invoice & Receipts Evidence</span>
                              <span className="text-xs text-zinc-400">Keep records attached to verify tax credits or corporate reimbursements.</span>
                            </div>
                            
                            <label className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 hover:border-emerald-500/40 hover:text-emerald-400 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all">
                              📎 Upload Invoice File
                              <input 
                                type="file" 
                                accept="image/*,application/pdf,text/*,.csv,.tsv,.txt,.md,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                                className="hidden" 
                                onChange={e => handleOblFileUpload(ob.id, e)} 
                              />
                            </label>
                          </div>

                          {oblAtts.length === 0 ? (
                            <div className="p-4 border border-dashed border-zinc-850 text-center rounded-xl bg-zinc-950/20">
                              <span className="text-xs italic text-zinc-600 block">No billing statements, PDFs or receipts attached to this accountability obligation.</span>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                              {oblAtts.map(a => (
                                <div key={a.id} className="bg-zinc-900/30 border border-zinc-850 p-2.5 rounded-xl flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <span className="text-zinc-200 font-semibold text-[11px] block truncate" title={a.fileName}>{a.fileName}</span>
                                    <span className="text-[8px] text-zinc-500 font-mono block">Uploaded: {new Date(a.uploadedAt).toLocaleDateString()}</span>
                                  </div>
                                  <div className="flex gap-1">
                                    <button 
                                      onClick={() => setPreviewAttachment(a)}
                                      className="text-emerald-400 hover:text-emerald-300 p-1 cursor-pointer"
                                      title="Inspect File"
                                    >
                                      👁
                                    </button>
                                    <button 
                                      onClick={() => deleteAttachment(a.id)}
                                      className="text-zinc-500 hover:text-rose-400 p-1 cursor-pointer"
                                      title="Delete"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  ];
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <AttachmentPreviewModal attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} titlePrefix="Bill evidence" />
      {/* Legacy preview markup kept inert until the modal cleanup pass. */}
      {false && previewAttachment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl max-w-lg w-full flex flex-col animate-scaleUp">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/40">
              <div className="flex items-center gap-2 text-zinc-300">
                <span className="font-bold text-sm truncate max-w-[280px] font-display">{previewAttachment.fileName}</span>
              </div>
              <button onClick={() => setPreviewAttachment(null)} className="text-zinc-500 hover:text-white bg-zinc-800 p-1.5 rounded-lg cursor-pointer">✕</button>
            </div>

            <div className="p-6 flex items-center justify-center bg-zinc-950 min-h-[300px]">
              {previewAttachment.dataUrl.startsWith('data:image') ? (
                <img src={previewAttachment.dataUrl} alt={previewAttachment.fileName} className="max-h-[360px] w-auto object-contain rounded-xl border border-zinc-800 shadow" />
              ) : (
                <div className="text-center space-y-3">
                  <p className="text-zinc-400 text-xs">Spreadsheet or PDF binary format ({previewAttachment.fileType})</p>
                  <a href={previewAttachment.dataUrl} download={previewAttachment.fileName} className="inline-block bg-zinc-800 text-zinc-200 border border-zinc-700 hover:border-zinc-650 px-4 py-2 rounded-xl text-xs font-bold transition-all">Download File</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
