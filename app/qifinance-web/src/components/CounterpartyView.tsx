/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useQiStore } from '../store';
import { Counterparty, AccountabilityObligation, Attachment, Transaction } from '../types';
import { 
  Users, User, Building2, Search, PlusCircle, ArrowLeft, 
  ArrowUpRight, ArrowDownLeft, Tag, FileText, Calendar, 
  Trash2, Edit, AlertCircle, CheckCircle, Plus, Sparkles,
  Upload, Eye, X, Check
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';

export default function CounterpartyView() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  
  const { 
    counterparties, 
    obligations, 
    transactions, 
    addCounterparty, 
    updateCounterparty, 
    deleteCounterparty,
    addObligation,
    updateObligation,
    deleteObligation,
    attachments,
    addAttachment,
    deleteAttachment
  } = useQiStore();

  // State
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(() => {
    return !!localStorage.getItem('qifi_draft_partner');
  });

  // Editing state for CP List Form
  const [editingCPId, setEditingCPId] = useState<string | null>(null);

  const [newRelationshipType, setNewRelationshipType] = useState<Counterparty['relationshipType']>(() => {
    const draft = localStorage.getItem('qifi_draft_partner');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.newRelationshipType !== undefined) return parsed.newRelationshipType;
      } catch (e) {}
    }
    return 'Other';
  });

  // Inline Editing state for Detail Page
  const [isEditingCP, setIsEditingCP] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editIsBusiness, setEditIsBusiness] = useState(true);
  const [editRelationshipType, setEditRelationshipType] = useState<Counterparty['relationshipType']>('Other');
  const [editTags, setEditTags] = useState('');
  
  // New CP Form State
  const [newName, setNewName] = useState(() => {
    const draft = localStorage.getItem('qifi_draft_partner');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.newName !== undefined) return parsed.newName;
      } catch (e) {}
    }
    return '';
  });

  const [newDesc, setNewDesc] = useState(() => {
    const draft = localStorage.getItem('qifi_draft_partner');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.newDesc !== undefined) return parsed.newDesc;
      } catch (e) {}
    }
    return '';
  });

  const [newIsBusiness, setNewIsBusiness] = useState(() => {
    const draft = localStorage.getItem('qifi_draft_partner');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.newIsBusiness !== undefined) return parsed.newIsBusiness;
      } catch (e) {}
    }
    return true;
  });

  const [newTags, setNewTags] = useState(() => {
    const draft = localStorage.getItem('qifi_draft_partner');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.newTags !== undefined) return parsed.newTags;
      } catch (e) {}
    }
    return '';
  });

  // New Obligation Form State
  const [showOblForm, setShowOblForm] = useState(() => {
    return !!localStorage.getItem('qifi_draft_obligation_cp');
  });

  const [oblAmount, setOblAmount] = useState(() => {
    const draft = localStorage.getItem('qifi_draft_obligation_cp');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.oblAmount !== undefined) return parsed.oblAmount;
      } catch (e) {}
    }
    return '';
  });

  const [oblType, setOblType] = useState<AccountabilityObligation['type']>(() => {
    const draft = localStorage.getItem('qifi_draft_obligation_cp');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.oblType) return parsed.oblType;
      } catch (e) {}
    }
    return 'owed_to_me';
  });

  const [oblDesc, setOblDesc] = useState(() => {
    const draft = localStorage.getItem('qifi_draft_obligation_cp');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.oblDesc !== undefined) return parsed.oblDesc;
      } catch (e) {}
    }
    return '';
  });

  const [oblDueDate, setOblDueDate] = useState(() => {
    const draft = localStorage.getItem('qifi_draft_obligation_cp');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.oblDueDate !== undefined) return parsed.oblDueDate;
      } catch (e) {}
    }
    return '';
  });

  const [isPartnerDraftSaved, setIsPartnerDraftSaved] = useState(false);
  const [isOblDraftSaved, setIsOblDraftSaved] = useState(false);

  // Autosave Partner draft
  React.useEffect(() => {
    const hasValue = !!(
      newName ||
      newDesc ||
      newTags ||
      !newIsBusiness ||
      newRelationshipType !== 'Other'
    );

    if (hasValue) {
      const draft = {
        newName,
        newDesc,
        newIsBusiness,
        newTags,
        newRelationshipType
      };
      localStorage.setItem('qifi_draft_partner', JSON.stringify(draft));
      setIsPartnerDraftSaved(true);
    } else {
      localStorage.removeItem('qifi_draft_partner');
      setIsPartnerDraftSaved(false);
    }
  }, [newName, newDesc, newIsBusiness, newTags, newRelationshipType]);

  // Autosave Obligation draft (Counterparty context)
  React.useEffect(() => {
    const hasValue = !!(
      oblAmount ||
      oblDesc ||
      oblDueDate ||
      oblType !== 'owed_to_me'
    );

    if (hasValue) {
      const draft = {
        oblAmount,
        oblType,
        oblDesc,
        oblDueDate
      };
      localStorage.setItem('qifi_draft_obligation_cp', JSON.stringify(draft));
      setIsOblDraftSaved(true);
    } else {
      localStorage.removeItem('qifi_draft_obligation_cp');
      setIsOblDraftSaved(false);
    }
  }, [oblAmount, oblType, oblDesc, oblDueDate]);

  // Find active detail CP if ID exists
  const activeCP = useMemo(() => {
    if (!id) return null;
    return counterparties.find(cp => cp.id === id) || null;
  }, [id, counterparties]);

  // Calculations for counterparties lists
  const counterpartiesData = useMemo(() => {
    return counterparties.map(cp => {
      // Calculate total money flow
      const cpTxs = transactions.filter(t => t.counterparty.toLowerCase() === cp.name.toLowerCase());
      const moneyIn = cpTxs.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
      const moneyOut = cpTxs.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
      
      // Calculate active obligations
      const cpObs = obligations.filter(ob => ob.counterpartyId === cp.id && ob.status === 'active');
      const netOwed = cpObs.reduce((sum, ob) => {
        if (ob.type === 'owed_to_me' || ob.type === 'reimbursable' || ob.type === 'pending_reimbursement') {
          return sum + ob.amount;
        } else if (ob.type === 'i_owe') {
          return sum - ob.amount;
        }
        return sum;
      }, 0);

      return {
        ...cp,
        moneyIn,
        moneyOut,
        netOwed,
        activeObligationsCount: cpObs.length
      };
    });
  }, [counterparties, transactions, obligations]);

  // Filter lists based on search
  const filteredCPs = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return counterpartiesData.filter(cp => 
      cp.name.toLowerCase().includes(term) || 
      cp.description.toLowerCase().includes(term) ||
      cp.tags.some(t => t.toLowerCase().includes(term))
    );
  }, [counterpartiesData, searchTerm]);

  // Detailed CP Info
  const detailData = useMemo(() => {
    if (!activeCP) return null;
    
    const cpTxs = transactions.filter(t => t.counterparty.toLowerCase() === activeCP.name.toLowerCase());
    const cpObs = obligations.filter(ob => ob.counterpartyId === activeCP.id);
    
    const moneyIn = cpTxs.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0);
    const moneyOut = cpTxs.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    return {
      transactions: cpTxs,
      obligations: cpObs,
      moneyIn,
      moneyOut,
      netFlow: moneyIn - moneyOut
    };
  }, [activeCP, transactions, obligations]);

  // Submit CP
  const handleAddCP = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    if (editingCPId) {
      updateCounterparty({
        id: editingCPId,
        workspaceId: 'default',
        name: newName.trim(),
        description: newDesc.trim(),
        tags: newTags.split(',').map(t => t.trim()).filter(t => t.length > 0),
        isBusiness: newIsBusiness,
        relationshipType: newRelationshipType,
        createdAt: counterparties.find(c => c.id === editingCPId)?.createdAt || new Date().toISOString()
      });
    } else {
      addCounterparty({
        name: newName.trim(),
        description: newDesc.trim(),
        tags: newTags.split(',').map(t => t.trim()).filter(t => t.length > 0),
        isBusiness: newIsBusiness,
        relationshipType: newRelationshipType
      });
    }

    setNewName('');
    setNewDesc('');
    setNewIsBusiness(true);
    setNewRelationshipType('Other');
    setNewTags('');
    setEditingCPId(null);
    localStorage.removeItem('qifi_draft_partner');
    setIsPartnerDraftSaved(false);
    setShowAddForm(false);
  };

  // Submit Obligation
  const handleAddObligation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCP || !oblAmount || isNaN(parseFloat(oblAmount))) return;

    addObligation({
      counterpartyId: activeCP.id,
      amount: parseFloat(oblAmount),
      type: oblType,
      description: oblDesc.trim(),
      dueDate: oblDueDate || undefined,
      status: 'active',
      transactionId: null
    });

    setOblAmount('');
    setOblType('owed_to_me');
    setOblDesc('');
    setOblDueDate('');
    localStorage.removeItem('qifi_draft_obligation_cp');
    setIsOblDraftSaved(false);
    setShowOblForm(false);
  };

  const handleToggleOblStatus = (ob: AccountabilityObligation) => {
    updateObligation({
      ...ob,
      status: ob.status === 'active' ? 'resolved' : 'active'
    });
  };

  // Render Detail View
  if (activeCP && detailData) {
    const isOwedNet = detailData.obligations
      .filter(o => o.status === 'active')
      .reduce((sum, o) => {
        if (o.type === 'owed_to_me' || o.type === 'reimbursable' || o.type === 'pending_reimbursement') return sum + o.amount;
        if (o.type === 'i_owe') return sum - o.amount;
        return sum;
      }, 0);

    const cpAttachments = attachments.filter(a => a.counterpartyId === activeCP.id);

    const handleCpFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
              'Agreement details with partner ' + activeCP.name,
              null,
              null,
              activeCP.id
            );
          }
        };
        reader.readAsDataURL(file);
      }
    };

    return (
      <div className="space-y-6">
        {/* Back navigation */}
        <button
          onClick={() => navigate('/counterparties')}
          className="text-xs text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <ArrowLeft size={14} /> Back to Partners & Counterparties
        </button>

        {/* Profile Card / Inline Editor */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 p-6 rounded-2xl backdrop-blur-sm">
          {isEditingCP ? (
            <form onSubmit={(e) => {
              e.preventDefault();
              updateCounterparty({
                ...activeCP,
                name: editName.trim(),
                description: editDesc.trim(),
                isBusiness: editIsBusiness,
                relationshipType: editRelationshipType,
                tags: editTags.split(',').map(t => t.trim()).filter(Boolean)
              });
              setIsEditingCP(false);
            }} className="space-y-4 animate-fadeIn">
              <div className="flex items-center gap-2 border-b border-zinc-800/60 pb-3">
                <Edit size={16} className="text-emerald-400" />
                <h3 className="font-semibold text-white text-sm">Edit Profile details</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Name</label>
                  <input
                    required
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Relationship Type</label>
                  <select
                    value={editRelationshipType}
                    onChange={e => setEditRelationshipType(e.target.value as any)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-700"
                  >
                    <option value="Friend">Friend</option>
                    <option value="Family">Family</option>
                    <option value="Coworker">Coworker</option>
                    <option value="Collegue">Collegue</option>
                    <option value="Partner">Partner</option>
                    <option value="Client">Client</option>
                    <option value="Acuentance">Acuentance</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Group Type</label>
                  <select
                    value={editIsBusiness ? 'true' : 'false'}
                    onChange={e => setEditIsBusiness(e.target.value === 'true')}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-700"
                  >
                    <option value="true">Business Counterparty</option>
                    <option value="false">Personal Party</option>
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={editTags}
                    onChange={e => setEditTags(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700"
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Description / Memo</label>
                  <textarea
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    rows={2}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingCP(false)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
              <div className="flex gap-4 items-start">
                <div className="p-3.5 rounded-xl bg-zinc-800/80 border border-zinc-700/30 text-emerald-400 shrink-0">
                  {activeCP.isBusiness ? <Building2 size={24} /> : <User size={24} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white tracking-tight">{activeCP.name}</h2>
                    <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${
                      activeCP.isBusiness 
                        ? 'bg-blue-600/10 text-blue-400 border-blue-500/20' 
                        : 'bg-purple-600/10 text-purple-400 border-purple-500/20'
                    }`}>
                      {activeCP.isBusiness ? 'Business' : 'Personal'} ({activeCP.relationshipType || 'Other'})
                    </span>
                    <button
                      onClick={() => {
                        setEditName(activeCP.name);
                        setEditDesc(activeCP.description);
                        setEditIsBusiness(activeCP.isBusiness);
                        setEditRelationshipType(activeCP.relationshipType || 'Other');
                        setEditTags(activeCP.tags.join(', '));
                        setIsEditingCP(true);
                      }}
                      className="text-[10px] bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-0.5 rounded-xl border border-zinc-700/20 cursor-pointer transition-colors font-medium flex items-center gap-1"
                    >
                      <Edit size={10} /> Edit Profile
                    </button>
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 max-w-lg">{activeCP.description || 'No description provided.'}</p>
                  
                  {activeCP.tags.length > 0 && (
                    <div className="flex gap-1.5 mt-2.5 flex-wrap">
                      {activeCP.tags.map(tag => (
                        <span key={tag} className="text-[10px] font-medium font-mono bg-zinc-800/60 border border-zinc-700/20 px-2 py-0.5 rounded text-zinc-400 flex items-center gap-1">
                          <Tag size={10} /> {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Core Balance Metrics */}
              <div className="flex md:flex-col lg:flex-row gap-4 w-full md:w-auto text-right">
                <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-800/50 flex-1 md:flex-initial">
                  <span className="text-[10px] text-zinc-500 block uppercase font-bold tracking-wider">Relationship Flow</span>
                  <span className={`text-base font-bold block ${detailData.netFlow >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {detailData.netFlow >= 0 ? '+' : '-'}${Math.abs(detailData.netFlow).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-zinc-500">Net Ledger History</span>
                </div>

                <div className="bg-zinc-950/40 p-4 rounded-xl border border-zinc-800/50 flex-1 md:flex-initial">
                  <span className="text-[10px] text-zinc-500 block uppercase font-bold tracking-wider">Active Obligations</span>
                  <span className={`text-base font-bold block ${isOwedNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isOwedNet >= 0 ? 'Owes You' : 'You Owe'} ${Math.abs(isOwedNet).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[10px] text-zinc-500">Unresolved Balances</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Obligations & History grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Obligations Tracker */}
          <div className="bg-zinc-900/30 border border-zinc-800/80 p-5 rounded-2xl space-y-4 backdrop-blur-sm lg:col-span-1">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-1.5">
                  <AlertCircle size={15} className="text-emerald-400" />
                  Obligations & IOUs
                </h3>
                <p className="text-[10px] text-zinc-500 mt-0.5">Track informal loans or pending reimbursements</p>
              </div>
              <button
                onClick={() => setShowOblForm(!showOblForm)}
                className="p-1 text-emerald-400 hover:text-emerald-300 hover:bg-zinc-800/50 rounded-lg cursor-pointer"
                title="Add accountability obligation"
              >
                <Plus size={16} />
              </button>
            </div>

            {showAddForm || showAddForm === false /* Just conditional check */ ? (
              showOblForm && (
                <form onSubmit={handleAddObligation} className="bg-zinc-950/50 p-4 rounded-xl border border-zinc-800/80 space-y-3 animate-fadeIn">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 block font-mono">Create Accountability Entry</span>
                  
                  <div>
                    <label className="block text-[9px] uppercase font-bold text-zinc-500 mb-0.5">Amount ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0.00"
                      value={oblAmount}
                      onChange={e => setOblAmount(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800/80 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-zinc-700"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase font-bold text-zinc-500 mb-0.5">Relation Type</label>
                    <select
                      value={oblType}
                      onChange={e => setOblType(e.target.value as any)}
                      className="w-full bg-zinc-900 border border-zinc-800/80 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none"
                    >
                      <option value="owed_to_me">Owed To Me (Loan/Asset)</option>
                      <option value="i_owe">I Owe Them (Debt/Liability)</option>
                      <option value="reimbursable">Reimbursable (Work Expense)</option>
                      <option value="pending_reimbursement">Pending Reimbursement</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase font-bold text-zinc-500 mb-0.5">Explanation</label>
                    <textarea
                      required
                      placeholder="What is this obligation for?"
                      value={oblDesc}
                      onChange={e => setOblDesc(e.target.value)}
                      rows={2}
                      className="w-full bg-zinc-900 border border-zinc-800/80 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-zinc-700 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] uppercase font-bold text-zinc-500 mb-0.5">Due Date (Optional)</label>
                    <input
                      type="date"
                      value={oblDueDate}
                      onChange={e => setOblDueDate(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800/80 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-zinc-700 font-mono"
                    />
                  </div>

                  <div className="flex gap-2 items-center justify-end pt-1">
                    {isOblDraftSaved && (
                      <span className="text-zinc-500 text-[9px] flex items-center gap-1 mr-auto animate-fadeIn">
                        <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                        Autosaved
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setOblAmount('');
                        setOblType('owed_to_me');
                        setOblDesc('');
                        setOblDueDate('');
                        localStorage.removeItem('qifi_draft_obligation_cp');
                        setIsOblDraftSaved(false);
                        setShowOblForm(false);
                      }}
                      className="text-[10px] text-zinc-400 hover:text-white px-2 py-1 rounded cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded cursor-pointer"
                    >
                      Record IOU
                    </button>
                  </div>
                </form>
              )
            ) : null}

            {/* Obligations List */}
            <div className="space-y-2">
              {detailData.obligations.length === 0 ? (
                <div className="p-4 bg-zinc-950/20 border border-zinc-800/30 rounded-xl text-center">
                  <p className="text-[11px] text-zinc-500 font-sans">No recorded obligations with this partner.</p>
                </div>
              ) : (
                detailData.obligations.map(ob => {
                  const isOwed = ob.type === 'owed_to_me' || ob.type === 'reimbursable' || ob.type === 'pending_reimbursement';
                  const isResolved = ob.status === 'resolved';
                  return (
                    <div 
                      key={ob.id} 
                      className={`p-3 rounded-xl border flex justify-between items-start gap-2 transition-all ${
                        isResolved 
                          ? 'bg-zinc-950/10 border-zinc-900/60 opacity-60' 
                          : 'bg-zinc-950/30 border-zinc-800/40 hover:border-zinc-700/30'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md ${
                            isResolved
                              ? 'bg-zinc-800 text-zinc-400'
                              : isOwed 
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {isResolved ? 'Resolved' : ob.type.replace('_', ' ')}
                          </span>
                          {ob.dueDate && (
                            <span className="text-[9px] font-mono text-zinc-500 flex items-center gap-1">
                              <Calendar size={10} /> Due {ob.dueDate}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-200 leading-normal font-sans">{ob.description}</p>
                        <span className="text-[10px] text-zinc-400 block font-mono font-bold">${ob.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      </div>

                      <div className="flex flex-col gap-1 items-end shrink-0">
                        <button
                          onClick={() => handleToggleOblStatus(ob)}
                          className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                            ob.status === 'resolved'
                              ? 'text-zinc-500 hover:text-emerald-400 border-zinc-800 hover:bg-zinc-800/40'
                              : 'text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/20 hover:border-emerald-500/40'
                          }`}
                          title={ob.status === 'resolved' ? 'Mark active' : 'Mark resolved'}
                        >
                          <CheckCircle size={13} />
                        </button>
                        <button
                          onClick={() => deleteObligation(ob.id)}
                          className="p-1.5 text-zinc-600 hover:text-rose-400 rounded-lg border border-transparent hover:border-zinc-800/40 cursor-pointer"
                          title="Delete entry"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Partner Transaction Ledger History */}
          <div className="bg-zinc-900/30 border border-zinc-800/80 p-5 rounded-2xl space-y-4 backdrop-blur-sm lg:col-span-2">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-1.5 font-display">
                <FileText size={15} className="text-emerald-400" />
                Ledger Transaction History ({detailData.transactions.length})
              </h3>
              <p className="text-xs text-zinc-500">Every transactional event involving this counterparty</p>
            </div>

            <div className="space-y-2.5">
              {detailTransactions(transactions, counterparties.find(cp => cp.id === id)?.name || '').length === 0 ? (
                <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl text-zinc-500 text-xs">
                  No confirmed transactions recorded for this counterparty yet.
                </div>
              ) : (
                detailTransactions(transactions, counterparties.find(cp => cp.id === id)?.name || '').map(tx => {
                  const isOutflow = tx.amount < 0;
                  return (
                    <div 
                      key={tx.id} 
                      className="p-4 rounded-xl bg-zinc-900/20 border border-zinc-800/60 flex items-center justify-between hover:border-zinc-700/50 transition-all gap-4"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-zinc-100">{tx.description}</span>
                          <span className="text-[10px] font-mono text-zinc-500">{tx.date}</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[9px] font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-700/10 uppercase">
                            {tx.sourceAccountId.replace('assets-', '').replace('liabilities-', '')}
                          </span>
                          {tx.tags.map(tag => (
                            <span key={tag} className="text-[9px] bg-zinc-800/30 text-zinc-400 px-1.5 py-0.5 rounded-md border border-zinc-800/40">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`text-xs font-bold font-mono block ${isOutflow ? 'text-zinc-300' : 'text-emerald-400'}`}>
                          {isOutflow ? '-' : '+'}${Math.abs(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-[9px] text-zinc-500 block">Confirmed entry</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* CONTRACT & DOCUMENT EVIDENCE */}
        <div className="bg-zinc-900/30 border border-zinc-800/80 p-5 rounded-2xl space-y-4 backdrop-blur-sm">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-1.5 font-display">
                <FileText size={15} className="text-emerald-400" />
                Contract & Compliance Documents ({cpAttachments.length})
              </h3>
              <p className="text-xs text-zinc-500">Verify signatures, tax certificates, and mutual business agreements</p>
            </div>
            
            <label className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 hover:border-emerald-500/40 text-zinc-400 hover:text-emerald-400 px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all">
              <Upload size={12} /> Upload Agreement File
              <input 
                type="file" 
                ref={fileInputRef}
                accept="image/*,application/pdf" 
                className="hidden" 
                onChange={handleCpFileUpload} 
              />
            </label>
          </div>

          {cpAttachments.length === 0 ? (
            <div className="p-8 border border-dashed border-zinc-800/80 bg-zinc-950/20 text-center rounded-xl">
              <span className="text-zinc-500 text-xs italic block">No corporate agreements, agreements, or W-9 compliance files attached yet.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {cpAttachments.map(a => (
                <div key={a.id} className="bg-zinc-950/40 border border-zinc-850 p-3.5 rounded-xl flex flex-col justify-between space-y-2">
                  <div className="space-y-1">
                    <span className="text-zinc-300 font-semibold text-xs block truncate" title={a.fileName}>{a.fileName}</span>
                    <span className="text-[9px] text-zinc-500 block">Uploaded: {new Date(a.uploadedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setPreviewAttachment(a)}
                      className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-emerald-400 text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1 flex-1 font-semibold cursor-pointer transition-all"
                    >
                      <Eye size={12} /> View File
                    </button>
                    <button 
                      onClick={() => deleteAttachment(a.id)}
                      className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-rose-455 text-xs p-1.5 rounded-lg cursor-pointer transition-all"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* LIGHTBOX PREVIEW OVERLAY */}
        {previewAttachment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md animate-fadeIn">
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl max-w-lg w-full flex flex-col animate-scaleUp">
              <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/40">
                <div className="flex items-center gap-2">
                  <FileText className="text-emerald-400" size={18} />
                  <h3 className="font-bold text-white text-sm truncate max-w-[280px] font-display">{previewAttachment.fileName}</h3>
                </div>
                <button onClick={() => setPreviewAttachment(null)} className="text-zinc-500 hover:text-white bg-zinc-800 p-1.5 rounded-lg cursor-pointer"><X size={16} /></button>
              </div>

              <div className="p-6 flex items-center justify-center bg-zinc-950 min-h-[300px]">
                {previewAttachment.dataUrl.startsWith('data:image') ? (
                  <img src={previewAttachment.dataUrl} alt={previewAttachment.fileName} className="max-h-[360px] w-auto object-contain rounded-xl border border-zinc-800 shadow" />
                ) : (
                  <div className="text-center space-y-3">
                    <FileText className="mx-auto text-zinc-600 animate-pulse" size={60} />
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

  // Render Counterparties List (Main View)
  return (
    <div className="space-y-6">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white font-display flex items-center gap-2">
            <Users className="text-emerald-400" size={24} />
            Counter parties & Parties
          </h2>
          <p className="text-xs text-zinc-400">
            Understand relationships, track who owes whom, and trace mutual ledger histories.
          </p>
        </div>

        <button
          onClick={() => {
            setEditingCPId(null);
            setNewName('');
            setNewDesc('');
            setNewIsBusiness(true);
            setNewRelationshipType('Other');
            setNewTags('');
            setShowAddForm(!showAddForm);
          }}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
        >
          <PlusCircle size={15} /> {showAddForm ? 'Close Editor' : 'Create Counterparty'}
        </button>
      </div>

      {/* Add / Edit Partner Form */}
      {showAddForm && (
        <form onSubmit={handleAddCP} className="bg-zinc-900/60 p-5 rounded-2xl border border-zinc-800/80 shadow-2xl backdrop-blur-md space-y-4 animate-fadeIn">
          <h3 className="font-semibold text-zinc-100 text-sm flex items-center gap-1.5">
            <Sparkles size={16} className="text-emerald-400" />
            {editingCPId ? 'Edit Counterparty Details' : 'Set Up Counterparty Profile'}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Name</label>
              <input
                required
                type="text"
                placeholder="e.g. Mom, Acme Corp, Lyft"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Group Type</label>
              <select
                value={newIsBusiness ? 'true' : 'false'}
                onChange={e => setNewIsBusiness(e.target.value === 'true')}
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-700"
              >
                <option value="true">Business Counterparty</option>
                <option value="false">Personal Party</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Relationship Type</label>
              <select
                value={newRelationshipType}
                onChange={e => setNewRelationshipType(e.target.value as any)}
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-700"
              >
                <option value="Friend">Friend</option>
                <option value="Family">Family</option>
                <option value="Coworker">Coworker</option>
                <option value="Collegue">Collegue</option>
                <option value="Partner">Partner</option>
                <option value="Client">Client</option>
                <option value="Acuentance">Acuentance</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Tags (comma-separated)</label>
              <input
                type="text"
                placeholder="e.g. business, client, family"
                value={newTags}
                onChange={e => setNewTags(e.target.value)}
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700"
              />
            </div>

            <div className="sm:col-span-2 md:col-span-4">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Description / Memo</label>
              <input
                type="text"
                placeholder="Describe relationship or purpose"
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                className="w-full bg-zinc-950/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700"
              />
            </div>
          </div>

          <div className="flex justify-end items-center gap-3 pt-2 border-t border-zinc-800/40">
            {isPartnerDraftSaved && (
              <span className="text-zinc-500 text-[11px] flex items-center gap-1.5 animate-fadeIn mr-auto">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                Draft autosaved
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setNewName('');
                setNewDesc('');
                setNewIsBusiness(true);
                setNewRelationshipType('Other');
                setNewTags('');
                setEditingCPId(null);
                localStorage.removeItem('qifi_draft_partner');
                setIsPartnerDraftSaved(false);
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
              {editingCPId ? 'Save Changes' : 'Initialize Profile'}
            </button>
          </div>
        </form>
      )}

      {/* Search Filter bar */}
      <div className="relative">
        <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-zinc-500">
          <Search size={14} />
        </span>
        <input
          type="text"
          placeholder="Search profiles, tags, descriptions..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="w-full bg-zinc-900/30 border border-zinc-800/80 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-700 backdrop-blur-sm"
        />
      </div>

      {/* Profiles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCPs.length === 0 ? (
          <div className="col-span-full py-16 border border-dashed border-zinc-800/80 rounded-2xl text-center bg-zinc-900/10 backdrop-blur-sm">
            <Users size={32} className="mx-auto text-zinc-600 mb-2.5" />
            <p className="text-xs text-zinc-500">No partner profiles match your criteria.</p>
          </div>
        ) : (
          filteredCPs.map(cp => {
            const hasOwed = cp.netOwed !== 0;
            return (
              <div
                key={cp.id}
                onClick={() => navigate(`/counterparties/${cp.id}`)}
                className="bg-zinc-900/30 border border-zinc-800/80 hover:border-zinc-700/60 p-5 rounded-2xl flex flex-col justify-between transition-all backdrop-blur-sm group cursor-pointer"
              >
                <div className="space-y-3">
                  {/* Header info */}
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex gap-2.5 items-center">
                      <div className={`p-2 rounded-lg border text-xs ${
                        cp.isBusiness 
                          ? 'bg-blue-600/5 border-blue-500/10 text-blue-400' 
                          : 'bg-purple-600/5 border-purple-500/10 text-purple-400'
                      }`}>
                        {cp.isBusiness ? <Building2 size={14} /> : <User size={14} />}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-zinc-100 group-hover:text-white transition-colors">
                          {cp.name}
                        </h4>
                        <span className="text-[10px] text-zinc-500">
                          {cp.isBusiness ? 'Business' : 'Personal'} ({cp.relationshipType || 'Other'})
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCPId(cp.id);
                          setNewName(cp.name);
                          setNewDesc(cp.description);
                          setNewIsBusiness(cp.isBusiness);
                          setNewRelationshipType(cp.relationshipType || 'Other');
                          setNewTags(cp.tags.join(', '));
                          setShowAddForm(true);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="p-1 text-zinc-600 hover:text-emerald-400 hover:bg-zinc-800/40 rounded-lg cursor-pointer transition-colors"
                        title="Edit Profile"
                      >
                        <Edit size={13} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCounterparty(cp.id);
                        }}
                        className="p-1 text-zinc-600 hover:text-rose-400 hover:bg-zinc-800/40 rounded-lg cursor-pointer transition-colors"
                        title="Remove Profile"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Profile Memo */}
                  <p className="text-[11px] text-zinc-400 line-clamp-2 h-8 font-sans leading-relaxed">
                    {cp.description || 'No relationship details.'}
                  </p>

                  {/* Tags */}
                  {cp.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {cp.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-[9px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-800 px-1.5 py-0.5 rounded">
                          {tag}
                        </span>
                      ))}
                      {cp.tags.length > 3 && (
                        <span className="text-[9px] font-mono text-zinc-600 px-1 py-0.5">
                          +{cp.tags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Bottom summaries & Navigation link */}
                <div className="mt-4 pt-4 border-t border-zinc-800/40 flex justify-between items-center text-xs">
                  <div>
                    {hasOwed ? (
                      <span className={`text-[10px] font-bold block ${cp.netOwed >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {cp.netOwed >= 0 ? 'Owes You' : 'You Owe'} ${Math.abs(cp.netOwed).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-500 block">Balanced obligations</span>
                    )}
                    <span className="text-[9px] text-zinc-500 font-mono">
                      Inbound: ${cp.moneyIn.toLocaleString('en-US', { maximumFractionDigits: 0 })} | Outbound: ${cp.moneyOut.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                  </div>

                  <button
                    onClick={() => navigate(`/counterparties/${cp.id}`)}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold tracking-tight cursor-pointer"
                  >
                    View History →
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------------------
// Helper functions (defined as plain javascript outside Component block)
// -------------------------------------------------------------------------
function detailTransactionsCount(txs: Transaction[], filterType: string): number {
  return detailTransactions(txs, '').length;
}

function detailTransactions(txs: Transaction[], cpName: string): Transaction[] {
  if (!cpName) return [];
  return txs.filter(t => t.counterparty.toLowerCase() === cpName.toLowerCase());
}
