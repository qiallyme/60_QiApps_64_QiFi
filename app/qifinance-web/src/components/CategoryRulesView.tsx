/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useQiStore } from '../store';
import { Rule, Account } from '../types';
import { 
  Sparkles, Plus, Trash2, Edit2, Check, X, Search, 
  HelpCircle, Tag, ArrowRight, Bookmark, Sliders, AlertCircle 
} from 'lucide-react';

export default function CategoryRulesView() {
  const { rules, accounts, addRule, updateRule, deleteRule } = useQiStore();

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  
  // Rule creator form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [pattern, setPattern] = useState('');
  const [suggestedAccountId, setSuggestedAccountId] = useState('expenses-software');
  const [suggestedCounterparty, setSuggestedCounterparty] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [description, setDescription] = useState('');

  // Editing state
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editPattern, setEditPattern] = useState('');
  const [editAccountId, setEditAccountId] = useState('');
  const [editCounterparty, setEditCounterparty] = useState('');
  const [editTagsText, setEditTagsText] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Test description state
  const [testText, setTestText] = useState('');

  // Filter rules by search term
  const filteredRules = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return rules.filter(r => 
      r.pattern.toLowerCase().includes(term) ||
      r.suggestedCounterparty.toLowerCase().includes(term) ||
      r.description.toLowerCase().includes(term)
    );
  }, [rules, searchTerm]);

  // Accounts lookup lists
  const expenseAccounts = useMemo(() => {
    return accounts.filter(a => ['expense', 'revenue', 'clearing', 'suspense'].includes(a.type));
  }, [accounts]);

  // Test rule matching logic
  const testMatchResult = useMemo(() => {
    if (!testText.trim()) return null;
    const cleanTest = testText.toLowerCase();

    for (const rule of rules) {
      if (cleanTest.includes(rule.pattern.toLowerCase())) {
        const matchedAcc = accounts.find(a => a.id === rule.suggestedAccountId);
        return {
          matched: true,
          rule,
          accountName: matchedAcc ? `(${matchedAcc.code}) ${matchedAcc.name}` : 'Unknown Category'
        };
      }
    }
    return { matched: false };
  }, [testText, rules, accounts]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pattern.trim()) return;

    addRule({
      pattern: pattern.trim(),
      suggestedAccountId,
      suggestedCounterparty: suggestedCounterparty.trim(),
      suggestedTags: tagsText.split(',').map(t => t.trim().toLowerCase()).filter(Boolean),
      description: description.trim()
    });

    // Reset Form
    setPattern('');
    setSuggestedAccountId('expenses-software');
    setSuggestedCounterparty('');
    setTagsText('');
    setDescription('');
    setShowAddForm(false);
  };

  const handleStartEdit = (rule: Rule) => {
    setEditingRuleId(rule.id);
    setEditPattern(rule.pattern);
    setEditAccountId(rule.suggestedAccountId);
    setEditCounterparty(rule.suggestedCounterparty);
    setEditTagsText(rule.suggestedTags.join(', '));
    setEditDescription(rule.description);
  };

  const handleSaveEdit = (ruleId: string) => {
    if (!editPattern.trim()) return;

    updateRule({
      id: ruleId,
      pattern: editPattern.trim(),
      suggestedAccountId: editAccountId,
      suggestedCounterparty: editCounterparty.trim(),
      suggestedTags: editTagsText.split(',').map(t => t.trim().toLowerCase()).filter(Boolean),
      description: editDescription.trim()
    });

    setEditingRuleId(null);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white font-display flex items-center gap-2">
            <Sparkles className="text-emerald-400 animate-pulse" size={24} />
            Ingestion Category Rules
          </h2>
          <p className="text-xs text-zinc-400 font-sans mt-0.5">
            Configure transaction rules to automatically normalize names, assign categories, and tag transactions on bank statements import.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/30 text-white px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-lg self-start sm:self-center font-display"
        >
          {showAddForm ? 'Cancel Form' : 'New Ingestion Rule'}
        </button>
      </div>

      {/* NEW RULE FORM */}
      {showAddForm && (
        <form onSubmit={handleAddSubmit} className="bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800/80 shadow-2xl backdrop-blur-md space-y-4 animate-fadeIn">
          <h3 className="font-semibold text-zinc-100 text-sm flex items-center gap-1.5 font-display">
            <Bookmark className="text-emerald-400" size={16} />
            Configure Ingestion Matcher Rule
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">
                Description Pattern (Case-Insensitive)
              </label>
              <input 
                type="text" 
                placeholder="e.g. google, github, uber"
                value={pattern} 
                onChange={e => setPattern(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-700"
                required
              />
              <span className="text-[9px] text-zinc-500 block mt-1">Substring check against statement description</span>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Suggested Category / Account</label>
              <select
                value={suggestedAccountId}
                onChange={e => setSuggestedAccountId(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700"
              >
                {expenseAccounts.map(a => (
                  <option key={a.id} value={a.id}>({a.code}) {a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Suggested Counterparty / Merchant</label>
              <input 
                type="text" 
                placeholder="e.g. Google Cloud, Uber Inc"
                value={suggestedCounterparty} 
                onChange={e => setSuggestedCounterparty(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-700"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Suggested Tags (comma-separated)</label>
              <input 
                type="text" 
                placeholder="business, software, travel"
                value={tagsText} 
                onChange={e => setTagsText(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-700"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Rule Note / Description</label>
              <input 
                type="text" 
                placeholder="Primary purpose or trigger context..."
                value={description} 
                onChange={e => setDescription(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-700"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button 
              type="button" 
              onClick={() => setShowAddForm(false)}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-xs font-semibold shadow-sm cursor-pointer"
            >
              Save Ingestion Rule
            </button>
          </div>
        </form>
      )}

      {/* RULE TESTER SECTION */}
      <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/80 shadow-xl backdrop-blur-sm space-y-3.5">
        <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5 font-display">
          <Sliders size={16} className="text-emerald-400" />
          Category Rules Tester
        </h3>
        <p className="text-[11px] text-zinc-400">
          Paste a raw credit card or bank statement description memo below to test if any rule matches it.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <input 
            type="text" 
            placeholder="e.g. AMZN Mktp US*1A23B45, GITHUB SPONSORS DEV"
            value={testText}
            onChange={e => setTestText(e.target.value)}
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700"
          />
          {testText && (
            <button
              onClick={() => setTestText('')}
              className="bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all border border-zinc-800 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {testText.trim() && (
          <div className="animate-fadeIn mt-2">
            {testMatchResult?.matched ? (
              <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 rounded-xl flex items-start gap-2.5">
                <Check className="text-emerald-400 mt-0.5 shrink-0" size={16} />
                <div className="text-xs text-zinc-300">
                  <p className="font-semibold text-emerald-400">Match Found!</p>
                  <p className="mt-1">
                    Rule pattern <code className="bg-emerald-950/60 px-1 rounded text-white font-mono">"{testMatchResult.rule?.pattern}"</code> matches your input description.
                  </p>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono text-zinc-400 bg-zinc-950/40 p-2 rounded-lg border border-zinc-900">
                    <div>
                      <span className="text-zinc-500 block">Suggested Category:</span>
                      <span className="text-zinc-200 font-bold">{testMatchResult.accountName}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block">Suggested Merchant:</span>
                      <span className="text-zinc-200 font-bold">{testMatchResult.rule?.suggestedCounterparty || 'none'}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-950/20 border border-amber-900/30 rounded-xl flex items-start gap-2.5">
                <AlertCircle className="text-amber-500 mt-0.5 shrink-0" size={16} />
                <div className="text-xs text-zinc-300">
                  <p className="font-semibold text-amber-500">No Rule Matches</p>
                  <p className="mt-0.5">
                    This description will fallback to the default category (<span className="font-mono text-zinc-400">9999 Uncategorized Suspense</span>). Consider creating a new matcher rule above.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* RULES DISPLAY CONTAINER */}
      <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/80 shadow-xl backdrop-blur-sm space-y-4">
        
        {/* Search controls */}
        <div className="flex justify-between items-center border-b border-zinc-800/60 pb-3 gap-4">
          <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5 font-display">
            <Sliders size={16} className="text-zinc-400" />
            Configured Normalization Rules ({filteredRules.length})
          </h3>
          
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
            <input
              type="text"
              placeholder="Search patterns or merchants..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-700"
            />
          </div>
        </div>

        {/* Rules Cards List */}
        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
          {filteredRules.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 text-xs italic">
              No matching ingestion rules found.
            </div>
          ) : (
            filteredRules.map(rule => {
              const matchedCategory = expenseAccounts.find(a => a.id === rule.suggestedAccountId);
              const isEditing = editingRuleId === rule.id;

              return (
                <div 
                  key={rule.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isEditing 
                      ? 'bg-zinc-900 border-zinc-700 shadow-lg' 
                      : 'bg-zinc-950/60 border-zinc-800 hover:border-zinc-750'
                  }`}
                >
                  {isEditing ? (
                    /* EDITING LAYOUT */
                    <div className="space-y-4 animate-fadeIn">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[9px] font-bold text-zinc-500 uppercase mb-1">Pattern</label>
                          <input 
                            type="text"
                            value={editPattern}
                            onChange={e => setEditPattern(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-750"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-zinc-500 uppercase mb-1">Suggested Category</label>
                          <select
                            value={editAccountId}
                            onChange={e => setEditAccountId(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-750"
                          >
                            {expenseAccounts.map(a => (
                              <option key={a.id} value={a.id}>({a.code}) {a.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-zinc-500 uppercase mb-1">Suggested Merchant</label>
                          <input 
                            type="text"
                            value={editCounterparty}
                            onChange={e => setEditCounterparty(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-750"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] font-bold text-zinc-500 uppercase mb-1">Suggested Tags (comma-separated)</label>
                          <input 
                            type="text"
                            value={editTagsText}
                            onChange={e => setEditTagsText(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-750"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-zinc-500 uppercase mb-1">Description / Memo</label>
                          <input 
                            type="text"
                            value={editDescription}
                            onChange={e => setEditDescription(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-750"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1 border-t border-zinc-800/80 mt-1.5">
                        <button 
                          type="button"
                          onClick={() => setEditingRuleId(null)}
                          className="bg-zinc-800 hover:bg-zinc-750 text-zinc-300 px-3 py-1 rounded text-[11px] font-bold transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleSaveEdit(rule.id)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1 rounded text-[11px] font-bold transition-all shadow cursor-pointer"
                        >
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* PREVIEW LAYOUT */
                    <div className="flex items-start justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <code className="bg-zinc-800 text-zinc-200 border border-zinc-750 px-2 py-0.5 rounded text-[11px] font-mono font-bold">
                            "{rule.pattern}"
                          </code>
                          <ArrowRight className="text-zinc-500" size={12} />
                          <span className="text-xs font-semibold text-zinc-300">
                            {matchedCategory ? `(${matchedCategory.code}) ${matchedCategory.name}` : 'Unknown category'}
                          </span>
                          {rule.suggestedCounterparty && (
                            <span className="text-[10px] bg-emerald-950/20 text-emerald-400 border border-emerald-900/30 px-2 py-0.5 rounded-full font-bold">
                              Assigns Merchant: {rule.suggestedCounterparty}
                            </span>
                          )}
                        </div>

                        {rule.description && (
                          <p className="text-xs text-zinc-400 leading-normal">{rule.description}</p>
                        )}

                        {/* Tags list */}
                        {rule.suggestedTags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {rule.suggestedTags.map(tag => (
                              <span key={tag} className="text-[9px] bg-zinc-900 text-zinc-500 px-2 py-0.5 rounded border border-zinc-800">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleStartEdit(rule)}
                          className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg cursor-pointer transition-all border border-transparent hover:border-zinc-800"
                          title="Edit Ingestion Rule"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => deleteRule(rule.id)}
                          className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-zinc-900 rounded-lg cursor-pointer transition-all border border-transparent hover:border-zinc-800"
                          title="Delete Rule"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
