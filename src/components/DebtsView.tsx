import React, { useState } from 'react';
import { db } from '../db';
import { Debt, DebtType, DebtStatus, Person } from '../types';
import { 
  Plus, 
  User, 
  TrendingUp, 
  TrendingDown, 
  Search, 
  FileCheck, 
  HelpCircle,
  Calendar,
  AlertTriangle,
  MinusCircle,
  PlusCircle,
  FolderLock
} from 'lucide-react';

interface DebtsProps {
  triggerRefresh: () => void;
}

export function DebtsView({ triggerRefresh }: DebtsProps) {
  const people = db.getPeople();
  const debts = db.getDebts();
  const accounts = db.getAccounts();
  const journalEntries = db.getJournalEntries();
  const journalLines = db.getJournalLines();

  // Search/Filters states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  
  // Person-specific Ledger view state
  const [selectedLedgerPersonId, setSelectedLedgerPersonId] = useState<string>('');

  // Creation/Edit Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [debtType, setDebtType] = useState<DebtType>('owes_me');
  const [personId, setPersonId] = useState(people[0]?.id || '');
  const [originalAmount, setOriginalAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [startDate, setStartDate] = useState(new Date().toISOString().substring(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState<DebtStatus>('active');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [notes, setNotes] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');

  // Payment Log Modal States
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentDebt, setPaymentDebt] = useState<Debt | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().substring(0, 10));
  const [paymentBankAccountId, setPaymentBankAccountId] = useState('');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const handleOpenCreateForm = () => {
    setEditingId(null);
    setTitle('');
    setDebtType('owes_me');
    setPersonId(people[0]?.id || '');
    setOriginalAmount('');
    setCurrency('USD');
    setStartDate(new Date().toISOString().substring(0, 10));
    setDueDate('');
    setStatus('active');
    setPriority('medium');
    setNotes('');
    setEvidenceUrl('');
    setIsFormOpen(true);
  };

  const handleEdit = (debt: Debt) => {
    setEditingId(debt.id);
    setTitle(debt.title);
    setDebtType(debt.debt_type);
    setPersonId(debt.person_id);
    setOriginalAmount(debt.original_amount.toString());
    setCurrency(debt.currency);
    setStartDate(debt.start_date);
    setDueDate(debt.due_date || '');
    setStatus(debt.status);
    setPriority(debt.priority);
    setNotes(debt.notes);
    setEvidenceUrl(debt.evidence_url || '');
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return alert('Please enter a descriptive debt title.');
    if (!originalAmount || Number(originalAmount) <= 0) return alert('Please input a valid debt value.');
    if (!personId) return alert('A registered party is required for debt tracking.');

    const preparedId = editingId || `debt-${Math.random().toString(36).substring(2, 9)}`;

    db.saveDebt({
      id: preparedId,
      title,
      debt_type: debtType,
      person_id: personId,
      original_amount: Number(originalAmount),
      current_balance: editingId ? debts.find(d => d.id === editingId)!.current_balance : Number(originalAmount),
      currency,
      start_date: startDate,
      due_date: dueDate || null,
      status,
      priority,
      notes,
      evidence_url: evidenceUrl || null
    });

    setIsFormOpen(false);
    triggerRefresh();
  };

  const handleOpenPaymentLog = (d: Debt) => {
    setPaymentDebt(d);
    setPaymentAmount('');
    setPaymentDate(new Date().toISOString().substring(0, 10));
    setPaymentBankAccountId(accounts.find(a => ['checking', 'savings', 'cash'].includes(a.account_type))?.id || accounts[0]?.id || '');
    setIsPaymentOpen(true);
  };

  const handleLogPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentDebt) return;
    if (!paymentAmount || Number(paymentAmount) <= 0) return alert('Invalid payment amount.');
    if (!paymentBankAccountId) return alert('Please select a funding bank account.');

    // Payments toward a debt reduce its current_balance.
    // Let's model a payment journal entry!
    // Example:
    // 1. If "debtType" is owes_me (we are receiving cash reduction on our asset/receivable):
    //    - Debit: Bank Checking (increases asset by paymentAmount)
    //    - Credit: Sarah Loan Receivable account (decreases receivable asset by paymentAmount)
    // 2. If "debtType" is i_owe (we are paying down our liability):
    //    - Debit: Toyota Auto Loan Account (decreases liability normal-credit balance by paymentAmount)
    //    - Credit: Bank Checking (decreases cash normal-debit balance by paymentAmount)

    // Find custom matching accounts
    const checkingAcctId = paymentBankAccountId;
    let targetAcctId = '';

    if (paymentDebt.debt_type === 'owes_me') {
      targetAcctId = 'acct-receivable-sarah'; // fallback or matching receivable account
    } else {
      targetAcctId = 'acct-car-loan'; // fallback or matching liability loan account
    }

    const res = db.saveSimpleTransaction({
      date: paymentDate,
      fromAccountId: paymentDebt.debt_type === 'owes_me' ? targetAcctId : checkingAcctId,
      toAccountId: paymentDebt.debt_type === 'owes_me' ? checkingAcctId : targetAcctId,
      amount: Number(paymentAmount),
      merchantOrPersonId: paymentDebt.person_id,
      categoryId: 'cat-debt-pay',
      description: `Debt payment payoff: ${paymentDebt.title}`,
      status: 'posted',
      receiptUrl: '',
      isDisputed: false,
      isReimbursable: false,
      notes: `Direct logged payment reducing informal debt registry ${paymentDebt.id}`,
      relatedDebtId: paymentDebt.id
    });

    if (res.success) {
      // Set debt as paid if current_balance will be fully resolved
      const remaining = Math.max(0, paymentDebt.current_balance - Number(paymentAmount));
      if (remaining === 0) {
        db.saveDebt({
          ...paymentDebt,
          status: 'paid',
          current_balance: 0
        });
      } else {
         db.saveDebt({
          ...paymentDebt,
          current_balance: remaining
        });
      }

      setIsPaymentOpen(false);
      alert('Debt payment journal entry successfully posted to double-entry system. Balance updated!');
      triggerRefresh();
    } else {
      alert(`Ledger Validation Fail: ${res.error}`);
    }
  };

  // 1. Filtered Debts
  const filteredDebts = debts.filter(d => {
    const person = people.find(p => p.id === d.person_id);
    const textMatch = d.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.notes.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (person && person.display_name.toLowerCase().includes(searchQuery.toLowerCase()));

    const typeMatch = !filterType || d.debt_type === filterType || 
      (filterType === 'owes_me_all' && d.debt_type === 'owes_me') ||
      (filterType === 'i_owe_all' && d.debt_type === 'i_owe');

    return textMatch && typeMatch;
  });

  // 2. Who Owes Me report vs Who I Owe report
  const totalOwesMeBalance = debts
    .filter(d => d.debt_type === 'owes_me' && d.status === 'active')
    .reduce((sum, d) => sum + d.current_balance, 0);

  const totalIOweBalance = debts
    .filter(d => d.debt_type === 'i_owe' && d.status === 'active')
    .reduce((sum, d) => sum + d.current_balance, 0);

  // 3. Person specific chronological ledger details
  const personLedgerDebts = debts.filter(d => d.person_id === selectedLedgerPersonId);
  const personLedgerHistory = selectedLedgerPersonId ? journalEntries.filter(e => {
    return e.related_person_id === selectedLedgerPersonId && e.status === 'posted';
  }).map(e => {
    // Collect related debit/credits
    const matchingLines = journalLines.filter(l => l.journal_entry_id === e.id);
    const sumVal = matchingLines.reduce((sum, l) => sum + l.debit_amount, 0);
    return {
      ...e,
      total_amount: sumVal,
      lines: matchingLines
    };
  }).sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime()) : [];

  return (
    <div className="space-y-6" id="debts_view_block">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-2 border-b border-gray-100">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 font-sans" id="debts_main_title">
            Informal Ledgers & Debts (IOUs)
          </h2>
          <p className="text-xs text-slate-500 font-mono">
            TRACK ADVANCES, WORK REIMBURSEMENTS, LOANS & SETTLEMENTS ATTACHED TO POSTED DOUBLE ENTRIES
          </p>
        </div>
        <button 
          onClick={handleOpenCreateForm}
          className="mt-3 sm:mt-0 flex items-center gap-1.5 px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm font-sans focus:outline-none cursor-pointer"
          id="btn_add_debt"
        >
          <Plus className="w-4 h-4" />
          Log New IOU
        </button>
      </div>

      {/* KPI summaries for Who Owes Me vs Who I Owe */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="debts_kpi_row">
        <div className="p-4 bg-emerald-50/40 border border-emerald-100 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-800 font-bold block">Who owes me [Receivable reports]</span>
            <h3 className="text-xl font-extrabold text-emerald-900 font-mono">{formatCurrency(totalOwesMeBalance)}</h3>
          </div>
          <div className="p-3 bg-emerald-100 rounded text-emerald-800">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 bg-rose-50/40 border border-rose-100 rounded-xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-rose-800 font-bold block font-bold">Whom I owe [Payable reports]</span>
            <h3 className="text-xl font-extrabold text-rose-900 font-mono">{formatCurrency(totalIOweBalance)}</h3>
          </div>
          <div className="p-3 bg-rose-100 rounded text-rose-800">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Master Debt List & Filtration */}
      <div className="space-y-4" id="debts_listing_area">
        <div className="bg-white p-3 border border-gray-150 rounded-lg flex flex-wrap items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2 bg-slate-50/80 p-1.5 px-2.5 rounded border border-slate-200 flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Search IOU ledgers by title or notes..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="text-xs text-slate-800 bg-transparent focus:outline-none flex-1 border-none"
              id="debt_search_field"
            />
          </div>

          <div className="flex gap-2">
            <select 
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="p-1 px-3 border border-gray-200 text-xs bg-white text-slate-700 rounded h-8"
              id="debt_filter_type"
            >
              <option value="">All IOUs</option>
              <option value="owes_me">Owed To Me (Receivable)</option>
              <option value="i_owe">Owed By Me (Liability)</option>
            </select>
          </div>
        </div>

        {/* Debt Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="debts_cards_grid">
          {filteredDebts.length === 0 ? (
            <div className="col-span-full p-12 text-center bg-white border border-gray-150 rounded-xl text-slate-400 text-xs font-sans">
              No active debts or IOUs found matching selection criteria.
            </div>
          ) : (
            filteredDebts.map(debt => {
              const person = people.find(p => p.id === debt.person_id);
              const isOwedToMe = debt.debt_type === 'owes_me';
              const isPaid = debt.status === 'paid';
              const isOverdue = debt.due_date && new Date(debt.due_date) < new Date() && !isPaid;

              return (
                <div 
                  key={debt.id} 
                  className={`p-4 bg-white rounded-xl border flex flex-col justify-between relative ${isPaid ? 'opacity-60 border-slate-100 bg-slate-50/20' : 'border-slate-200 hover:border-slate-300'}`}
                  id={`debt_card_${debt.id}`}
                >
                  <div>
                    <div className="flex justify-between items-start gap-2 border-b border-gray-50 pb-2">
                      <div>
                        <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded ${isOwedToMe ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                          {isOwedToMe ? 'Sarah / Party owes me' : 'I owe Party'}
                        </span>
                        <h4 className="text-xs font-bold text-slate-900 tracking-tight mt-1">
                          {debt.title}
                        </h4>
                        <p className="text-[10px] text-slate-550 font-mono mt-0.5">
                          Party: {person?.display_name || 'Individual'}
                        </p>
                      </div>

                      <span className={`text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${isPaid ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-800'}`}>
                        {debt.status}
                      </span>
                    </div>

                    {/* Numeric tracking values */}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs border-b border-gray-50 pb-3">
                      <div>
                        <span className="text-[9px] text-slate-400 font-mono uppercase">Outstanding Bal.</span>
                        <h3 className={`text-sm font-mono font-black ${isPaid ? 'text-slate-450' : 'text-slate-900'}`}>
                          {formatCurrency(debt.current_balance)}
                        </h3>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 font-mono uppercase">Original Advance</span>
                        <p className="text-xs font-mono text-slate-500">{formatCurrency(debt.original_amount)}</p>
                      </div>
                    </div>

                    <div className="mt-3 text-[10px] text-slate-500 font-sans space-y-1">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>Issued: {debt.start_date}</span>
                      </div>
                      {debt.due_date && (
                        <div className={`flex items-center gap-1 ${isOverdue ? 'text-rose-600 font-bold' : ''}`}>
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>Maturity: {debt.due_date} {isOverdue && '(OVERDUE)'}</span>
                        </div>
                      )}
                    </div>

                    {debt.notes && (
                      <p className="text-[10px] text-slate-500 italic mt-3 bg-slate-50 p-1.5 rounded border border-slate-100 line-clamp-2">
                        &ldquo;{debt.notes}&rdquo;
                      </p>
                    )}
                  </div>

                  {/* Operational actions footer */}
                  <div className="mt-4 pt-2.5 border-t border-slate-100 flex justify-end gap-2.5 text-[10px] font-bold uppercase font-mono">
                    {!isPaid && (
                      <button 
                        onClick={() => handleOpenPaymentLog(debt)}
                        className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white transition-all rounded shadow-xs cursor-pointer"
                        id={`btn_log_payment_${debt.id}`}
                      >
                        Book Paydown
                      </button>
                    )}

                    <button 
                      onClick={() => handleEdit(debt)}
                      className="px-2.5 py-1.5 border border-slate-200 text-slate-705 hover:bg-slate-100 rounded cursor-pointer"
                      id={`btn_edit_debt_${debt.id}`}
                    >
                      Modify
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Person Specific Ledger Ledger Report dropdown */}
      <div className="bg-white p-5 border border-blue-100 rounded-xl space-y-4" id="person_ledger_audit_block">
        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
          <div>
            <span className="text-xs font-bold text-blue-700 uppercase font-mono">Specific party Ledger reporting</span>
            <h3 className="text-sm font-semibold text-slate-900 font-sans mt-1">
              Person Chronological ledger audits
            </h3>
            <p className="text-xs text-slate-500 font-mono">
              Consolidate all debts, refunds, claims, and transactions for a specific family, vendor, or friend.
            </p>
          </div>

          <select 
            value={selectedLedgerPersonId}
            onChange={e => setSelectedLedgerPersonId(e.target.value)}
            className="p-1 px-4 border border-blue-200 text-xs bg-white text-slate-800 rounded font-semibold cursor-pointer"
            id="person_ledger_select"
          >
            <option value="">-- Choose party to audit --</option>
            {people.map(p => (
              <option key={p.id} value={p.id}>{p.display_name} ({p.type})</option>
            ))}
          </select>
        </div>

        {selectedLedgerPersonId ? (
          <div className="space-y-4" id="person_ledger_output">
            {/* Quick stats on selected person */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-100" id="person_audit_mini_kpis">
              <div className="text-xs text-slate-800">
                <span className="text-[10px] text-slate-450 uppercase block font-mono">Total Debts Extended</span>
                <p className="font-extrabold text-slate-800 font-mono mt-0.5">
                  {formatCurrency(personLedgerDebts.filter(d => d.debt_type === 'owes_me').reduce((sum, d) => sum + d.current_balance, 0))}
                </p>
              </div>

              <div className="text-xs text-slate-800">
                <span className="text-[10px] text-slate-455 uppercase block font-mono">Total Debts Owed by me</span>
                <p className="font-extrabold text-slate-805 font-mono mt-0.5">
                  {formatCurrency(personLedgerDebts.filter(d => d.debt_type === 'i_owe').reduce((sum, d) => sum + d.current_balance, 0))}
                </p>
              </div>

              <div className="col-span-2 md:col-span-1 text-xs text-slate-750">
                <span className="text-[10px] text-slate-400 uppercase block font-mono block">Registered Mail</span>
                <p className="font-semibold text-slate-650 truncate mt-0.5">
                  {people.find(p => p.id === selectedLedgerPersonId)?.email || 'None on record'}
                </p>
              </div>
            </div>

            {/* Audit Log Table */}
            <div className="overflow-x-auto" id="person_ledger_activity_table">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-150 text-[10px] uppercase font-mono text-slate-400">
                    <th className="p-2.5">Audit Date</th>
                    <th className="p-2.5">Event Description</th>
                    <th className="p-2.5">Source Type</th>
                    <th className="p-2.5 text-right">Sum Val</th>
                    <th className="p-2.5 text-right pr-4">Reference Key</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-[11px]">
                  {personLedgerHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400 font-sans">
                        No transactions registered to this party in posted journal history.
                      </td>
                    </tr>
                  ) : (
                    personLedgerHistory.map(entry => (
                      <tr key={entry.id} className="hover:bg-slate-50/30">
                        <td className="p-2.5 font-mono text-slate-650">{entry.entry_date}</td>
                        <td className="p-2.5">
                          <p className="font-bold text-slate-900">{entry.description}</p>
                          {entry.memo && <span className="text-[10px] text-slate-400 italic block">{entry.memo}</span>}
                        </td>
                        <td className="p-2.5 uppercase font-mono text-slate-500 font-bold text-[10px]">{entry.source}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-800">{formatCurrency(entry.total_amount)}</td>
                        <td className="p-2.5 text-right font-mono text-slate-400 pr-4 text-[10px]">#{entry.id.substring(0, 8)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center border border-dashed border-slate-100 text-slate-400 text-xs font-sans rounded-xl">
            Choose an active party from the menu dropdown to populate a complete individual account statement.
          </div>
        )}
      </div>

      {/* Log payment Modal */}
      {isPaymentOpen && paymentDebt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="payment_modal_overlay">
          <div className="bg-white rounded-xl shadow-lg border border-slate-300 w-full max-w-md animate-fade-in" id="payment_modal_content">
            <div className="p-4 bg-slate-950 text-white flex justify-between items-center">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5">
                <MinusCircle className="w-4 h-4 text-emerald-400" />
                Book Settlement Paydown
              </h3>
              <button 
                onClick={() => setIsPaymentOpen(false)}
                className="text-slate-400 hover:text-white font-mono text-xs cursor-pointer"
                id="btn_payment_modal_close_upper"
              >
                (✖)
              </button>
            </div>

            <form onSubmit={handleLogPaymentSubmit} className="p-5 space-y-4" id="payment_modal_form">
              <div>
                <span className="text-[10px] text-slate-400 font-mono block uppercase">Liability Debt / IOU</span>
                <p className="text-xs font-black text-slate-800 mt-1">{paymentDebt.title}</p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">Remaining Outstand balance: {formatCurrency(paymentDebt.current_balance)}</p>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Paydown Amount ($ USD)</label>
                <input 
                  type="number"
                  step="0.01"
                  required
                  max={paymentDebt.current_balance}
                  value={paymentAmount}
                  placeholder="0.00"
                  onChange={e => setPaymentAmount(e.target.value)}
                  className="w-full p-2 text-xs border border-slate-200 rounded font-mono font-black"
                  id="paydown_amount_field"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Payment Date</label>
                <input 
                  type="date"
                  required
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  className="w-full p-2 text-xs border border-slate-200 rounded"
                  id="paydown_date_field"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Bank Cash Account</label>
                <select 
                  value={paymentBankAccountId}
                  onChange={e => setPaymentBankAccountId(e.target.value)}
                  className="w-full p-2 text-xs border border-slate-200 rounded bg-white text-slate-800 font-semibold"
                  id="paydown_bank_select"
                >
                  {accounts.filter(a => ['checking', 'savings', 'cash'].includes(a.account_type)).map(a => (
                    <option key={a.id} value={a.id}>{a.name} (${a.current_balance.toFixed(2)})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 text-xs">
                <button 
                  type="button"
                  onClick={() => setIsPaymentOpen(false)}
                  className="p-2 px-4 border border-slate-200 rounded hover:bg-slate-50 font-semibold"
                  id="btn_paydown_cancel"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="p-2 px-5 bg-slate-900 hover:bg-slate-805 text-white rounded font-bold cursor-pointer"
                  id="btn_paydown_confirm"
                >
                  Record Settlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Debt Creation Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="debt_form_overlay">
          <div className="bg-white rounded-xl shadow-lg border border-slate-300 w-full max-w-lg animate-fade-in" id="debt_form_content">
            <div className="p-4 bg-slate-950 text-white flex justify-between items-center">
              <h3 className="text-xs font-bold font-mono uppercase">
                {editingId ? 'Modify informal IOU' : 'Log New informal IOU'}
              </h3>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-white font-mono text-xs cursor-pointer"
                id="btn_debt_modal_close_upper"
              >
                (✖)
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4" id="debt_creation_form">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">IOU / Debt Title</label>
                  <input 
                    type="text"
                    required
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g., Sarah ticket compensation split"
                    className="w-full p-2 text-xs border border-slate-200 rounded focus:ring-1 focus:ring-slate-900"
                    id="debt_field_title"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Debt Direction</label>
                  <select 
                    value={debtType}
                    onChange={e => setDebtType(e.target.value as DebtType)}
                    className="w-full p-2 text-xs border border-slate-200 rounded bg-white"
                    id="debt_field_type"
                  >
                    <option value="owes_me">Party owes me money (Receivable)</option>
                    <option value="i_owe">I owe this party money (Liability)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Involved Party (Person/Company)</label>
                  <select 
                    value={personId}
                    onChange={e => setPersonId(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded bg-white text-slate-800"
                    id="debt_field_person"
                  >
                    {people.map(p => (
                      <option key={p.id} value={p.id}>{p.display_name} ({p.type})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Principal Value amount ($ USD)</label>
                  <input 
                    type="number"
                    step="0.01"
                    required
                    value={originalAmount}
                    onChange={e => setOriginalAmount(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded font-mono font-bold"
                    id="debt_field_amount"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Priority flag</label>
                  <select 
                    value={priority}
                    onChange={e => setPriority(e.target.value as any)}
                    className="w-full p-2 text-xs border border-slate-200 rounded bg-white"
                    id="debt_field_priority"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Agreement Start Date</label>
                  <input 
                    type="date"
                    required
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded"
                    id="debt_field_start"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">repayment Due Date (Optional)</label>
                  <input 
                    type="date"
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded bg-white"
                    id="debt_field_due"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Status</label>
                  <select 
                    value={status}
                    onChange={e => setStatus(e.target.value as DebtStatus)}
                    className="w-full p-2 text-xs border border-slate-200 rounded bg-white"
                    id="debt_field_status"
                  >
                    <option value="active">Active (Outstanding)</option>
                    <option value="paid">Paid & Settled</option>
                    <option value="disputed">Under Dispute</option>
                    <option value="forgiven">Forgiven / Written down</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Written Evidence/Contract File URL</label>
                  <input 
                    type="url"
                    value={evidenceUrl}
                    onChange={e => setEvidenceUrl(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded"
                    id="debt_field_evidence"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Specific repayment conditions & notes</label>
                  <textarea 
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Log details such as payment installment plans, bank transfers already pending..."
                    className="w-full p-2 text-xs border border-slate-200 rounded h-16 resize-none focus:outline-none"
                    id="debt_field_notes"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 text-xs">
                <button 
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="p-2 px-4 border border-slate-200 rounded hover:bg-slate-50 font-semibold"
                  id="btn_debt_form_cancel"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="p-2 px-5 bg-slate-900 border border-slate-900 hover:bg-slate-800 text-white rounded font-bold cursor-pointer"
                  id="btn_debt_form_submit"
                >
                  Confirm Debt Registry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
