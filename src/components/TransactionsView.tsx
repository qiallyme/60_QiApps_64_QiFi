import React, { useState } from 'react';
import { db } from '../db';
import { 
  SimpleTransactionInput, 
  Account, 
  Category, 
  Person,
  JournalEntry
} from '../types';
import { 
  Plus, 
  Search, 
  SlidersHorizontal, 
  Paperclip, 
  AlertTriangle, 
  HelpCircle,
  FileCheck,
  Check,
  PlusCircle,
  Trash
} from 'lucide-react';

interface TransactionsViewProps {
  triggerRefresh: () => void;
  onNavigate: (tab: string) => void;
}

export function TransactionsView({ triggerRefresh, onNavigate }: TransactionsViewProps) {
  const accounts = db.getAccounts();
  const categories = db.getCategories();
  const people = db.getPeople();
  const allEntries = db.getJournalEntries();
  const bills = db.getBills().filter(b => b.status === 'upcoming');
  const debts = db.getDebts().filter(d => d.status === 'active');

  // Simple Form States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [fromAccountId, setFromAccountId] = useState(accounts[0]?.id || '');
  const [toAccountId, setToAccountId] = useState(accounts[3]?.id || ''); // e.g. expense normal
  const [amount, setAmount] = useState('');
  const [merchantOrPersonId, setMerchantOrPersonId] = useState('');
  const [categoryId, setCategoryId] = useState(categories[1]?.id || '');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<SimpleTransactionInput['status']>('posted');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [isDisputed, setIsDisputed] = useState(false);
  const [isReimbursable, setIsReimbursable] = useState(false);
  const [notes, setNotes] = useState('');
  const [relatedBillId, setRelatedBillId] = useState('');
  const [relatedDebtId, setRelatedDebtId] = useState('');

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAccount, setFilterAccount] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPerson, setFilterPerson] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDisputed, setFilterDisputed] = useState(false);
  const [filterReimbursable, setFilterReimbursable] = useState(false);
  const [filterMissingEvidence, setFilterMissingEvidence] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Date Range
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleOpenCreateForm = () => {
    setEditingId(null);
    setDate(new Date().toISOString().substring(0, 10));
    setFromAccountId(accounts.find(a => ['checking', 'savings', 'cash'].includes(a.account_type))?.id || accounts[0]?.id || '');
    setToAccountId(accounts.find(a => a.account_type === 'expense')?.id || accounts[1]?.id || '');
    setAmount('');
    setMerchantOrPersonId('');
    setCategoryId(categories[1]?.id || '');
    setDescription('');
    setStatus('posted');
    setReceiptUrl('');
    setIsDisputed(false);
    setIsReimbursable(false);
    setNotes('');
    setRelatedBillId('');
    setRelatedDebtId('');
    setIsFormOpen(true);
  };

  const handleEdit = (entry: JournalEntry) => {
    // If posted, warn that direct amount changes aren't permitted
    if (entry.status === 'posted') {
      alert('Security Audit: This is a POSTED balanced transaction. Direct modification of financial lines is blocked to preserve auditing. However, you can review details, reverse, or update notes.');
    }

    const lines = db.getJournalLines().filter(l => l.journal_entry_id === entry.id);
    const debitLine = lines.find(l => l.debit_amount > 0);
    const creditLine = lines.find(l => l.credit_amount > 0);

    setEditingId(entry.id);
    setDate(entry.entry_date);
    setFromAccountId(creditLine?.account_id || '');
    setToAccountId(debitLine?.account_id || '');
    setAmount((debitLine?.debit_amount || creditLine?.credit_amount || 0).toString());
    setMerchantOrPersonId(entry.related_person_id || '');
    setCategoryId(debitLine?.category_id || creditLine?.category_id || '');
    setDescription(entry.description);
    setStatus(entry.status === 'draft' ? 'draft' : 'posted');
    setReceiptUrl(entry.evidence_url || '');
    setIsDisputed(!!entry.is_disputed);
    setIsReimbursable(!!entry.is_reimbursable);
    setNotes(entry.memo);
    setRelatedBillId(entry.related_bill_id || '');
    setRelatedDebtId(entry.related_debt_id || '');
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      return alert('Standard accounting requires a positive numeric transaction amount.');
    }
    if (!fromAccountId || !toAccountId) {
      return alert('Please select both the Origin (Credit) and Destination (Debit) accounts.');
    }
    if (fromAccountId === toAccountId) {
      return alert('Transfer exception: Origin and Destination accounts cannot be identical.');
    }

    const res = db.saveSimpleTransaction({
      id: editingId || undefined,
      date,
      fromAccountId,
      toAccountId,
      amount: Number(amount),
      merchantOrPersonId,
      categoryId,
      description,
      status: status as any,
      receiptUrl,
      isDisputed,
      isReimbursable,
      notes,
      relatedBillId,
      relatedDebtId
    });

    if (res.success) {
      setIsFormOpen(false);
      triggerRefresh();
    } else {
      alert(`Ledger Validation Fail: ${res.error}`);
    }
  };

  const handleReverse = (id: string) => {
    if (confirm('Audit Action Required: Are you sure you wish to void & post an automatic reversal entry for this transaction? This creates equal reversing double-entry lines.')) {
      const res = db.reverseJournalEntry(id);
      if (res.success) {
        alert('Audit reversal posted successfully. original entry voided!');
        triggerRefresh();
      } else {
        alert(`Failed to execute reversal: ${res.error}`);
      }
    }
  };

  const handleDeleteDraft = (id: string) => {
    if (confirm('Are you sure you want to permanently discard this draft transaction?')) {
      const res = db.deleteDraftEntry(id);
      if (res.success) {
        triggerRefresh();
      } else {
        alert(`Error: ${res.error}`);
      }
    }
  };

  // Filter logic
  const filteredEntries = allEntries.filter(entry => {
    // Description search
    const matchesSearch = entry.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
      entry.memo.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Account filtering
    const lines = db.getJournalLines().filter(l => l.journal_entry_id === entry.id);
    const matchesAccount = !filterAccount || lines.some(l => l.account_id === filterAccount);

    // Category filtering
    const matchesCategory = !filterCategory || lines.some(l => l.category_id === filterCategory);

    // Person filtering
    const matchesPerson = !filterPerson || entry.related_person_id === filterPerson;

    // Status filtering
    const matchesStatus = !filterStatus || entry.status === filterStatus || 
      (filterStatus === 'unreviewed' && entry.needs_review);

    // Boolean flags
    const matchesDisputed = !filterDisputed || entry.is_disputed;
    const matchesReimbursable = !filterReimbursable || entry.is_reimbursable;
    const matchesMissingEvidence = !filterMissingEvidence || !entry.evidence_url;

    // Date range
    const entryTime = new Date(entry.entry_date).getTime();
    const matchesStartDate = !startDate || entryTime >= new Date(startDate).getTime();
    const matchesEndDate = !endDate || entryTime <= new Date(endDate).getTime();

    return matchesSearch && matchesAccount && matchesCategory && matchesPerson && 
      matchesStatus && matchesDisputed && matchesReimbursable && matchesMissingEvidence &&
      matchesStartDate && matchesEndDate;
  }).sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime());

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  return (
    <div className="space-y-6" id="txs_view_block">
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-2 border-b border-gray-100">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 font-sans" id="txs_main_title">
            Bookkeeping & Simple Transactions
          </h2>
          <p className="text-xs text-slate-500 font-mono">
            EASY RECORD INPUT DISPATCHED DIRECTLY TO RECONCILED GENERAL LEDGER
          </p>
        </div>
        <button 
          onClick={handleOpenCreateForm}
          className="mt-3 sm:mt-0 flex items-center gap-1.5 px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm font-sans focus:outline-none cursor-pointer"
          id="btn_open_tx_form"
        >
          <Plus className="w-4 h-4" />
          Record New Entry
        </button>
      </div>

      {/* Advanced Filter Bars */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs" id="txs_filter_bar">
        {/* Main Search Row */}
        <div className="p-3 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100">
          <div className="flex items-center gap-2 flex-1 min-w-[240px] bg-slate-50/50 p-2 rounded-lg border border-slate-200">
            <Search className="w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Search descriptions, merchants, memos..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="text-xs text-slate-800 bg-transparent focus:outline-none flex-1 border-none"
              id="tx_search_input"
            />
          </div>

          <div className="flex gap-2">
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 px-3 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${showFilters ? 'bg-slate-900 border-slate-900 text-white' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}
              id="btn_toggle_filters"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {showFilters ? 'Hide Advanced Filters' : 'Advanced Filters'}
            </button>
          </div>
        </div>

        {/* Dropdown Filters */}
        {showFilters && (
          <div className="p-4 bg-slate-50/60 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 border-b border-gray-100 animate-slide-down" id="filters_dropdown_block">
            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase font-mono mb-1">Filter by Account</label>
              <select 
                value={filterAccount}
                onChange={e => setFilterAccount(e.target.value)}
                className="w-full p-2 text-xs border border-slate-200 rounded focus:outline-none bg-white text-slate-700"
                id="filter_acct_select"
              >
                <option value="">-- All Accounts --</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase font-mono mb-1">Filter by Category</label>
              <select 
                value={filterCategory}
                onChange={e => setFilterCategory(e.target.value)}
                className="w-full p-2 text-xs border border-slate-200 rounded focus:outline-none bg-white text-slate-700 font-mono capitalize"
                id="filter_cat_select"
              >
                <option value="">-- All Categories --</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase font-mono mb-1">Filter by Party</label>
              <select 
                value={filterPerson}
                onChange={e => setFilterPerson(e.target.value)}
                className="w-full p-2 text-xs border border-slate-200 rounded focus:outline-none bg-white text-slate-700"
                id="filter_person_select"
              >
                <option value="">-- All Parties --</option>
                {people.map(p => (
                  <option key={p.id} value={p.id}>{p.display_name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[9px] font-bold text-slate-400 uppercase font-mono mb-1">Status Workflow</label>
              <select 
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="w-full p-2 text-xs border border-slate-200 rounded focus:outline-none bg-white text-slate-700 font-mono text-[10px]"
                id="filter_status_select"
              >
                <option value="">-- All Statuses --</option>
                <option value="posted">Posted</option>
                <option value="draft">Drafts</option>
                <option value="unreviewed">Awaiting Review</option>
                <option value="voided">Voided</option>
              </select>
            </div>

            <div className="flex flex-col justify-end space-y-1">
              <label className="flex items-center gap-1.5 text-[10px] text-slate-700 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={filterDisputed}
                  onChange={e => setFilterDisputed(e.target.checked)}
                  id="chk_disputed"
                />
                Disputed Charges
              </label>
              <label className="flex items-center gap-1.5 text-[10px] text-slate-700 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={filterReimbursable}
                  onChange={e => setFilterReimbursable(e.target.checked)}
                  id="chk_reimbursable"
                />
                Reimbursable Claims
              </label>
              <label className="flex items-center gap-1.5 text-[10px] text-slate-700 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={filterMissingEvidence}
                  onChange={e => setFilterMissingEvidence(e.target.checked)}
                  id="chk_missing_evidence"
                />
                Missing Receipts
              </label>
            </div>

            <div className="col-span-full border-t border-slate-150 pt-3 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-mono uppercase">From</span>
                <input 
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="p-1 px-2 border border-slate-200 text-xs text-slate-700 bg-white rounded"
                  id="filter_start_date"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-mono uppercase">To</span>
                <input 
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="p-1 px-2 border border-slate-200 text-xs text-slate-700 bg-white rounded"
                  id="filter_end_date"
                />
              </div>
              <button 
                onClick={() => {
                  setFilterAccount('');
                  setFilterCategory('');
                  setFilterPerson('');
                  setFilterStatus('');
                  setFilterDisputed(false);
                  setFilterReimbursable(false);
                  setFilterMissingEvidence(false);
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-[10px] font-mono text-slate-500 hover:text-slate-900 underline ml-auto"
                id="btn_reset_filters"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Transaction List Cards */}
      <div className="space-y-3" id="txs_master_list">
        {filteredEntries.length === 0 ? (
          <div className="p-16 text-center bg-white border border-gray-150 rounded-xl text-slate-400 text-xs font-sans">
            No entries found matching filters. Select Add Entry to record new ledger transactions.
          </div>
        ) : (
          filteredEntries.map(entry => {
            const entryLines = db.getJournalLines().filter(l => l.journal_entry_id === entry.id);
            const debitLine = entryLines.find(l => l.debit_amount > 0);
            const creditLine = entryLines.find(l => l.credit_amount > 0);
            
            const fromAcct = accounts.find(a => a.id === creditLine?.account_id);
            const toAcct = accounts.find(a => a.id === debitLine?.account_id);
            const personObj = people.find(p => p.id === entry.related_person_id);
            const catObj = categories.find(c => c.id === (debitLine?.category_id || creditLine?.category_id));

            const totalSum = debitLine?.debit_amount || creditLine?.credit_amount || 0;
            const isPosted = entry.status === 'posted';
            const isVoided = entry.status === 'voided';
            const isDraft = entry.status === 'draft';

            return (
              <div 
                key={entry.id} 
                className={`p-4 bg-white rounded-xl border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition-colors hover:bg-slate-55/40 ${isVoided ? 'opacity-50 border-gray-150 bg-gray-50/50' : 'border-slate-200'}`}
                id={`tx_row_${entry.id}`}
              >
                {/* Visual date & detail */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="p-2.5 bg-slate-50 border border-slate-100 text-center rounded-lg min-w-[54px] flex-shrink-0">
                    <span className="block text-[10px] text-slate-450 font-mono uppercase tracking-wider">
                      {new Date(entry.entry_date + "T00:00:00").toLocaleDateString('en-US', { month: 'short' })}
                    </span>
                    <span className="block text-sm font-extrabold text-slate-800 font-mono leading-none mt-1">
                      {new Date(entry.entry_date + "T00:00:00").toLocaleDateString('en-US', { day: '2-digit' })}
                    </span>
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 truncate max-w-[280px]">
                        {entry.description}
                      </span>
                      {entry.is_disputed && (
                        <span className="p-0.5 px-1.5 uppercase font-mono tracking-wider text-[8px] font-bold text-red-700 bg-red-100 rounded">Disputed</span>
                      )}
                      {entry.is_reimbursable && (
                        <span className="p-0.5 px-1.5 uppercase font-mono tracking-wider text-[8px] font-bold text-sky-700 bg-sky-100 rounded">Reimbursable</span>
                      )}
                      {entry.needs_review && (
                        <span className="p-0.5 px-1.5 uppercase font-mono tracking-wider text-[8px] font-bold text-amber-700 bg-amber-100 rounded">Unreviewed</span>
                      )}
                      {isDraft && (
                        <span className="p-0.5 px-1.5 uppercase font-mono tracking-wider text-[8px] font-bold text-slate-700 bg-slate-200 rounded">Draft</span>
                      )}
                      {isVoided && (
                        <span className="p-0.5 px-1.5 uppercase font-mono tracking-wider text-[8px] font-bold text-slate-400 bg-slate-100 rounded">Voided</span>
                      )}
                    </div>
                    
                    <p className="text-[10px] text-slate-500 font-mono flex flex-wrap gap-x-2 gap-y-0.5">
                      <span><strong>From:</strong> {fromAcct?.name || 'Equity Account'}</span>
                      <span className="text-slate-300">|</span>
                      <span><strong>To:</strong> {toAcct?.name || 'Expense Account'}</span>
                    </p>

                    <div className="flex items-center gap-2 mt-1">
                      {catObj && (
                        <span className="text-[9px] font-mono leading-none px-2 py-0.5 rounded bg-slate-100 text-slate-650 capitalize">
                          {catObj.name}
                        </span>
                      )}
                      {personObj && (
                        <span className="text-[9px] font-mono leading-none text-slate-400">
                          Party: {personObj.display_name}
                        </span>
                      )}
                    </div>

                    {entry.memo && (
                      <p className="text-[10px] text-slate-450 italic font-sans max-w-lg mt-1 line-clamp-1">
                        &ldquo;{entry.memo}&rdquo;
                      </p>
                    )}
                  </div>
                </div>

                {/* Amount display & actionable items */}
                <div className="flex md:flex-col items-end justify-between md:justify-center w-full md:w-auto border-t md:border-none pt-2 md:pt-0 gap-3 border-gray-100">
                  <div className="text-right">
                    <span className="text-[9px] text-slate-500 font-mono block uppercase">Ledger Amount</span>
                    <span className="text-sm font-mono font-black text-slate-950">
                      {formatCurrency(totalSum)}
                    </span>
                  </div>

                  <div className="flex gap-2 text-[10px] font-extrabold uppercase font-mono tracking-wider">
                    {entry.evidence_url && (
                      <a 
                        href={entry.evidence_url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-1 px-2 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded flex items-center gap-0.5 cursor-pointer"
                        title="Attached statement"
                      >
                        <Paperclip className="w-3 h-3 text-slate-500" />
                        Receipt
                      </a>
                    )}
                    
                    {isPosted && (
                      <button 
                        onClick={() => handleReverse(entry.id)}
                        className="p-1 px-2.5 bg-rose-50 border border-rose-100 text-rose-700 hover:bg-rose-950 hover:text-white transition-all rounded cursor-pointer"
                        id={`btn_reverse_tx_${entry.id}`}
                      >
                        Void / Reverse
                      </button>
                    )}

                    {isDraft && (
                      <button 
                        onClick={() => handleDeleteDraft(entry.id)}
                        className="p-1 px-2 bg-slate-100 hover:bg-slate-900 border border-slate-200 hover:text-white rounded flex items-center gap-0.5 text-slate-800 cursor-pointer"
                        id={`btn_discard_tx_${entry.id}`}
                      >
                        <Trash className="w-3 h-3" />
                        Discard
                      </button>
                    )}

                    <button 
                      onClick={() => handleEdit(entry)}
                      className="p-1 px-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded cursor-pointer"
                      id={`btn_inspect_tx_${entry.id}`}
                    >
                      {isPosted ? 'Review' : 'Modify'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Transaction Setup Drawer Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="tx_modal_overlay">
          <div className="bg-white rounded-xl shadow-lg border border-slate-300 w-full max-w-xl overflow-hidden animate-fade-in" id="tx_modal_content">
            <div className="p-4 bg-slate-950 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold tracking-tight uppercase font-mono">
                  {editingId ? 'Inspect Bookkeeping transaction' : 'Record Bookkeeping transaction'}
                </h3>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-white font-mono text-xs cursor-pointer"
                id="btn_tx_modal_close_upper"
              >
                Close (✖)
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto" id="tx_modal_form">
              <div className="grid grid-cols-2 gap-4">
                
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Transaction date</label>
                  <input 
                    type="date"
                    required
                    value={date}
                    disabled={editingId !== null && status === 'posted'}
                    onChange={e => setDate(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                    id="tx_input_date"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Amount ($ USD)</label>
                  <input 
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    disabled={editingId !== null && status === 'posted'}
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="25.00"
                    className="w-full p-2 text-xs border border-slate-200 rounded font-mono font-bold focus:outline-none focus:ring-1 focus:ring-slate-900"
                    id="tx_input_amount"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Merchant / Transaction Title</label>
                  <input 
                    type="text"
                    required
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="e.g., Weekly pantry grocery haul Whole Foods"
                    className="w-full p-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                    id="tx_input_desc"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Origin Account - Credit (-)</label>
                  <select 
                    value={fromAccountId}
                    disabled={editingId !== null && status === 'posted'}
                    onChange={e => setFromAccountId(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                    id="tx_input_from_acct"
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name} [Type: {a.account_type}]</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Destination Target - Debit (+)</label>
                  <select 
                    value={toAccountId}
                    disabled={editingId !== null && status === 'posted'}
                    onChange={e => setToAccountId(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                    id="tx_input_to_acct"
                  >
                    {accounts.map(a => (
                      <option key={a.id} value={a.id}>{a.name} [Type: {a.account_type}]</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Transaction Category</label>
                  <select 
                    value={categoryId}
                    onChange={e => setCategoryId(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white capitalize font-mono text-[11px]"
                    id="tx_input_cat"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.category_type})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-405 uppercase font-mono mb-1">Related Party / Person</label>
                  <select 
                    value={merchantOrPersonId}
                    onChange={e => setMerchantOrPersonId(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                    id="tx_input_person"
                  >
                    <option value="">-- No linked party --</option>
                    {people.map(p => (
                      <option key={p.id} value={p.id}>{p.display_name} ({p.type})</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2 grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-150">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-2">Connect Bill Liability</label>
                    <select 
                      value={relatedBillId}
                      onChange={e => setRelatedBillId(e.target.value)}
                      className="w-full p-1.5 text-[11px] border border-slate-200 rounded bg-white"
                      id="tx_input_bill"
                    >
                      <option value="">-- No connected bill --</option>
                      {bills.map(b => (
                        <option key={b.id} value={b.id}>{b.title} (${b.amount})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-2">Connect Debt / IOU Ledger</label>
                    <select 
                      value={relatedDebtId}
                      onChange={e => setRelatedDebtId(e.target.value)}
                      className="w-full p-1.5 text-[11px] border border-slate-200 rounded bg-white"
                      id="tx_input_debt"
                    >
                      <option value="">-- No connected debt --</option>
                      {debts.map(d => (
                        <option key={d.id} value={d.id}>{d.title} (${d.current_balance})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Receipt / Evidence Attachment URL</label>
                  <input 
                    type="url"
                    value={receiptUrl}
                    onChange={e => setReceiptUrl(e.target.value)}
                    placeholder="https://mysubspace-storage-receipt.png"
                    className="w-full p-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                    id="tx_input_evidence"
                  />
                </div>

                <div className="col-span-2 flex flex-wrap gap-4 pt-1">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={isDisputed}
                      onChange={e => setIsDisputed(e.target.checked)}
                      id="tx_input_disputed"
                    />
                    Mark as disputed charge
                  </label>

                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={isReimbursable}
                      onChange={e => setIsReimbursable(e.target.checked)}
                      id="tx_input_reimbursable"
                    />
                    Mark as reimbursable / claim item
                  </label>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Review Workflow Status</label>
                  <select 
                    value={status}
                    onChange={e => setStatus(e.target.value as any)}
                    className="w-full p-2 text-xs border border-slate-200 rounded focus:outline-none bg-white text-slate-800"
                    id="tx_input_status"
                  >
                    <option value="posted">Post & Reconcile immediately</option>
                    <option value="unreviewed">Post (Mark for Manual Audit)</option>
                    <option value="needs_evidence">Post (Requires uploaded proof)</option>
                    <option value="draft">Save as local Draft</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Expanded Transaction Notes</label>
                  <textarea 
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Add comments on why this expense is generated, details of reimbursement agreements..."
                    className="w-full p-2 text-xs border border-slate-200 rounded h-16 resize-none focus:outline-none"
                    id="tx_input_notes"
                  />
                </div>
              </div>

              {/* Explanatory ledger balancing info banner */}
              <div className="p-3 bg-slate-55 border border-slate-200 rounded-lg text-[11px] text-slate-650 flex items-start gap-2">
                <SlidersHorizontal className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-bold">Automated General Ledger Translation:</p>
                  <p className="mt-0.5 text-slate-600">
                    This form structures a perfect double-entry ledger event. Saving will create one Debit entry line carrying (+${amount || '0.00'}) on account <strong>{accounts.find(a => a.id === toAccountId)?.name || 'Debit'}</strong>, and one Credit entry line carrying (-${amount || '0.00'}) on <strong>{accounts.find(a => a.id === fromAccountId)?.name || 'Credit'}</strong>. Total journal equation remains 100% balanced.
                  </p>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 text-xs">
                <button 
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="p-2 px-4 border border-slate-200 rounded hover:bg-slate-50 transition-colors font-semibold"
                  id="btn_tx_cancel"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="p-2 px-5 bg-slate-900 text-white hover:bg-slate-800 transition-colors rounded font-extrabold cursor-pointer"
                  id="btn_tx_submit"
                >
                  Confirm & Post Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
