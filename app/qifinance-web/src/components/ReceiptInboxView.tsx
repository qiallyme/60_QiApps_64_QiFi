import React, { useMemo, useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, FileUp, Loader2, ReceiptText, RefreshCw, Trash2 } from 'lucide-react';
import { useQiStore } from '../store';
import { Attachment, ReceiptExtraction, Transaction } from '../types';
import { qifinanceApi } from '../lib/qifinanceApi';
import { isAmbiguousReceiptMatch, rankReceiptTransactionMatches } from '../lib/receiptMatching';
import TransactionForm from './TransactionForm';

const INBOX_NOTE = 'Receipt inbox upload';

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function proposalFrom(extraction: ReceiptExtraction): Partial<Transaction> {
  const merchant = extraction.merchantName?.value || '';
  const detail = [
    extraction.receiptNumber?.value && `receipt ${extraction.receiptNumber.value}`,
    extraction.subtotal?.value != null && `subtotal $${extraction.subtotal.value.toFixed(2)}`,
    extraction.tax?.value != null && `tax $${extraction.tax.value.toFixed(2)}`,
    extraction.tip?.value != null && `tip $${extraction.tip.value.toFixed(2)}`,
    extraction.paymentMethodLast4?.value && `payment ••••${extraction.paymentMethodLast4.value}`,
  ].filter(Boolean).join(' · ');
  return {
    date: extraction.transactionDate?.value,
    amount: extraction.total?.value ? -Math.abs(extraction.total.value) : undefined,
    description: [merchant || 'Receipt purchase', detail].filter(Boolean).join(' — '),
    counterparty: merchant,
    categoryId: extraction.categoryId?.value,
    sourceAccountId: extraction.financialAccountId?.value,
    tags: ['receipt-review'],
  };
}

