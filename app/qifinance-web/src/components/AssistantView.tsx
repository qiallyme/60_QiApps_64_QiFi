import React from 'react';
import { AlertTriangle, Bot, CheckCircle2, Loader2, Send, ShieldCheck, User } from 'lucide-react';
import { AssistantResponse, qifinanceApi } from '../lib/qifinanceApi';
import { useQiStore } from '../store';

interface ChatMessage { id: string; role: 'assistant' | 'user'; content: string; plan?: AssistantResponse; isError?: boolean }

export default function AssistantView({ pageContext }: { pageContext?: string }) {
  const { refreshData } = useQiStore();
  const [draft, setDraft] = React.useState('');
  const [threadId, setThreadId] = React.useState<string>();
  const [busy, setBusy] = React.useState(false);
  const [selected, setSelected] = React.useState<Record<string, boolean>>({});
  const [messages, setMessages] = React.useState<ChatMessage[]>([{ id: 'ready', role: 'assistant', content: 'Ready. Tell me what happened and I’ll inspect QiFi, build a plan, and ask for approval before changing anything.' }]);
  const endRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages, busy]);

  const addPlan = (plan: AssistantResponse) => {
    setThreadId(plan.threadId);
    setSelected((current) => ({ ...current, ...Object.fromEntries(plan.steps.filter((step) => step.status === 'proposed').map((step) => [step.id, true])) }));
    const details = [...plan.questions.map((q) => `Question: ${q}`), ...plan.warnings.map((w) => `Note: ${w}`)];
    setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: 'assistant', content: [plan.summary, ...details].join('\n\n'), plan, isError: !plan.ok }]);
  };

  const submit = async () => {
    const message = draft.trim();
    if (!message || busy) return;
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: 'user', content: message }]);
    setDraft(''); setBusy(true);
    try { addPlan(await qifinanceApi.askAssistant(pageContext ? `[Current screen: ${pageContext}] ${message}` : message, threadId)); }
    catch (error) { setMessages((current) => [...current, { id: `error-${Date.now()}`, role: 'assistant', content: error instanceof Error ? error.message : 'Qi Assistant failed.', isError: true }]); }
    finally { setBusy(false); }
  };

  const execute = async (plan: AssistantResponse) => {
    const stepIds = plan.steps.filter((step) => selected[step.id] && step.status === 'proposed').map((step) => step.id);
    if (!stepIds.length || busy) return;
    setBusy(true);
    try {
      const result = await qifinanceApi.executeAssistantPlan(plan.planId, stepIds);
      await refreshData();
      addPlan(result);
    } catch (error) { setMessages((current) => [...current, { id: `error-${Date.now()}`, role: 'assistant', content: error instanceof Error ? error.message : 'Execution failed.', isError: true }]); }
    finally { setBusy(false); }
  };

  return <div className="h-[calc(100vh-7rem)] min-h-[620px] flex flex-col text-zinc-200">
    <div className="flex items-center gap-3 border-b border-zinc-800/80 pb-4 mb-4"><div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center justify-center"><Bot size={20}/></div><div><h2 className="text-lg font-bold text-white font-display">Qi Assistant</h2><p className="text-xs text-zinc-500">Private finance operator · approval required</p></div></div>
    <div className="flex-1 overflow-y-auto pr-1 space-y-4">{messages.map((message) => <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
      {message.role === 'assistant' && <div className={`mt-1 h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${message.isError ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' : 'bg-zinc-900 border-zinc-800 text-emerald-300'}`}>{message.isError ? <AlertTriangle size={16}/> : <Bot size={16}/>}</div>}
      <div className={`max-w-[86%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap border ${message.role === 'user' ? 'bg-emerald-500 text-zinc-950 border-emerald-400' : message.isError ? 'bg-rose-500/10 border-rose-500/20' : 'bg-zinc-900/70 border-zinc-800'}`}>
        {message.content}
        {message.plan?.steps.length ? <div className="mt-4 space-y-2">{message.plan.steps.map((step) => <label key={step.id} className="flex gap-3 rounded-xl border border-zinc-700 bg-zinc-950/60 p-3 cursor-pointer">
          <input type="checkbox" className="mt-1 accent-emerald-500" disabled={step.status !== 'proposed'} checked={step.status === 'proposed' ? Boolean(selected[step.id]) : step.status === 'executed'} onChange={(event) => setSelected((current) => ({ ...current, [step.id]: event.target.checked }))}/>
          <span className="min-w-0"><span className="flex items-center gap-2 font-semibold text-zinc-100"><span>{step.description}</span><span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">{step.type.replaceAll('_', ' ')}</span>{step.status === 'executed' && <CheckCircle2 size={14} className="text-emerald-400"/>}</span><span className="mt-1 block text-xs text-zinc-500 break-words">{JSON.stringify(step.payload)}</span>{step.error && <span className="mt-1 block text-xs text-rose-300">{step.error}</span>}</span>
        </label>)}
        {message.plan.status === 'pending_approval' && <button onClick={() => void execute(message.plan!)} disabled={busy || !message.plan.steps.some((step) => step.status === 'proposed' && selected[step.id])} className="mt-2 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-zinc-950 disabled:bg-zinc-700"><ShieldCheck size={16}/>Approve selected & execute</button>}</div> : null}
      </div>{message.role === 'user' && <div className="mt-1 h-8 w-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center"><User size={16}/></div>}
    </div>)}{busy && <div className="flex items-center gap-2 text-sm text-zinc-500"><Loader2 size={14} className="animate-spin text-emerald-300"/>Qi is inspecting context and planning…</div>}<div ref={endRef}/></div>
    <form onSubmit={(event) => { event.preventDefault(); void submit(); }} className="mt-4 border-t border-zinc-800/80 pt-4"><div className="flex items-end gap-2 bg-zinc-900/70 border border-zinc-800 rounded-2xl p-2"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submit(); } }} rows={2} placeholder={threadId ? 'Answer Qi or add more context…' : 'Describe a transaction, transfer, account, or finance task…'} className="flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-zinc-600"/><button disabled={busy || !draft.trim()} className="h-10 w-10 rounded-xl bg-emerald-500 disabled:bg-zinc-800 flex items-center justify-center text-zinc-950"><Send size={17}/></button></div></form>
  </div>;
}
