/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, Bot, CheckCircle2, Loader2, Send, User } from 'lucide-react';
import { AssistantResponse, qifinanceApi } from '../lib/qifinanceApi';
import { useQiStore } from '../store';

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  response?: AssistantResponse;
  isError?: boolean;
}

function summarizeResponse(response: AssistantResponse): string {
  const lines = [response.message];
  const created = response.actions.filter((action) => action.status === 'created');
  const skipped = response.actions.filter((action) => action.status === 'skipped');
  const errors = response.actions.filter((action) => action.status === 'error');

  if (created.length > 0) {
    lines.push('', ...created.map((action) => `Created: ${action.message}`));
  }
  if (skipped.length > 0) {
    lines.push('', ...skipped.map((action) => `Skipped: ${action.message}`));
  }
  if (errors.length > 0) {
    lines.push('', ...errors.map((action) => `Needs attention: ${action.message}`));
  }
  if (response.warnings.length > 0) {
    lines.push('', ...response.warnings.map((warning) => `Note: ${warning}`));
  }

  return lines.join('\n');
}

export default function AssistantView() {
  const { refreshData } = useQiStore();
  const [draft, setDraft] = React.useState('');
  const [isSending, setIsSending] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([
    {
      id: 'assistant-ready',
      role: 'assistant',
      content: 'Ready.'
    }
  ]);
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isSending]);

  const submitMessage = async () => {
    const message = draft.trim();
    if (!message || isSending) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message
    };

    setMessages((current) => [...current, userMessage]);
    setDraft('');
    setIsSending(true);

    try {
      const response = await qifinanceApi.askAssistant(message);
      if (response.createdCount > 0) {
        await refreshData().catch((error) => console.warn('Failed to refresh QiFi state after assistant action:', error));
      }
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: summarizeResponse(response),
          response,
          isError: !response.ok
        }
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: error instanceof Error ? error.message : 'QiFi Assistant could not complete that request.',
          isError: true
        }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void submitMessage();
  };

  return (
    <div className="h-[calc(100vh-7rem)] min-h-[620px] flex flex-col text-zinc-200">
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center justify-center">
            <Bot size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white font-display">Qi Assistant</h2>
            <p className="text-xs text-zinc-500">Private finance operator</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1 space-y-4">
        {messages.map((message) => {
          const isUser = message.role === 'user';
          return (
            <div key={message.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
              {!isUser && (
                <div className={`mt-1 h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${
                  message.isError
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                    : 'bg-zinc-900 border-zinc-800 text-emerald-300'
                }`}>
                  {message.isError ? <AlertTriangle size={16} /> : <Bot size={16} />}
                </div>
              )}

              <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap border ${
                isUser
                  ? 'bg-emerald-500 text-zinc-950 border-emerald-400'
                  : message.isError
                    ? 'bg-rose-500/10 text-rose-100 border-rose-500/20'
                    : 'bg-zinc-900/70 text-zinc-200 border-zinc-800'
              }`}>
                {message.content}

                {message.response && message.response.actions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.response.actions.map((action, index) => (
                      <span
                        key={`${action.type}-${index}`}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${
                          action.status === 'created'
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : action.status === 'error'
                              ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                              : 'border-zinc-700 bg-zinc-950/60 text-zinc-400'
                        }`}
                      >
                        {action.status === 'created' && <CheckCircle2 size={12} />}
                        {action.type.replace('create_', '')}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {isUser && (
                <div className="mt-1 h-8 w-8 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 flex items-center justify-center shrink-0">
                  <User size={16} />
                </div>
              )}
            </div>
          );
        })}

        {isSending && (
          <div className="flex gap-3 justify-start">
            <div className="mt-1 h-8 w-8 rounded-lg bg-zinc-900 border border-zinc-800 text-emerald-300 flex items-center justify-center shrink-0">
              <Bot size={16} />
            </div>
            <div className="rounded-2xl px-4 py-3 text-sm bg-zinc-900/70 border border-zinc-800 text-zinc-400 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-emerald-300" />
              Working
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="mt-4 border-t border-zinc-800/80 pt-4">
        <div className="flex items-end gap-2 bg-zinc-900/70 border border-zinc-800 rounded-2xl p-2">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                void submitMessage();
              }
            }}
            rows={2}
            placeholder="Add Chase checking 9021 and savings 1002"
            className="flex-1 resize-none bg-transparent px-2 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
          />
          <button
            type="submit"
            disabled={isSending || !draft.trim()}
            className="h-10 w-10 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 flex items-center justify-center transition-colors"
            title="Send"
          >
            {isSending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
          </button>
        </div>
      </form>
    </div>
  );
}
