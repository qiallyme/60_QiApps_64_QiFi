import React, { useEffect, useMemo, useState } from 'react';
import { Camera, DollarSign, Eye, Loader2, Paperclip, Plus, ReceiptText, Trash2, Upload, Users } from 'lucide-react';
import { useQiStore } from '../store';
import { Attachment, ReceiptExtraction, Transaction, TransactionAllocationInput } from '../types';
import { qifinanceApi } from '../lib/qifinanceApi';
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
  kind: 'receipt' | 'evidence';
}

type UnifiedAttachmentItem =
  | { status: 'saved'; attachment: Attachment }
  | { status: 'pending'; attachment: PendingAttachment };

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
  const [categoryId, setCategoryId] = useState(transaction?.categoryId || categoryAccountId || 'suspense-uncategorized');
  const [counterparty, setCounterparty] = useState(transaction?.counterparty || '');
  const [newCounterpartyName, setNewCounterpartyName] = useState('');
  const [tagsText, setTagsText] = useState(transaction?.tags.join(', ') || '');
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const [processingAttachmentId, setProcessingAttachmentId] = useState<string | null>(null);
  const [receiptProposal, setReceiptProposal] = useState<ReceiptExtraction | null>(null);
  const [receiptProposalApplied, setReceiptProposalApplied] = useState(false);
  const [error, setError] = useState('');
  const [allocations, setAllocations] = useState<TransactionAllocationInput[]>([]);
  const [allocationsLoading, setAllocationsLoading] = useState(false);

  useEffect(() => {
    if (!sourceAccountId && financialAccounts[0]) setSourceAccountId(financialAccounts[0].id);
  }, [financialAccounts, sourceAccountId]);

  useEffect(() => {
    setDate(transaction?.date || today());
    setDirection((transaction?.amount || 0) < 0 ? 'out' : 'in');
    setAmount(transaction ? String(Math.abs(transaction.amount)) : '');
    setDescription(transaction?.description || '');
    setSourceAccountId(transaction?.sourceAccountId || financialAccounts[0]?.id || '');
    setCategoryId(transaction?.categoryId || categoryAccountId || 'suspense-uncategorized');
    setCounterparty(transaction?.counterparty || '');
    setNewCounterpartyName('');
    setTagsText(transaction?.tags.join(', ') || '');
    setPendingAttachments([]);
    setPreviewAttachment(null);
    setReceiptProposal(null);
    setReceiptProposalApplied(false);
    setError('');
  }, [transaction?.id, categoryAccountId]);

  useEffect(() => {
    let cancelled = false;
    setAllocations([]);
    if (!transaction?.id) return () => { cancelled = true; };
    setAllocationsLoading(true);
    void qifinanceApi.getTransactionAllocations(transaction.id)
      .then((rows) => {
        if (!cancelled) setAllocations(rows.map((row) => ({
          counterpartyId: row.counterparty_id || row.counterpartyId,
          amount: Number(row.amount),
          treatment: row.treatment,
          note: row.note || '',
        })));
      })
      .catch((reason) => { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Could not load transaction splits.'); })
      .finally(() => { if (!cancelled) setAllocationsLoading(false); });
    return () => { cancelled = true; };
  }, [transaction?.id]);

  const savedAttachments = useMemo(
    () => transaction ? attachments.filter((attachment) => attachment.transactionId === transaction.id) : [],
    [attachments, transaction],
  );
  const categoryAccounts = useMemo(
    () => accounts.filter((account) => !['asset', 'liability'].includes(account.type) || account.id === 'assets-loans-mom'),
    [accounts],
  );
  const attachmentItems = useMemo<UnifiedAttachmentItem[]>(() => [
    ...savedAttachments.map((attachment) => ({ status: 'saved' as const, attachment })),
    ...pendingAttachments.map((attachment) => ({ status: 'pending' as const, attachment })),
  ], [savedAttachments, pendingAttachments]);

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>, forcedKind?: PendingAttachment['kind']) => {
    const files = event.currentTarget.files;
    if (!files) return;
    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = () => setPendingAttachments((current) => [...current, {
        id: crypto.randomUUID(), fileName: file.name, fileType: file.type || 'application/octet-stream', dataUrl: String(reader.result),
        kind: forcedKind || (file.type.startsWith('image/') || file.type === 'application/pdf' ? 'receipt' : 'evidence'),
      }]);
      reader.readAsDataURL(file);
    });
    event.target.value = '';
  };

  const handleDeleteSavedAttachment = async (attachmentId: string) => {
    if (deletingAttachmentId) return;
    setDeletingAttachmentId(attachmentId);
    setError('');
    try {
      await deleteAttachment(attachmentId);
      if (previewAttachment?.id === attachmentId) setPreviewAttachment(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Attachment deletion failed.');
    } finally {
      setDeletingAttachmentId(null);
    }
  };

  const handleProcessReceipt = async (attachment: Attachment) => {
    if (processingAttachmentId) return;
    setProcessingAttachmentId(attachment.id);
    setError('');
    try {
      const result = await qifinanceApi.processReceipt(attachment.id);
      if (!result.parsedOcrJson) throw new Error('Receipt processing completed without extracted fields.');
      setReceiptProposal(result.parsedOcrJson);
      setReceiptProposalApplied(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Receipt processing failed. You can retry.');
    } finally {
      setProcessingAttachmentId(null);
    }
  };

  const applyReceiptProposal = () => {
    if (!receiptProposal) return;
    if (receiptProposal.merchantName?.value) {
      const merchant = receiptProposal.merchantName.value;
      if (counterparties.some((item) => item.name.toLowerCase() === merchant.toLowerCase())) setCounterparty(merchant);
      else { setCounterparty('__new__'); setNewCounterpartyName(merchant); }
    }
    if (receiptProposal.transactionDate?.value) setDate(receiptProposal.transactionDate.value);
    if (receiptProposal.total?.value && receiptProposal.total.value > 0) setAmount(String(receiptProposal.total.value));
    if (receiptProposal.categoryId?.value && accounts.some((account) => account.id === receiptProposal.categoryId?.value)) setCategoryId(receiptProposal.categoryId.value);
    if (receiptProposal.financialAccountId?.value && financialAccounts.some((account) => account.id === receiptProposal.financialAccountId?.value)) setSourceAccountId(receiptProposal.financialAccountId.value);
    setReceiptProposalApplied(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!date || !description.trim() || !amount || Number(amount) <= 0 || !sourceAccountId || !categoryId) {
      setError('Date, positive amount, description, financial account, and category are required.');
      return;
    }
    const allocatedTotal = allocations.reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0);
    if (allocations.some((allocation) => !allocation.counterpartyId || allocation.amount <= 0) || allocatedTotal > Number(amount) + 0.005) {
      setError('Every split needs a person and positive amount, and split amounts cannot exceed the transaction total.');
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
        saved = { ...transaction, ...values, categoryId };
      } else {
        saved = await addManualTransaction(values, categoryId);
      }
      if (!saved) throw new Error('The transaction was not saved.');
      await qifinanceApi.replaceTransactionAllocations(saved.id, allocations);
      for (const attachment of pendingAttachments) {
        await addAttachment(saved.id, attachment.fileName, attachment.fileType, attachment.dataUrl, attachment.kind === 'receipt' ? 'Receipt captured from transaction form' : 'Evidence uploaded from transaction form');
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
        <div className="flex items-center justify-between gap-3">
          <div><p className="flex items-center gap-2 text-xs font-semibold text-zinc-200"><Users size={14}/>Split with people</p><p className="text-[10px] text-zinc-500">Track a shared purchase, mark it as a gift, or add an IOU to what they owe you. No extra cash transaction is created.</p></div>
          <button type="button" onClick={() => setAllocations((current) => [...current, { counterpartyId: '', amount: 0, treatment: 'shared', note: '' }])} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-zinc-800 px-3 py-2 text-xs text-zinc-200"><Plus size={12}/>Add split</button>
        </div>
        {allocationsLoading && <p className="text-xs text-zinc-500">Loading saved splits…</p>}
        {allocations.map((allocation, index) => <div key={index} className="grid grid-cols-1 gap-2 rounded-lg border border-zinc-800 p-3 md:grid-cols-[1.3fr_.7fr_1fr_1.5fr_auto]">
          <select aria-label={`Split ${index + 1} counterparty`} value={allocation.counterpartyId} onChange={(event) => setAllocations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, counterpartyId: event.target.value } : item))} className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-200"><option value="">Choose person</option>{counterparties.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <input aria-label={`Split ${index + 1} amount`} type="number" min="0.01" step="0.01" value={allocation.amount || ''} onChange={(event) => setAllocations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, amount: Number(event.target.value) } : item))} placeholder="Amount" className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-200"/>
          <select aria-label={`Split ${index + 1} treatment`} value={allocation.treatment} onChange={(event) => setAllocations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, treatment: event.target.value as TransactionAllocationInput['treatment'] } : item))} className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-200"><option value="shared">Shared / track only</option><option value="iou">IOU — owes me</option><option value="gift">Gift — no debt</option></select>
          <input aria-label={`Split ${index + 1} note`} value={allocation.note} onChange={(event) => setAllocations((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, note: event.target.value } : item))} placeholder="What was their portion?" className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-2 text-xs text-zinc-200"/>
          <button type="button" aria-label={`Remove split ${index + 1}`} onClick={() => setAllocations((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded-lg px-2 text-zinc-500 hover:text-rose-400"><Trash2 size={14}/></button>
        </div>)}
        {allocations.length > 0 && <div className="flex justify-end text-[11px] text-zinc-400">Allocated: <span className="ml-1 font-mono text-zinc-200">${allocations.reduce((sum, item) => sum + Number(item.amount || 0), 0).toFixed(2)}</span> / ${Number(amount || 0).toFixed(2)}</div>}
      </div>
      <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-xs font-semibold text-zinc-200 flex items-center gap-2"><Paperclip size={14}/>Receipts & evidence</p><p className="text-[10px] text-zinc-500">Saved and pending files share one list; OCR suggestions always require confirmation.</p></div>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white cursor-pointer"><Camera size={13}/>Snap receipt<input type="file" accept="image/*" capture="environment" className="hidden" onChange={(event) => handleFiles(event, 'receipt')}/></label>
            <label className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-2 text-xs text-zinc-200 cursor-pointer"><Upload size={13}/>Add files<input type="file" accept="image/*,application/pdf,text/*" multiple className="hidden" onChange={(event) => handleFiles(event)}/></label>
          </div>
        </div>
        {attachmentItems.length === 0 && <div className="rounded-lg border border-dashed border-zinc-800 px-3 py-4 text-center text-[11px] text-zinc-500">No receipt or evidence attached.</div>}
        {attachmentItems.map((item) => {
          const isPending = item.status === 'pending';
          const attachment = item.attachment;
          const isReceipt = isPending ? attachment.kind === 'receipt' : attachment.notes.toLowerCase().includes('receipt');
          const deleting = !isPending && deletingAttachmentId === attachment.id;
          const processing = !isPending && processingAttachmentId === attachment.id;
          return <div key={`${item.status}-${attachment.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 px-3 py-2 text-xs">
            <span className="min-w-0 flex items-center gap-2 text-zinc-300">{isReceipt ? <ReceiptText size={13} className="shrink-0 text-emerald-400"/> : <Paperclip size={13} className="shrink-0 text-zinc-500"/>}<span className="truncate">{attachment.fileName}</span>{isPending && <span className="shrink-0 text-[10px] text-amber-400">uploads on save</span>}</span>
            <div className="flex shrink-0 items-center gap-2">
              {!isPending && isReceipt && attachment.fileType.startsWith('image/') && <button type="button" disabled={processing} onClick={() => void handleProcessReceipt(attachment)} className="rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300 disabled:opacity-50">{processing ? 'Processing...' : attachment.processingStatus === 'failed' ? 'Retry OCR' : 'Extract receipt'}</button>}
              {!isPending && <button type="button" aria-label={`Preview ${attachment.fileName}`} onClick={() => setPreviewAttachment(attachment)} className="text-zinc-400 hover:text-white"><Eye size={13}/></button>}
              <button type="button" disabled={deleting} aria-label={`Remove ${attachment.fileName}`} onClick={() => isPending ? setPendingAttachments((current) => current.filter((entry) => entry.id !== attachment.id)) : void handleDeleteSavedAttachment(attachment.id)} className="text-zinc-400 hover:text-rose-400 disabled:opacity-50">{deleting ? <Loader2 size={13} className="animate-spin"/> : <Trash2 size={13}/>}</button>
            </div>
          </div>;
        })}
      </div>
      {receiptProposal && <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
        <div><p className="text-sm font-semibold text-amber-200">Review extracted receipt</p><p className="text-[11px] text-zinc-400">{receiptProposalApplied ? 'Suggestions were applied to this form for review. Submit the form to save them.' : 'Nothing below changes the transaction until you apply it, and the transaction is not saved until you submit the form.'}</p></div>
        <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
          {[
            ['Merchant', receiptProposal.merchantName], ['Date', receiptProposal.transactionDate], ['Total', receiptProposal.total], ['Subtotal', receiptProposal.subtotal],
            ['Tax', receiptProposal.tax], ['Tip', receiptProposal.tip], ['Payment last 4', receiptProposal.paymentMethodLast4], ['Receipt #', receiptProposal.receiptNumber], ['Category', receiptProposal.categoryId],
          ].filter((entry) => entry[1]).map(([label, field]) => {
            const extracted = field as { value: string | number; confidence: number };
            return <div key={String(label)} className={`rounded-lg border p-2 ${extracted.confidence < 0.7 ? 'border-amber-500/40 bg-amber-500/10' : 'border-zinc-800 bg-zinc-950/50'}`}><span className="block text-[10px] text-zinc-500">{label} · {Math.round(extracted.confidence * 100)}%</span><span className="text-zinc-200">{String(extracted.value)}</span></div>;
          })}
        </div>
        <div className="flex justify-end gap-2"><button type="button" onClick={() => { setReceiptProposal(null); setReceiptProposalApplied(false); }} className="rounded-lg bg-zinc-800 px-3 py-2 text-xs text-zinc-300">Discard suggestions</button><button type="button" disabled={receiptProposalApplied} onClick={applyReceiptProposal} className="rounded-lg bg-amber-500 px-3 py-2 text-xs font-semibold text-zinc-950 disabled:opacity-50">{receiptProposalApplied ? 'Suggestions applied' : 'Apply suggestions to form'}</button></div>
      </div>}
      {error && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">{error}</div>}
      <div className="flex justify-end gap-3"><button type="button" onClick={onCancel} className="bg-zinc-800 px-4 py-2 rounded-xl text-sm text-zinc-300">Cancel</button><button disabled={saving} className="bg-emerald-600 disabled:opacity-50 px-5 py-2 rounded-xl text-sm font-semibold text-white">{saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Transaction'}</button></div>
    </form>
    <AttachmentPreviewModal attachment={previewAttachment} onClose={() => setPreviewAttachment(null)} titlePrefix="Transaction evidence"/>
  </>;
}
