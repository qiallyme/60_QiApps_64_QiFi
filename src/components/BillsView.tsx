import React, { useState } from 'react';
import { db } from '../db';
import { Bill, BillStatus } from '../types';
import { 
  Plus, 
  Calendar, 
  AlertCircle, 
  CheckCircle, 
  Repeat, 
  CreditCard, 
  HelpCircle,
  Clock,
  Trash
} from 'lucide-react';

interface BillsProps {
  triggerRefresh: () => void;
}

export function BillsView({ triggerRefresh }: BillsProps) {
  const bills = db.getBills();
  const people = db.getPeople();
  const accounts = db.getAccounts();
  const categories = db.getCategories();

  // Modal form triggers
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [recurringFrequency, setRecurringFrequency] = useState<Bill['recurring_frequency']>('monthly');
  const [status, setStatus] = useState<BillStatus>('upcoming');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [notes, setNotes] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const handleOpenCreateForm = () => {
    setEditingId(null);
    setTitle('');
    setVendorId(people[0]?.id || '');
    setAmount('');
    setDueDate(new Date().toISOString().substring(0, 10));
    setRecurringFrequency('monthly');
    setStatus('upcoming');
    setAccountId(accounts.find(a => ['checking', 'savings', 'cash'].includes(a.account_type))?.id || accounts[0]?.id || '');
    setCategoryId(db.getCategories().find(c => c.category_type === 'expense')?.id || '');
    setNotes('');
    setEvidenceUrl('');
    setIsFormOpen(true);
  };

  const handleEdit = (bill: Bill) => {
    setEditingId(bill.id);
    setTitle(bill.title);
    setVendorId(bill.vendor_id || '');
    setAmount(bill.amount.toString());
    setDueDate(bill.due_date);
    setRecurringFrequency(bill.recurring_frequency);
    setStatus(bill.status);
    setAccountId(bill.account_id || '');
    setCategoryId(bill.category_id || '');
    setNotes(bill.notes);
    setEvidenceUrl(bill.evidence_url || '');
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return alert('Please enter a descriptive invoice/bill title.');
    if (!amount || Number(amount) <= 0) return alert('Please input a valid positive statement balance.');
    if (!dueDate) return alert('Due date represents a required tracking attribute.');

    const preparedId = editingId || `bill-${Math.random().toString(36).substring(2, 9)}`;

    db.saveBill({
      id: preparedId,
      vendor_id: vendorId || null,
      title,
      amount: Number(amount),
      due_date: dueDate,
      recurring_frequency: recurringFrequency,
      status,
      account_id: accountId || null,
      category_id: categoryId || null,
      notes,
      evidence_url: evidenceUrl || null
    });

    setIsFormOpen(false);
    triggerRefresh();
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to discard this bill invoice?')) {
      const remaining = bills.filter(b => b.id !== id);
      localStorage.setItem('qifinance_bills', JSON.stringify(remaining));
      triggerRefresh();
    }
  };

  const payBillDirectly = (bill: Bill) => {
    if (!bill.account_id) {
       return alert('Please configure a proposed cash payment account in Modify first.');
    }

    // Determine target category
    const expenseId = bill.category_id || 'cat-utilities';
    const fallbackExpenseAccount = 'acct-expense-electricity'; // utility matching expense side

    const res = db.saveSimpleTransaction({
      date: new Date().toISOString().substring(0, 10),
      fromAccountId: bill.account_id, // Chase checking checking asset
      toAccountId: fallbackExpenseAccount, // matching double entry expense side
      amount: bill.amount,
      merchantOrPersonId: bill.vendor_id || '',
      categoryId: expenseId,
      description: `Payment for bill: ${bill.title}`,
      status: 'posted',
      receiptUrl: bill.evidence_url || '',
      isDisputed: false,
      isReimbursable: false,
      notes: `Settled from Invoice Ledger ID #${bill.id}`,
      relatedBillId: bill.id
    });

    if (res.success) {
      db.saveBill({
        ...bill,
        status: 'paid'
      });
      alert(`Payoff logged successfully! A balanced journal transaction was posted, and checking assets decreased by ${formatCurrency(bill.amount)}.`);
      triggerRefresh();
    } else {
      alert(`Ledger pay failure: ${res.error}`);
    }
  };

  return (
    <div className="space-y-6" id="bills_view_block">
       {/* Upper bar */}
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-2 border-b border-gray-100">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 font-sans" id="bills_main_heading">
            Bills liability & recurring schedules
          </h2>
          <p className="text-xs text-slate-500 font-mono">
            UPCOMING EXPENDITURE CALENDARS • AUTO-GENERATES DEBIT/CREDIT MOVEMENT ON PAYMENT EVENTS
          </p>
        </div>
        <button 
          onClick={handleOpenCreateForm}
          className="mt-3 sm:mt-0 flex items-center gap-1.5 px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm font-sans focus:outline-none cursor-pointer"
          id="btn_log_bill"
        >
          <Plus className="w-4 h-4" />
          Add Bill Invoice
        </button>
      </div>

      {/* Bill Lists Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="bills_main_sections">
        {/* Section A: Outstanding upcoming/overdue */}
        <div className="space-y-4" id="outstanding_bills_box">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono">Outstanding & upcoming invoices</h3>
          
          <div className="space-y-3" id="upcoming_bills_feed">
            {bills.filter(b => b.status === 'upcoming').length === 0 ? (
              <div className="p-12 text-center bg-white border border-gray-150 rounded-xl text-slate-400 text-xs font-sans">
                No active outstanding invoices registered. Outstanding liabilities fully clear!
              </div>
            ) : (
              bills.filter(b => b.status === 'upcoming').map(bill => {
                const isOverdue = new Date(bill.due_date) < new Date();
                const personObj = people.find(p => p.id === bill.vendor_id);
                const fundingAcct = accounts.find(a => a.id === bill.account_id);

                return (
                  <div 
                    key={bill.id} 
                    className={`p-4 bg-white border rounded-xl flex items-start justify-between gap-4 relative ${isOverdue ? 'border-rose-200 bg-rose-50/5' : 'border-slate-200'}`}
                    id={`bill_item_${bill.id}`}
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900 truncate">{bill.title}</h4>
                        {isOverdue && (
                          <span className="p-0.5 px-1.5 uppercase font-mono tracking-widest text-[8px] font-bold text-rose-700 bg-rose-100 rounded">
                            OVERDUE
                          </span>
                        )}
                      </div>

                      <p className="text-[10px] text-slate-500 font-mono">
                        Vendor: <strong>{personObj?.display_name || 'Individual'}</strong> • Due Date: {bill.due_date}
                      </p>

                      <div className="flex items-center gap-3 text-[10px] text-slate-400 font-sans flex-wrap">
                        <span className="flex items-center gap-0.5 font-mono capitalize">
                          <Repeat className="w-3.5 h-3.5" />
                          Cycle: {bill.recurring_frequency}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-0.5 font-mono">
                          <CreditCard className="w-3.5 h-3.5" />
                          Pay From: {fundingAcct?.name || 'NOT CONFIGURED'}
                        </span>
                      </div>

                      {bill.notes && (
                        <p className="text-[10px] text-slate-450 italic font-mono pt-1">
                          &ldquo;{bill.notes}&rdquo;
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-3 flex-shrink-0 text-right">
                      <span className="text-sm font-mono font-black text-slate-900">
                        {formatCurrency(bill.amount)}
                      </span>

                      <div className="flex gap-2">
                        <button 
                          onClick={() => payBillDirectly(bill)}
                          className="px-2 py-1 text-[10px] bg-slate-900 hover:bg-slate-800 text-white rounded font-bold uppercase tracking-wider font-mono cursor-pointer"
                          id={`btn_pay_bill_${bill.id}`}
                        >
                          Settle Paid
                        </button>
                        <button 
                          onClick={() => handleEdit(bill)}
                          className="p-1 px-[7px] border border-slate-200 text-slate-700 hover:bg-slate-50 rounded text-[10px] cursor-pointer"
                          id={`btn_edit_bill_${bill.id}`}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Section B: Historic Paid/Other status */}
        <div className="space-y-4" id="historic_bills_box">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono font-sans">Resolved & canceled history</h3>
          
          <div className="space-y-2.5" id="historic_bills_feed">
            {bills.filter(b => b.status !== 'upcoming').length === 0 ? (
              <div className="p-12 text-center bg-slate-50 border border-dashed border-slate-100 text-slate-400 text-xs rounded-xl">
                No archived or settled bill invoices recorded.
              </div>
            ) : (
              bills.filter(b => b.status !== 'upcoming').map(bill => {
                const personObj = people.find(p => p.id === bill.vendor_id);
                const isPaid = bill.status === 'paid';
                return (
                  <div key={bill.id} className="p-3 bg-white border border-slate-150 rounded-xl flex items-center justify-between text-xs opacity-75">
                    <div className="space-y-0.5 truncate pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-800 truncate">{bill.title}</span>
                        <span className={`text-[8px] font-bold px-1 rounded uppercase tracking-wider ${isPaid ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-150 text-slate-600'}`}>
                          {bill.status}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-450 font-mono">
                        Vendor: {personObj?.display_name || 'Individual'} • Settled: {bill.due_date}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-slate-800">
                        {formatCurrency(bill.amount)}
                      </span>
                      <button 
                        onClick={() => handleDelete(bill.id)}
                        className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Delete bill"
                        id={`btn_delete_bill_${bill.id}`}
                      >
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Bill Invoice Form modal Drawer */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="bill_modal_overlay">
          <div className="bg-white rounded-xl shadow-lg border border-slate-300 w-full max-w-lg overflow-hidden animate-fade-in" id="bill_modal_content">
             <div className="p-4 bg-slate-950 text-white flex justify-between items-center">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider">
                {editingId ? 'Modify billing invoice' : 'Record New billing invoice'}
              </h3>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-white font-mono text-xs cursor-pointer"
                id="btn_bill_modal_close_upper"
              >
                (✖)
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4" id="bill_modal_form">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Invoice / Bill description Title</label>
                  <input 
                    type="text"
                    required
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g., Summer PGE high heating cooling utilities"
                    className="w-full p-2 text-xs border border-slate-200 rounded"
                    id="bill_field_title"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Invoiced Vendor (Person/Company)</label>
                  <select 
                    value={vendorId}
                    onChange={e => setVendorId(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded bg-white text-slate-800"
                    id="bill_field_vendor"
                  >
                    {people.map(p => (
                      <option key={p.id} value={p.id}>{p.display_name} ({p.type})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Statement balance due ($ USD)</label>
                  <input 
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="89.50"
                    className="w-full p-2 text-xs border border-slate-200 rounded font-mono font-bold"
                    id="bill_field_amount"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Statement Due Date</label>
                  <input 
                    type="date"
                    required
                    value={dueDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded"
                    id="bill_field_due"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Cycle recurrence</label>
                  <select 
                    value={recurringFrequency}
                    onChange={e => setRecurringFrequency(e.target.value as any)}
                    className="w-full p-2 text-xs border border-slate-200 rounded bg-white"
                    id="bill_field_freq"
                  >
                    <option value="none">One Time Invoice (none)</option>
                    <option value="weekly">Weekly liability</option>
                    <option value="biweekly">Bi-weekly liability</option>
                    <option value="monthly">Monthly Cycle</option>
                    <option value="yearly">Annual Settlement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Proposed payoff account</label>
                  <select 
                    value={accountId}
                    onChange={e => setAccountId(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded bg-white text-slate-800"
                    id="bill_field_proposed_acct"
                  >
                    {accounts.filter(a => ['checking', 'savings', 'cash'].includes(a.account_type)).map(a => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Matching Chart Expense Category</label>
                  <select 
                    value={categoryId}
                    onChange={e => setCategoryId(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded bg-white text-slate-800 capitalize font-mono text-[11px]"
                    id="bill_field_cat"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.category_type})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Invoice Status</label>
                  <select 
                    value={status}
                    onChange={e => setStatus(e.target.value as BillStatus)}
                    className="w-full p-2 text-xs border border-slate-200 rounded bg-white"
                    id="bill_field_status"
                  >
                    <option value="upcoming">Upcoming Outstanding</option>
                    <option value="paid font-bold text-emerald-700">Archived Paid</option>
                    <option value="overdue">Overdue Outstanding</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Copied Statement Evidence URL</label>
                  <input 
                    type="url"
                    value={evidenceUrl}
                    onChange={e => setEvidenceUrl(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded"
                    placeholder="https://gdrive-scans.com/pge-invoice-june.pdf"
                    id="bill_field_evidence"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Invoice internal comments</label>
                  <textarea 
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Direct debit configurations, credit card rewards links, automatic autopay indicators..."
                    className="w-full p-2 text-xs border border-slate-200 rounded h-16 resize-none focus:outline-none"
                    id="bill_field_notes"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 text-xs">
                <button 
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="p-2 px-4 border border-slate-200 rounded hover:bg-slate-50 font-semibold"
                  id="btn_bill_form_cancel"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="p-2 px-5 bg-slate-900 border border-slate-900 hover:bg-slate-800 text-white rounded font-bold cursor-pointer"
                  id="btn_bill_form_submit"
                >
                  Confirm Bill liability
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
