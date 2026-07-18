import React, { useEffect, useMemo, useState } from 'react';
import { DollarSign, Eye, Paperclip, Trash2, Upload } from 'lucide-react';
import { useQiStore } from '../store';
import { Attachment, Transaction } from '../types';
import AttachmentPreviewModal from './AttachmentPreviewModal';
import SearchableAccountSelect from './SearchableAccountSelect';

export interface TransactionFormProps {
  transaction?: Transaction | null;
  categoryAccountId?: string;
  onCancel: () => void;
  onSaved?: (transaction: Transaction) => void;
}

interface PendingAttachment {
  id: string;
  fileName: string;
  fileType: string;
  dataUrl: string;
}

const today = () => new Date().toISOString().split('T')[0];

export default function TransactionForm({ transaction, categoryAccountId, onCancel, onSaved }: TransactionFormProps) {
  const {
    accounts, financialAccounts, counterparties, attachments,
    addCounterparty, addManualTransaction, updateTransaction,
    addAttachment, deleteAttachment,
  } = useQiStore();
  const isEdit = Boolean(transaction);
  const [date, setDate] = useState(transaction?.date || today());
  const [direction, setDirection] = useState<'out' | 'in'>((transaction?.amount || 0) < 0 ? 'out' : 'in');
  const [amount, setAmount] = useState(transaction ? String(Math.abs(transaction.amount)) : '');
  const [description, setDescription] = useState(transaction?.description || '');
  const [sourceAccountId, setSourceAccountId] = useState(transaction?.sourceAccountId || financialAccounts[0]?.id || '');
  const [categoryId, setCategoryId] = useState(categoryAccountId || 'suspense-uncategorized');
  const [counterparty, setCounterparty] = useState(transaction?.counterparty || '');
  const [newCounterpartyName, setNewCounterpartyName] = useState('');
  const [tagsText, setTagsText] = useState(transaction?.tags.join(', ') || '');
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sourceAccountId && financialAccounts[0]) setSourceAccountId(financialAccounts[0].id);
  }, [financialAccounts, sourceAccountId]);

  const savedAttachments = useMemo(
    () => transaction ? attachments.filter((attachment) => attachment.transactionId === transaction.id) : [],
    [attachments, transaction],
  );
  const categoryAccounts = useMemo(
    () => accounts.filter((account) => !['asset', 'liability'].includes(account.type) || account.id === 'assets-loans-mom'),
    [accounts],
  );

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.currentTarget.files;
    if (!files) return;
    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = () => setPendingAttachments((current) => [...current, {
        id: crypto.randomUUID(), fileName: file.name, fileType: file.type || 'application/octet-stream', dataUrl: String(reader.result),
      }]);
      reader.readAsDataURL(file);
    });
    event.target.value = '';
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!date || !description.trim() || !amount || Number(amount) <= 0 || !sourceAccountId || !categoryId) {
      setError('Date, positive amount, description, financial account, and category are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      let resolvedCounterparty = counterparty;
      if (counterparty === '__new__') {
        resolvedCounterparty = newCounterpartyName.trim();
        if (!resolvedCounterparty) throw new Error('Enter a name for the new counterparty.');
        await addCounterparty({ name: resolvedCounterparty, description: 'Created from transaction form', tags: [], isBusiness: true, relationshipType: 'Other' });
      }
      const signedAmount = direction === 'out' ? -Math.abs(Number(amount)) : Math.abs(Number(amount));
      const values = {
        date,
        description: description.trim(),
        rawDescription: transaction?.rawDescription || `MANUAL ENTRY: ${description.trim()}`,
        amount: signedAmount,
        sourceAccountId,
        tags: tagsText.split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean),
        counterparty: resolvedCounterparty || 'Cash/Adjustment',
        reconciliationId: transaction?.reconciliationId,
        importBatchId: transaction?.importBatchId,
      };
      let saved: Transaction | null;
      if (transaction) {
        await updateTransaction(transaction.id, values, categoryId);
        saved = { ...transaction, ...values };
      } else {
        saved = await addManualTransaction(values, categoryId);
      }
      if (!saved) throw new Error('The transaction was not saved.');
      for (const attachment of pendingAttachments) {
        await addAttachment(saved.id, attachment.fileName, attachment.fileType, attachment.dataUrl, 'Uploaded from transaction form');
      }
      localStorage.removeItem('qifi_draft_ledger');
      onSaved?.(saved);
      onCancel();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Transaction save failed.');
    } finally {
      setSaving(false);
    }
  };

  return <>
    <form onSubmit={handleSubmit} className="bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800/80 shadow-2xl backdrop-blur-md space-y-4 animate-fadeIn">
      <h3 className="font-semibold text-zinc-100 text-base flex items-center gap-2"><DollarSign className="text-emerald-400" size={18}/>{isEdit ? 'Edit Transaction' : 'Create Transaction'}</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <label className="text-xs font-semibold text-zinc-400">Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100" required/></label>
        <label className="text-xs font-semibold text-zinc-400">Direction<select value={direction} onChange={(e) => setDirection(e.target.value as 'out'|'in')} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100"><option value="out">Money Out / Expense</option><option value="in">Money In / Income</option></select></label>
        <label className="text-xs font-semibold text-zinc-400">Amount<input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100" required/></label>
        <label className="text-xs font-semibold text-zinc-400">Merchant / Person<select value={counterparty} onChange={(e) => setCounterparty(e.target.value)} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100"><option value="">Select counterparty (optional)</option>{counterparties.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}<option value="__new__">+ Add missing counterparty</option></select>{counterparty === '__new__' && <input autoFocus value={newCounterpartyName} onChange={(e) => setNewCounterpartyName(e.target.value)} placeholder="New counterparty name" className="mt-2 w-full bg-zinc-950 border border-emerald-500/40 rounded-xl px-3 py-2 text-sm text-zinc-100"/>}</label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <label className="md:col-span-2 text-xs font-semibold text-zinc-400">Description / Memo<input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100" required/></label>
        <label className="text-xs font-semibold text-zinc-400">Tags<input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="mom, business, tax" className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100"/></label>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <label className="text-xs font-semibold text-zinc-400">Bank Account / Card<select value={sourceAccountId} onChange={(e) => setSourceAccountId(e.target.value)} className="mt-1 w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100"><option value="">Select account</option>{financialAccounts.map((account) => <option key={account.id} value={account.id}>{account.institution ? `(${account.institution}) ` : ''}{account.name}</option>)}</select></label>
        <div><label className="block text-xs font-semibold text-zinc-400 mb-1">Category</label><SearchableAccountSelect value={categoryId} onChange={setCategoryId} accounts={categoryAccounts} placeholder="Search category by code or name"/></div>
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-zinc-200 flex items-center gap-2"><Paperclip size={14}/>Attachments</p><p className="text-[10px] text-zinc-500">Receipts and evidence are preserved in create and edit modes.</p></div><label className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-2 text-xs text-zinc-200 cursor-pointer"><Upload size={13}/>Add files<input type="file" multiple className="hidden" onChange={handleFiles}/></label></div>
        {[...savedAttachments.map((item) => ({ ...item, pending: false })), ...pendingAttachments.map((item) => ({ ...item, pending: true }))].map((item) => <div key={item.id} className="flex items-center justify-between rounded-lg border border-zinc-800 px-3 py-2 text-xs"><span className="truncate text-zinc-300">{item.fileName}{item.pending ? ' (uploads on save)' : ''}</span><div className="flex gap-2">{!item.pending && <button type="button" onClick={() => setPreviewAttachment(item as Attachment)} className="text-zinc-400 hover:text-white"><Eye size={13}/></button>}<button type="button" onClick={() => item.pending ? setPendingAttachments((current) => current.filter((entry) => entry.id !== item.id)) : deleteAttachment(item.id)} className="text-zinc-400 hover:text-rose-400"><Trash2 size={13}/></button></div></div>)}
      </div>
      {error && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</div>}
      <div className="flex justify-end gap-3"><button type="button" onClick={onCancel} className="bg-zinc-800 px-4 py-2 rounded-xl text-sm text-zinc-300">Cancel</button><button disabled={saving} className="bg-emerald-600 disabled:opacity-50 px-5 py-2 rounded-xl text-sm font-semibold text-white">{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Transaction'}</button></div>
    </form>
    <AttachmentPreviewModal attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} titlePrefix="Transaction evidence"/>
  </>;
}
