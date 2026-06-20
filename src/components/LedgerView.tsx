import React, { useState } from 'react';
import { db, uuid } from '../db';
import { JournalEntry, JournalLine, Account, Category } from '../types';
import { 
  Plus, 
  Trash2, 
  AlertCircle, 
  CheckCircle, 
  GitCompare, 
  PlusCircle, 
  HelpCircle,
  FileText
} from 'lucide-react';

interface LedgerViewProps {
  triggerRefresh: () => void;
}

interface DraftLineInput {
  accountId: string;
  categoryId: string;
  debitAmount: string;
  creditAmount: string;
  memo: string;
}

export function LedgerView({ triggerRefresh }: LedgerViewProps) {
  const accounts = db.getAccounts();
  const categories = db.getCategories();
  const entries = db.getJournalEntries();
  const lines = db.getJournalLines();
  const people = db.getPeople();

  // Expanded lines creator states
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().substring(0, 10));
  const [description, setDescription] = useState('');
  const [memo, setMemo] = useState('');
  const [relatedPersonId, setRelatedPersonId] = useState('');
  
  // Start with 2 empty lines
  const [draftLines, setDraftLines] = useState<DraftLineInput[]>([
    { accountId: accounts[0]?.id || '', categoryId: '', debitAmount: '', creditAmount: '', memo: '' },
    { accountId: accounts[1]?.id || '', categoryId: '', debitAmount: '', creditAmount: '', memo: '' }
  ]);

  const [creatorError, setCreatorError] = useState('');

  const handleAddLine = () => {
    setDraftLines([
      ...draftLines,
      { accountId: accounts[0]?.id || '', categoryId: '', debitAmount: '', creditAmount: '', memo: '' }
    ]);
  };

  const handleRemoveLine = (idx: number) => {
    if (draftLines.length <= 2) {
      alert('A valid journal entries transaction draft requires at least 2 lines.');
      return;
    }
    setDraftLines(draftLines.filter((_, i) => i !== idx));
  };

  const handleLineChange = (idx: number, field: keyof DraftLineInput, val: string) => {
    const updated = [...draftLines];
    
    // Constraint: Can't have positive debit and credit on same line
    if (field === 'debitAmount' && Number(val) > 0) {
      updated[idx].creditAmount = '';
    } else if (field === 'creditAmount' && Number(val) > 0) {
      updated[idx].debitAmount = '';
    }

    updated[idx] = {
      ...updated[idx],
      [field]: val
    };
    setDraftLines(updated);
  };

  const handleSubmitLedgerEvent = (e: React.FormEvent) => {
    e.preventDefault();
    setCreatorError('');

    if (!description.trim()) {
      setCreatorError('Please enter a descriptive transaction title.');
      return;
    }

    // Prepare entries
    let totalDebits = 0;
    let totalCredits = 0;
    const preparedLines: JournalLine[] = [];
    const newEntryId = uuid();

    for (let i = 0; i < draftLines.length; i++) {
      const d = draftLines[i];
      const deb = Number(d.debitAmount) || 0;
      const cred = Number(d.creditAmount) || 0;

      if (deb === 0 && cred === 0) {
        setCreatorError(`Line #${i + 1} balance error: Each line must contain either a non-zero Debit or Credit value.`);
        return;
      }
      if (deb > 0 && cred > 0) {
        setCreatorError(`Line #${i + 1} validation error: Debit and Credit cannot both carry values on the same line.`);
        return;
      }
      if (deb < 0 || cred < 0) {
        setCreatorError(`Line #${i + 1} error: Negative entries are strictly forbidden.`);
        return;
      }

      totalDebits += deb;
      totalCredits += cred;

      preparedLines.push({
        id: uuid(),
        journal_entry_id: newEntryId,
        account_id: d.accountId,
        category_id: d.categoryId || null,
        debit_amount: deb,
        credit_amount: cred,
        memo: d.memo || description,
        created_at: new Date().toISOString()
      });
    }

    // Hard balancing rule
    const mathDifference = Math.abs(totalDebits - totalCredits);
    if (mathDifference > 0.01) {
      setCreatorError(`Double-entry check failed: Out of balance. Total debits ($${totalDebits.toFixed(2)}) must exactly correspond to total credits ($${totalCredits.toFixed(2)}). Delta: $${mathDifference.toFixed(2)}`);
      return;
    }

    // Save
    const parentEntry: JournalEntry = {
      id: newEntryId,
      entry_date: entryDate,
      description,
      memo,
      source: 'manual',
      status: 'posted',
      related_person_id: relatedPersonId || null,
      related_bill_id: null,
      related_debt_id: null,
      related_asset_id: null,
      evidence_url: null,
      import_batch_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const res = db.postJournalEntry(parentEntry, preparedLines);
    if (res.success) {
      alert('Direct general ledger transaction posted successfully!');
      setIsCreatorOpen(false);
      triggerRefresh();
    } else {
      setCreatorError(res.error || 'Unknown post error.');
    }
  };

  const handleReverseEntry = (id: string) => {
    if (confirm('Verify: Generate an automatic reversing double-entry audit adjust for this posted transaction?')) {
      const res = db.reverseJournalEntry(id);
      if (res.success) {
        alert('Audit reversal posted.');
        triggerRefresh();
      } else {
        alert(`Failed: ${res.error}`);
      }
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  return (
    <div className="space-y-6" id="ledger_view_block">
      {/* Upper Panel */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-2 border-b border-gray-100">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 font-sans" id="ledger_main_heading">
            Double-Entry General Ledger Accounts Audit
          </h2>
          <p className="text-xs text-slate-500 font-mono">
            COMPLIANCE METRICS: HARD EQUILIBRIUM RULES ENFORCED • DEBITS MUST EQUAL CREDITS
          </p>
        </div>
        <button 
          onClick={() => {
            setDraftLines([
              { accountId: accounts[0]?.id || '', categoryId: '', debitAmount: '', creditAmount: '', memo: '' },
              { accountId: accounts[1]?.id || '', categoryId: '', debitAmount: '', creditAmount: '', memo: '' }
            ]);
            setDescription('');
            setMemo('');
            setRelatedPersonId('');
            setCreatorError('');
            setIsCreatorOpen(true);
          }}
          className="mt-3 sm:mt-0 flex items-center gap-1.5 px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm font-sans focus:outline-none cursor-pointer"
          id="btn_open_ledger_creator"
        >
          <GitCompare className="w-4 h-4 text-emerald-450" />
          Direct Split-Entry Form
        </button>
      </div>

      {/* Main Journal Feed */}
      <div className="space-y-5" id="ledger_journal_feed">
        {entries.length === 0 ? (
          <div className="p-16 text-center bg-white border border-gray-150 rounded-xl text-slate-400 text-xs font-sans">
            No journal entries exist within persistent storage. Click Split-Entry to generate manual postings.
          </div>
        ) : (
          [...entries]
            .sort((a, b) => new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime())
            .map(entry => {
              const entryLines = lines.filter(l => l.journal_entry_id === entry.id);
              const totalDebitSum = entryLines.reduce((sum, l) => sum + l.debit_amount, 0);
              const relatedPerson = people.find(p => p.id === entry.related_person_id);

              const isPosted = entry.status === 'posted';
              const isVoided = entry.status === 'voided';
              const isDraft = entry.status === 'draft';

              return (
                <div 
                  key={entry.id} 
                  className={`bg-white rounded-xl border p-4 space-y-3 transition-all ${isVoided ? 'opacity-60 bg-gray-50/50 border-gray-200' : 'border-gray-200 shadow-xs'}`}
                  id={`je_block_${entry.id}`}
                >
                  {/* Ledger Row Top Metadata */}
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-50 pb-2.5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="p-1 px-2.5 bg-slate-50 border border-slate-150 rounded text-xs font-mono font-bold text-slate-700">
                          {entry.entry_date}
                        </span>
                        <h3 className="text-xs font-bold text-slate-850 font-sans tracking-tight">
                          {entry.description}
                        </h3>
                        {isPosted && (
                          <span className="p-0.5 px-2 tracking-wider text-[8px] font-mono font-black text-emerald-700 bg-emerald-50 rounded">POSTED</span>
                        )}
                        {isVoided && (
                          <span className="p-0.5 px-2 tracking-wider text-[8px] font-mono font-black text-slate-400 bg-slate-100 rounded">VOIDED</span>
                        )}
                        {isDraft && (
                          <span className="p-0.5 px-2 tracking-wider text-[8px] font-mono font-black text-blue-700 bg-blue-50 rounded font-normal">DRAFT</span>
                        )}
                      </div>
                      
                      <p className="text-[10px] text-slate-450 font-mono">
                        Source: <span className="uppercase">{entry.source}</span> • Ref: {entry.id} • Party: {relatedPerson?.display_name || 'NONE'}
                      </p>
                    </div>

                    {/* Monetary total recap */}
                    <div className="text-right">
                      <span className="text-[9px] text-slate-400 font-mono block uppercase">Entry Book Value</span>
                      <span className="text-xs font-mono font-extrabold text-slate-900">
                        {formatCurrency(totalDebitSum)}
                      </span>
                    </div>
                  </div>

                  {/* Individual Double-Entry Lines Table */}
                  <div className="overflow-x-auto" id={`jl_table_container_${entry.id}`}>
                    <table className="w-full text-left text-[11px] font-sans">
                      <thead>
                        <tr className="text-[9px] font-bold text-slate-400 uppercase font-mono tracking-wider border-b border-gray-100">
                          <th className="pb-1.5 pl-2">Gl Account Code</th>
                          <th className="pb-1.5">Category Matching</th>
                          <th className="pb-1.5">Memo Log</th>
                          <th className="pb-1.5 text-right font-mono pr-4">Debit (+)</th>
                          <th className="pb-1.5 text-right font-mono pr-2">Credit (-)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50/70">
                        {entryLines.map(line => {
                          const acctName = accounts.find(a => a.id === line.account_id)?.name || 'Account Out of chart';
                          const catName = categories.find(c => c.id === line.category_id)?.name || 'NONE';
                          
                          return (
                            <tr key={line.id} className="hover:bg-slate-50/20">
                              <td className="py-2 pl-2 font-bold text-slate-700">{acctName}</td>
                              <td className="py-2 text-slate-500 capitalize">{catName}</td>
                              <td className="py-2 text-slate-450 italic">{line.memo || 'General ledger posting'}</td>
                              <td className="py-2 text-right font-mono text-emerald-700 font-extrabold pr-4">
                                {line.debit_amount > 0 ? formatCurrency(line.debit_amount) : '0.00'}
                              </td>
                              <td className="py-2 text-right font-mono text-rose-600 font-bold pr-2">
                                {line.credit_amount > 0 ? formatCurrency(line.credit_amount) : '0.00'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Action items on custom ledger line */}
                  {entry.memo && (
                    <div className="p-2 bg-slate-50 border border-slate-100 rounded text-[10px] text-slate-500 font-sans italic">
                      Memo notes: &ldquo;{entry.memo}&rdquo;
                    </div>
                  )}

                  {isPosted && (
                    <div className="flex justify-end pt-2 border-t border-slate-50">
                      <button 
                        onClick={() => handleReverseEntry(entry.id)}
                        className="text-[10px] font-mono font-extrabold p-1 px-2.5 text-rose-700 border border-rose-100 bg-rose-50 hover:bg-rose-955 hover:text-white transition-all rounded uppercase cursor-pointer"
                        id={`btn_direct_reverse_${entry.id}`}
                      >
                        File Reversal Entry Adjustment
                      </button>
                    </div>
                  )}
                </div>
              );
            })
        )}
      </div>

      {/* Split/Journal Multi-line Entry Form Drawer Modal */}
      {isCreatorOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" id="split_creator_overlay">
          <div className="bg-white rounded-xl shadow-lg border border-slate-300 w-full max-w-4xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]" id="split_creator_content">
            <div className="p-4 bg-slate-950 text-white flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-2">
                <GitCompare className="w-5 h-5 text-emerald-450 animate-pulse" />
                <h3 className="text-xs font-black tracking-widest uppercase font-mono">
                  Direct Multi-Line Split Entry Creator
                </h3>
              </div>
              <button 
                onClick={() => setIsCreatorOpen(false)}
                className="text-slate-400 hover:text-white font-mono text-xs cursor-pointer"
                id="btn_close_split_upper"
              >
                Close (✖)
              </button>
            </div>

            {/* Split Creator Form Body */}
            <form onSubmit={handleSubmitLedgerEvent} className="p-5 overflow-y-auto space-y-4 flex-1" id="split_creator_form">
              {/* Top Meta info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-slate-100 pb-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Accounting Entry Date</label>
                  <input 
                    type="date"
                    required
                    value={entryDate}
                    onChange={e => setEntryDate(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded text-slate-800"
                    id="split_input_date"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Journal Entry description</label>
                  <input 
                    type="text"
                    required
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="e.g., Paycheck payroll deposit w/ tax splits"
                    className="w-full p-2 text-xs border border-slate-200 rounded text-slate-800"
                    id="split_input_desc"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Connected party (Person/Vendor)</label>
                  <select 
                    value={relatedPersonId}
                    onChange={e => setRelatedPersonId(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded bg-white text-slate-755"
                    id="split_input_person"
                  >
                    <option value="">-- Choose party --</option>
                    {people.map(p => (
                      <option key={p.id} value={p.id}>{p.display_name} ({p.type})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Individual Multi-Line Ledger list */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-850 uppercase font-mono">Journal Ledger Lines</h4>
                  <button 
                    type="button"
                    onClick={handleAddLine}
                    className="p-1 px-3 bg-slate-100 hover:bg-slate-900 hover:text-white transition-all text-[11px] font-bold text-slate-800 rounded flex items-center gap-1 cursor-pointer"
                    id="btn_split_add_line"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Insert Ledger Row
                  </button>
                </div>

                <div className="space-y-2 border border-slate-100 bg-slate-50/50 p-3 rounded-lg" id="split_draft_lines">
                  {draftLines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center bg-white p-2.5 rounded border border-gray-200 relative">
                      {/* Account code selector */}
                      <div className="md:col-span-3">
                        <label className="text-[8px] font-bold text-slate-400 uppercase font-mono block mb-1">Chart of Accounts</label>
                        <select 
                          value={line.accountId}
                          onChange={e => handleLineChange(idx, 'accountId', e.target.value)}
                          className="w-full p-1.5 text-xs text-slate-800 border border-slate-200 rounded bg-white"
                          id={`line_acct_${idx}`}
                        >
                          {accounts.map(a => (
                            <option key={a.id} value={a.id}>{a.name} ({a.account_type})</option>
                          ))}
                        </select>
                      </div>

                      {/* Category matcher */}
                      <div className="md:col-span-2">
                        <label className="text-[8px] font-bold text-slate-400 uppercase font-mono block mb-1">Group Category</label>
                        <select 
                          value={line.categoryId}
                          onChange={e => handleLineChange(idx, 'categoryId', e.target.value)}
                          className="w-full p-1.5 text-xs text-slate-705 border border-slate-200 rounded bg-white capitalize"
                          id={`line_cat_${idx}`}
                        >
                          <option value="">-- None --</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Debit amount */}
                      <div className="md:col-span-2">
                        <label className="text-[8px] font-bold text-emerald-700 uppercase font-mono block mb-1">Debit (+) Amount</label>
                        <input 
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.debitAmount}
                          placeholder="0.00"
                          onChange={e => handleLineChange(idx, 'debitAmount', e.target.value)}
                          className="w-full p-1.5 text-xs text-emerald-800 font-mono font-bold border border-slate-200 placeholder-slate-300 rounded"
                          id={`line_debit_${idx}`}
                        />
                      </div>

                      {/* Credit amount */}
                      <div className="md:col-span-2">
                        <label className="text-[8px] font-bold text-rose-700 uppercase font-mono block mb-1">Credit (-) Amount</label>
                        <input 
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.creditAmount}
                          placeholder="0.00"
                          onChange={e => handleLineChange(idx, 'creditAmount', e.target.value)}
                          className="w-full p-1.5 text-xs text-rose-800 font-mono font-semibold border border-slate-200 placeholder-slate-300 rounded"
                          id={`line_credit_${idx}`}
                        />
                      </div>

                      {/* Memo line details */}
                      <div className="md:col-span-2">
                        <label className="text-[8px] font-bold text-slate-404 uppercase font-mono block mb-1">Line Item memo</label>
                        <input 
                          type="text"
                          value={line.memo}
                          onChange={e => handleLineChange(idx, 'memo', e.target.value)}
                          placeholder="Specific split info"
                          className="w-full p-1.5 text-xs border border-slate-200 text-slate-700 rounded"
                          id={`line_memo_${idx}`}
                        />
                      </div>

                      {/* Delete row trigger */}
                      <div className="md:col-span-1 pt-4 md:pt-0 flex justify-end">
                        <button 
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Remove row"
                          id={`btn_split_remove_${idx}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Memo comments block */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">Combined Journal Entry Memo Notes</label>
                <textarea 
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                  placeholder="Detail notes about adjustment justifications, supporting contract indices..."
                  className="w-full p-2 text-xs border border-slate-200 rounded h-14 resize-none"
                  id="split_input_combo_memo"
                />
              </div>

              {/* Math ledger balance recap */}
              <div className="p-3 bg-slate-950 text-white rounded-lg gap-4 flex flex-col md:flex-row justify-between items-center text-xs font-mono" id="split_math_banner">
                <div className="space-y-1">
                  <p className="font-extrabold uppercase text-emerald-400 text-[10px]">General Double-Entry Ledger Equations</p>
                  <p className="text-slate-305">Every single debit value must correspond to a balancing credit value.</p>
                </div>
                <div className="flex gap-4 text-xs font-extrabold">
                  <div className="bg-emerald-950 p-[3px] px-3 border border-emerald-800 rounded">
                    Total Debits: {formatCurrency(draftLines.reduce((sum, l) => sum + (Number(l.debitAmount) || 0), 0))}
                  </div>
                  <div className="bg-rose-950 p-[3px] px-3 border border-rose-850 rounded">
                    Total Credits: {formatCurrency(draftLines.reduce((sum, l) => sum + (Number(l.creditAmount) || 0), 0))}
                  </div>
                </div>
              </div>

              {creatorError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2" id="split_creator_error">
                  <AlertCircle className="w-4 h-4 text-red-650 flex-shrink-0" />
                  <p className="font-semibold">{creatorError}</p>
                </div>
              )}

              {/* Submission Controls */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 text-xs flex-shrink-0">
                <button 
                  type="button"
                  onClick={() => setIsCreatorOpen(false)}
                  className="p-2 px-4 border border-slate-250 rounded hover:bg-slate-50 transition-colors font-semibold"
                  id="btn_split_cancel"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="p-2 px-5 bg-slate-900 hover:bg-slate-800 text-white transition-all rounded font-black cursor-pointer"
                  id="btn_split_submit"
                >
                  Verify Balance & File Post
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