export default function ReceiptInboxView() {
  const { attachments, transactions, counterparties, accounts, refreshData } = useQiStore();
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [reviewing, setReviewing] = useState<Attachment | null>(null);
  const [error, setError] = useState('');
  const inbox = useMemo(() => attachments.filter((item) => !item.transactionId && item.notes.startsWith(INBOX_NOTE)).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)), [attachments]);

  const withBusy = async (ids: string[], work: () => Promise<void>) => {
    setBusyIds((current) => new Set([...current, ...ids])); setError('');
    try { await work(); await refreshData(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Receipt action failed.'); }
    finally { setBusyIds((current) => new Set([...current].filter((id) => !ids.includes(id)))); }
  };

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = event.currentTarget.files ? Array.from(event.currentTarget.files) : []; event.currentTarget.value = '';
    if (!files.length) return;
    setUploading(true); setError('');
    try {
      for (const file of files) await qifinanceApi.createAttachment({ fileName: file.name, fileType: file.type || 'application/octet-stream', dataUrl: await readFile(file), uploadedAt: new Date().toISOString(), notes: INBOX_NOTE });
      await refreshData();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Batch upload failed.'); }
    finally { setUploading(false); }
  };

  const process = (items: Attachment[]) => withBusy(items.map((item) => item.id), async () => {
    const results = await Promise.allSettled(items.map((item) => qifinanceApi.processReceipt(item.id)));
    const failures = results.filter((result) => result.status === 'rejected');
    if (failures.length) throw new Error(`${failures.length} of ${items.length} receipts could not be processed. Successful receipts were preserved; retry failed items.`);
  });

  const attachMatch = (attachment: Attachment, transaction: Transaction) => withBusy([attachment.id], async () => {
    await qifinanceApi.updateAttachment(attachment.id, { transactionId: transaction.id, notes: `${INBOX_NOTE} · matched and approved` });
  });

  const remove = (attachment: Attachment) => withBusy([attachment.id], async () => { await qifinanceApi.deleteAttachment(attachment.id); });
  const processable = inbox.filter((item) => item.fileType.startsWith('image/') && item.processingStatus !== 'completed');

  return <div className="space-y-5">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-xl font-bold text-white">Receipt Inbox</h1><p className="mt-1 max-w-2xl text-xs text-zinc-400">Upload a batch, let AI extract draft details, then match or approve each receipt. Nothing creates or changes a transaction without your confirmation.</p></div><div className="flex flex-wrap gap-2"><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white"><Camera size={15}/>Camera<input className="hidden" type="file" accept="image/*" capture="environment" onChange={upload}/></label><label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-200"><FileUp size={15}/>{uploading ? 'Uploading…' : 'Upload batch'}<input className="hidden" type="file" accept="image/*,application/pdf" multiple disabled={uploading} onChange={upload}/></label></div></header>
    <div className="grid grid-cols-3 gap-3"><div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3"><p className="text-[10px] uppercase text-zinc-500">Inbox</p><p className="text-2xl font-bold text-white">{inbox.length}</p></div><div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3"><p className="text-[10px] uppercase text-zinc-500">Ready to review</p><p className="text-2xl font-bold text-emerald-400">{inbox.filter((i) => i.processingStatus === 'completed').length}</p></div><div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3"><p className="text-[10px] uppercase text-zinc-500">Needs processing</p><p className="text-2xl font-bold text-amber-400">{processable.length}</p></div></div>
    {processable.length > 0 && <div className="flex justify-end"><button disabled={busyIds.size > 0} onClick={() => void process(processable)} className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-zinc-950 disabled:opacity-50"><RefreshCw size={14}/>Process all images</button></div>}
    {error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</div>}
    {inbox.length === 0 && <div className="rounded-2xl border border-dashed border-zinc-800 p-10 text-center text-sm text-zinc-500"><ReceiptText className="mx-auto mb-3"/>Your receipt inbox is empty.</div>}
    <div className="grid gap-4 lg:grid-cols-2">{inbox.map((attachment) => {
      const extraction = attachment.parsedOcrJson;
      const matches = extraction ? rankReceiptTransactionMatches(extraction, transactions) : [];
      const ambiguous = isAmbiguousReceiptMatch(matches);
      const missingMerchant = extraction?.merchantName?.value && !counterparties.some((item) => item.name.toLowerCase() === extraction.merchantName?.value.toLowerCase());
      const missingCategory = extraction?.categoryId?.value && !accounts.some((item) => item.id === extraction.categoryId?.value);
      const busy = busyIds.has(attachment.id);
      return <article key={attachment.id} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-zinc-100">{attachment.fileName}</p><p className="text-[10px] text-zinc-500">{new Date(attachment.uploadedAt).toLocaleString()}</p></div><span className={`rounded-full px-2 py-1 text-[10px] ${attachment.processingStatus === 'completed' ? 'bg-emerald-500/10 text-emerald-300' : attachment.processingStatus === 'failed' ? 'bg-rose-500/10 text-rose-300' : 'bg-amber-500/10 text-amber-300'}`}>{attachment.processingStatus || 'pending'}</span></div>
        {extraction && <><div className="grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-zinc-950 p-2"><span className="block text-[10px] text-zinc-500">Merchant</span>{extraction.merchantName?.value || 'Not found'}</div><div className="rounded-lg bg-zinc-950 p-2"><span className="block text-[10px] text-zinc-500">Total / date</span>${extraction.total?.value?.toFixed(2) || '—'} · {extraction.transactionDate?.value || '—'}</div></div>{(missingMerchant || missingCategory) && <div className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-[10px] text-amber-200"><AlertTriangle size={13} className="shrink-0"/><span>{missingMerchant && `Missing counterparty “${extraction.merchantName?.value}”. `}{missingCategory && `Suggested category “${extraction.categoryId?.value}” does not exist. `}Review lets you create/select the right list item; none is added automatically.</span></div>}
          {matches[0] && <div className="rounded-lg border border-zinc-800 p-2"><p className="mb-2 text-[10px] text-zinc-500">{ambiguous ? 'Possible duplicates — choose carefully' : 'Best existing transaction match'}</p><div className="flex items-center justify-between gap-2"><span className="text-xs text-zinc-300">{matches[0].transaction.date} · {matches[0].transaction.description} · ${Math.abs(matches[0].transaction.amount).toFixed(2)} ({Math.round(matches[0].score * 100)}%)</span><button disabled={busy || ambiguous} onClick={() => void attachMatch(attachment, matches[0].transaction)} className="shrink-0 rounded-lg bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-300 disabled:opacity-40">Match</button></div></div>}</>}
        <div className="flex flex-wrap justify-end gap-2"><button disabled={busy} onClick={() => void remove(attachment)} className="rounded-lg bg-zinc-800 p-2 text-zinc-400 hover:text-rose-300"><Trash2 size={14}/></button>{attachment.fileType.startsWith('image/') && attachment.processingStatus !== 'completed' && <button disabled={busy} onClick={() => void process([attachment])} className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">{attachment.processingStatus === 'failed' ? 'Retry OCR' : 'Extract details'}</button>}{extraction && <button disabled={busy} onClick={() => setReviewing(attachment)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"><CheckCircle2 size={13}/>Review new draft</button>}</div>
        {busy && <div className="flex items-center gap-2 text-[10px] text-zinc-500"><Loader2 className="animate-spin" size={12}/>Working…</div>}
      </article>;
    })}</div>
    {reviewing?.parsedOcrJson && <div className="fixed inset-0 z-[90] overflow-y-auto bg-zinc-950/85 p-3 backdrop-blur-sm sm:p-8"><div className="mx-auto max-w-5xl"><TransactionForm initialValues={proposalFrom(reviewing.parsedOcrJson)} onCancel={() => setReviewing(null)} onSaved={async (transaction) => { await qifinanceApi.updateAttachment(reviewing.id, { transactionId: transaction.id, notes: `${INBOX_NOTE} · draft reviewed and approved` }); await refreshData(); setReviewing(null); }}/></div></div>}
  </div>;
}
