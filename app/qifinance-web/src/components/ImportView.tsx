/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useQiStore } from '../store';
import SearchableAccountSelect from './SearchableAccountSelect';
import { 
  Upload, Tag, Clipboard, ListFilter, Trash2, CheckCircle, 
  Settings, HelpCircle, FileText, ArrowRight, Plus, Eye,
  Check, X, AlertTriangle, Sparkles, AlertCircle, Info, Layers
} from 'lucide-react';

export default function ImportView() {
  const { 
    importBatches, 
    financialAccounts,
    accounts, 
    rules, 
    addRule, 
    deleteRule, 
    importCSVData,
    rawRows,
    addCounterparty,
    addAccount,
    counterparties,
    updateRawRow
  } = useQiStore();

  // Ingestion Inbound State
  const [targetAccountId, setTargetAccountId] = useState('fa-square-checking');
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('manual_copy_paste.csv');
  const [dragActive, setDragActive] = useState(false);

  // Column Mapping State
  const [parsedLines, setParsedLines] = useState<string[][]>([]);
  const [columnMappings, setColumnMappings] = useState<Record<number, string[]>>({});
  const [hasHeaders, setHasHeaders] = useState(true);
  const [showMappingStep, setShowMappingStep] = useState(false);
  const [amountMode, setAmountMode] = useState<'single' | 'separate'>('single');

  const handleAmountModeChange = (mode: 'single' | 'separate') => {
    setAmountMode(mode);
    if (mode === 'single') {
      setColumnMappings(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(key => {
          const colIdx = Number(key);
          next[colIdx] = (next[colIdx] || []).filter(f => f !== 'inflow_amount');
        });
        return next;
      });
    }
  };

  // Missing Values Step State
  const [showMissingStep, setShowMissingStep] = useState(false);
  const [missingCPList, setMissingCPList] = useState<{ name: string; checked: boolean; isBusiness: boolean }[]>([]);
  const [missingCatList, setMissingCatList] = useState<{ name: string; checked: boolean; type: string; code: string }[]>([]);
  const [pendingRowsForResolution, setPendingRowsForResolution] = useState<any[]>([]);

  // Rule Creator form
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [newRulePattern, setNewRulePattern] = useState('');
  const [newRuleCat, setNewRuleCat] = useState('expenses-software');
  const [newRuleTags, setNewRuleTags] = useState('');
  const [newRuleCounterparty, setNewRuleCounterparty] = useState('');
  const [newRuleMemo, setNewRuleMemo] = useState('');

  // State-based rule application prompt
  const [ruleApplyPrompt, setRuleApplyPrompt] = useState<{
    pattern: string;
    suggestedAccountId: string;
    suggestedTags: string[];
    suggestedCounterparty: string;
    matchingRowIds: string[];
  } | null>(null);

  const financialAccountOptions = useMemo(() => financialAccounts.map(account => ({
    id: account.id,
    code: account.accountMask || account.accountKind,
    name: account.name,
    type: ['credit_card', 'loan'].includes(account.accountKind) ? 'liability' as const : 'asset' as const,
    description: account.institution || '',
    isActive: account.isActive
  })), [financialAccounts]);

  // Target fields definition - dynamically computed based on amountMode
  const targetFields = useMemo(() => {
    const baseFields = [
      { id: 'date', label: 'Date', required: true, desc: 'Transaction date' },
      { id: 'description', label: 'Description', required: true, desc: 'Primary description or merchant text' },
    ];
    
    if (amountMode === 'single') {
      baseFields.push({ 
        id: 'amount', 
        label: 'Amount (Single Column)', 
        required: true, 
        desc: 'Single column containing amounts (Positive is Inflow/Refund, Negative is Outflow/Charge)' 
      });
    } else {
      baseFields.push(
        { 
          id: 'amount', 
          label: 'Outflow (Debit)', 
          required: true, 
          desc: 'Column representing outflows/charges (usually positive numbers)' 
        },
        { 
          id: 'inflow_amount', 
          label: 'Inflow (Credit)', 
          required: true, 
          desc: 'Column representing inflows/credits/deposits' 
        }
      );
    }

    return [
      ...baseFields,
      { id: 'counterparty', label: 'Counterparty', required: false, desc: 'Merchant name or client recipient' },
      { id: 'accountId', label: 'Ledger Account', required: false, desc: 'Existing Chart of Accounts code or name' },
      { id: 'tags', label: 'Tags', required: false, desc: 'Comma-separated labels or tags' },
      { id: 'memo', label: 'Memo', required: false, desc: 'Additional custom text comment' },
    ];
  }, [amountMode]);

  // Let column map to multiple options (Free mapping style!)
  const toggleMapping = (colIdx: number, fieldId: string) => {
    setColumnMappings(prev => {
      const currentFields = prev[colIdx] || [];
      let nextFields: string[];
      if (currentFields.includes(fieldId)) {
        nextFields = currentFields.filter(f => f !== fieldId);
      } else {
        nextFields = [...currentFields, fieldId];
      }

      return {
        ...prev,
        [colIdx]: nextFields
      };
    });
  };

  const resetImportState = () => {
    setRawText('');
    setParsedLines([]);
    setShowMappingStep(false);
    setShowMissingStep(false);
    setMissingCPList([]);
    setMissingCatList([]);
    setPendingRowsForResolution([]);
  };

  // Sample templates to load for quick user testing
  const loadChaseCCSample = () => {
    setFileName('Chase_CC_Sapphire_June.csv');
    const csvText = 
      `Transaction Date,Post Date,Description,Category,Type,Amount,Memo\n` +
      `06/25/2026,06/26/2026,GITHUB SPONSOR GITHUB.CO,Shopping,Sale,-10.00,\n` +
      `06/26/2026,06/26/2026,WHOLEFOODS 1032 MAIN ST,Groceries,Sale,-65.40,\n` +
      `06/27/2026,06/27/2026,ATM CASH OUT WALMART GAS,Gas,Sale,-150.00,\n` +
      `06/28/2026,06/28/2026,FIGMA DESIGN SUBS SAAS,Business Services,Sale,-45.00,\n` +
      `06/29/2026,06/29/2026,UBER RIDE TRP CHARGE 99,Travel,Sale,-18.25,`;
    setRawText(csvText);
    handleParseData(csvText);
    setTargetAccountId('fa-chase-credit-card');
    setAmountMode('single');
    setColumnMappings({
      0: ['date'],
      2: ['description'],
      3: ['accountId'],
      5: ['amount'],
      6: ['memo']
    });
    setShowMappingStep(true);
  };

  const loadVenmoSample = () => {
    setFileName('Venmo_Statement_June.csv');
    const csvText = 
      `Date,ID,Note,Sender,Recipient,Amount\n` +
      `2026-06-21,5810,mom transfer allowance,Me,Mom,-500.00\n` +
      `2026-06-22,5811,consulting invoice 102,Client,Me,4500.00\n` +
      `2026-06-23,5812,dinner with team,Me,Bistro,-34.50`;
    setRawText(csvText);
    handleParseData(csvText);
    setTargetAccountId('fa-square-checking');
    setAmountMode('single');
    setColumnMappings({
      0: ['date'],
      2: ['description', 'memo'], // Map single column to description and memo at once!
      3: ['counterparty'],
      5: ['amount']
    });
    setShowMappingStep(true);
  };

  // Parser: raw text to array of arrays
  const handleParseData = (textToParse: string) => {
    if (!textToParse.trim()) return;
    
    const lines = textToParse
      .split('\n')
      .map(line => {
        return line.split(',').map(cell => cell.replace(/^["']|["']$/g, '').trim());
      })
      .filter(cells => cells.length > 1 && cells.some(c => c !== ''));

    if (lines.length > 0) {
      setParsedLines(lines);
      setShowMappingStep(true);

      const headers = lines[0] || [];
      const firstDataLine = lines[hasHeaders ? 1 : 0] || lines[0];
      const initialMappings: Record<number, string[]> = {};

      // Auto-detect amount columns mode
      const hLowers = headers.map(h => h.toLowerCase());
      const hasOutflowTerm = hLowers.some(h => h.includes('debit') || h.includes('outflow') || h.includes('charge') || h.includes('withdraw') || h.includes('spent') || h.includes('expense'));
      const hasInflowTerm = hLowers.some(h => h.includes('credit') || h.includes('inflow') || h.includes('deposit') || h.includes('payment') || h.includes('receive'));
      const detectedSeparate = hasOutflowTerm && hasInflowTerm;
      setAmountMode(detectedSeparate ? 'separate' : 'single');

      headers.forEach((header, i) => {
        const hLower = header.toLowerCase();
        const cellVal = (firstDataLine[i] || '').trim();
        const fields: string[] = [];
        
        if (hLower.includes('date')) {
          fields.push('date');
        } else if (hLower.includes('debit') || hLower.includes('outflow') || hLower.includes('charge') || hLower.includes('withdraw') || hLower.includes('spent') || hLower.includes('expense')) {
          fields.push('amount');
        } else if (hLower.includes('credit') || hLower.includes('inflow') || hLower.includes('deposit') || hLower.includes('payment') || hLower.includes('receive')) {
          fields.push(detectedSeparate ? 'inflow_amount' : 'amount');
        } else if (hLower.includes('amount') || hLower.includes('value') || hLower.includes('price')) {
          fields.push('amount');
        } else if (hLower.includes('desc') || hLower.includes('note') || hLower.includes('title') || hLower.includes('payee') || hLower.includes('recipient')) {
          fields.push('description');
        } else if (hLower.includes('merchant') || hLower.includes('vendor') || hLower.includes('counterparty') || hLower.includes('sender')) {
          fields.push('counterparty');
        } else if (hLower.includes('cat') || hLower.includes('account') || hLower.includes('category')) {
          fields.push('accountId');
        } else if (hLower.includes('tag')) {
          fields.push('tags');
        } else if (hLower.includes('memo') || hLower.includes('detail') || hLower.includes('comment')) {
          fields.push('memo');
        } else {
          // Fallback parsing heuristics
          if (cellVal.includes('/') || cellVal.includes('-') || !isNaN(Date.parse(cellVal))) {
            fields.push('date');
          } else if (!isNaN(Number(cellVal.replace(/[$,]/g, ''))) && cellVal !== '') {
            fields.push('amount');
          } else if (cellVal.length > 4) {
            fields.push('description');
          }
        }
        
        if (fields.length > 0) {
          initialMappings[i] = fields;
        }
      });
      
      setColumnMappings(initialMappings);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setFileName(file.name);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const text = event.target.result as string;
          setRawText(text);
          handleParseData(text);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFileName(file.name);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const text = event.target.result as string;
          setRawText(text);
          handleParseData(text);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleIngest = () => {
    if (parsedLines.length === 0) return;

    const dataLines = hasHeaders ? parsedLines.slice(1) : parsedLines;
    
    const rows = dataLines.map(line => {
      const rowData = {
        date: '',
        description: '',
        amount: 0,
        counterparty: '',
        accountId: '',
        tags: [] as string[],
        memo: ''
      };

      let parsedOutflow = 0;
      let parsedInflow = 0;
      let hasOutflowCol = false;
      let hasInflowCol = false;

      // Map values and concatenate if multiple columns target the same field
      for (let i = 0; i < line.length; i++) {
        const val = (line[i] || '').trim();
        const targets = columnMappings[i] || [];
        
        targets.forEach(t => {
          if (t === 'date') {
            rowData.date = val;
          } else if (t === 'description') {
            rowData.description = rowData.description ? `${rowData.description} ${val}` : val;
          } else if (t === 'amount') {
            hasOutflowCol = true;
            const cleanVal = val.replace(/[$,\s]/g, '');
            const num = Number(cleanVal);
            if (!isNaN(num)) parsedOutflow = num;
          } else if (t === 'inflow_amount') {
            hasInflowCol = true;
            const cleanVal = val.replace(/[$,\s]/g, '');
            const num = Number(cleanVal);
            if (!isNaN(num)) parsedInflow = num;
          } else if (t === 'counterparty') {
            rowData.counterparty = rowData.counterparty ? `${rowData.counterparty} ${val}` : val;
          } else if (t === 'accountId') {
            rowData.accountId = val;
          } else if (t === 'tags') {
            const parsedTags = val.split(/[,;|]/).map(x => x.trim()).filter(Boolean);
            rowData.tags = [...rowData.tags, ...parsedTags];
          } else if (t === 'memo') {
            rowData.memo = rowData.memo ? `${rowData.memo} ${val}` : val;
          }
        });
      }

      // Handle dual debit/credit split columns
      if (amountMode === 'separate' && hasOutflowCol && hasInflowCol) {
        if (parsedOutflow !== 0 && parsedInflow === 0) {
          rowData.amount = parsedOutflow > 0 ? -parsedOutflow : parsedOutflow;
        } else if (parsedInflow !== 0 && parsedOutflow === 0) {
          rowData.amount = Math.abs(parsedInflow);
        } else {
          rowData.amount = parsedInflow - parsedOutflow;
        }
      } else if (hasOutflowCol) {
        rowData.amount = parsedOutflow;
      }

      // format date as YYYY-MM-DD
      let date = rowData.date;
      try {
        const parsedDate = new Date(rowData.date);
        if (!isNaN(parsedDate.getTime())) {
          date = parsedDate.toISOString().split('T')[0];
        }
      } catch (e) {}

      return {
        date,
        description: rowData.description,
        amount: rowData.amount,
        counterparty: rowData.counterparty,
        accountId: rowData.accountId,
        tags: rowData.tags,
        memo: rowData.memo
      };
    }).filter(r => r.date !== '' && r.description !== '');

    // Scrape missing counterparties
    const uniqueCPs = Array.from(new Set(rows.map(r => r.counterparty).filter(Boolean))) as string[];
    const missingCPs = uniqueCPs.filter(cpName => {
      const exists = counterparties.some(c => c.name.toLowerCase() === cpName.toLowerCase());
      return !exists;
    });

    // Scrape missing category accounts
    const uniqueCategories = Array.from(new Set(rows.map(r => r.accountId).filter(Boolean))) as string[];
    const missingCats = uniqueCategories.filter(catNameOrCode => {
      const exists = accounts.some(a => 
        a.name.toLowerCase() === catNameOrCode.toLowerCase() || 
        a.code === catNameOrCode ||
        a.id.toLowerCase() === catNameOrCode.toLowerCase()
      );
      return !exists;
    });

    // Prompt if missing elements found
    if (missingCPs.length > 0 || missingCats.length > 0) {
      setMissingCPList(missingCPs.map(name => ({ name, checked: true, isBusiness: true })));
      
      let baseCodeNum = accounts.reduce((max, acc) => {
        const num = parseInt(acc.code, 10);
        return !isNaN(num) && num > max ? num : max;
      }, 5000);

      setMissingCatList(missingCats.map((name, index) => {
        const code = (baseCodeNum + 10 * (index + 1)).toString();
        return {
          name,
          checked: true,
          type: 'expense',
          code
        };
      }));

      setPendingRowsForResolution(rows);
      setShowMissingStep(true);
    } else {
      // Direct completion
      const processed = rows.map(r => {
        let finalAccountId = 'ledger-import-suspense';
        if (r.accountId) {
          const matchedAcc = accounts.find(a => 
            a.name.toLowerCase() === r.accountId.toLowerCase() || 
            a.code === r.accountId ||
            a.id.toLowerCase() === r.accountId.toLowerCase()
          );
          if (matchedAcc) {
            finalAccountId = matchedAcc.id;
          }
        }
        return {
          ...r,
          accountId: finalAccountId
        };
      });

      importCSVData(fileName, targetAccountId, processed);
      resetImportState();
    }
  };

  const handleResolveAndComplete = (shouldCreate: boolean) => {
    // 1. Create missing Counterparties in workspace
    if (shouldCreate) {
      missingCPList.forEach(item => {
        if (item.checked) {
          addCounterparty({
            name: item.name,
            description: 'Created automatically during CSV import mapping',
            tags: ['imported'],
            isBusiness: item.isBusiness,
            relationshipType: 'Other'
          });
        }
      });
    }

    // 3. Map newly resolved items into rows and import
    const finalRows = pendingRowsForResolution.map(row => {
      let finalAccountId = 'ledger-import-suspense';
      if (row.accountId) {
        const matchedExisting = accounts.find(a => 
          a.name.toLowerCase() === row.accountId.toLowerCase() || 
          a.code === row.accountId ||
          a.id.toLowerCase() === row.accountId.toLowerCase()
        );
        if (matchedExisting) {
          finalAccountId = matchedExisting.id;
        }
      }

      let finalCounterparty = row.counterparty || '';
      if (row.counterparty) {
        const missingMatch = missingCPList.find(m => m.name.toLowerCase() === row.counterparty.toLowerCase());
        if (missingMatch && missingMatch.checked) {
          if (!shouldCreate) {
            finalCounterparty = ''; // leave blank if requested
          }
        }
      }

      return {
        ...row,
        accountId: finalAccountId,
        counterparty: finalCounterparty
      };
    });

    importCSVData(fileName, targetAccountId, finalRows);
    resetImportState();
  };

  const handleCreateRuleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRulePattern) return;

    const patternLower = newRulePattern.trim().toLowerCase();
    const targetAccountId = newRuleCat;
    const targetTags = newRuleTags.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const targetCounterparty = newRuleCounterparty;

    addRule({
      pattern: patternLower,
      suggestedAccountId: targetAccountId,
      suggestedTags: targetTags,
      suggestedCounterparty: targetCounterparty,
      description: newRuleMemo || `Match ${newRulePattern}`
    });

    // Check for pending matching rows
    const matchingPendingRows = rawRows.filter(row => {
      return row.status === 'pending' && row.description.toLowerCase().includes(patternLower);
    });

    if (matchingPendingRows.length > 0) {
      setRuleApplyPrompt({
        pattern: patternLower,
        suggestedAccountId: targetAccountId,
        suggestedTags: targetTags,
        suggestedCounterparty: targetCounterparty,
        matchingRowIds: matchingPendingRows.map(r => r.id)
      });
    }

    setNewRulePattern('');
    setNewRuleCounterparty('');
    setNewRuleTags('');
    setNewRuleMemo('');
    setShowRuleForm(false);
  };

  const executeRulePromptNow = () => {
    if (!ruleApplyPrompt) return;
    
    ruleApplyPrompt.matchingRowIds.forEach(id => {
      updateRawRow(id, {
        suggestedAccountId: ruleApplyPrompt.suggestedAccountId,
        suggestedTags: ruleApplyPrompt.suggestedTags,
        suggestedCounterparty: ruleApplyPrompt.suggestedCounterparty
      });
    });

    setRuleApplyPrompt(null);
  };

  return (
    <div className="space-y-8">
      
      {/* RULE BATCH PROMPT BANNER */}
      {ruleApplyPrompt && (
        <div className="bg-amber-500/10 border-2 border-amber-500/30 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-bounce-short shadow-xl" id="rule-batch-banner-import">
          <div className="flex items-start gap-3">
            <Sparkles className="text-amber-400 shrink-0 mt-1" size={24} />
            <div>
              <h4 className="font-bold text-amber-200 text-sm font-display">Run Newly Created Rule Over Existing Transactions?</h4>
              <p className="text-xs text-zinc-300 mt-1">
                We found <span className="font-bold text-white">{ruleApplyPrompt.matchingRowIds.length}</span> matching pending transactions containing <span className="font-mono bg-zinc-950 px-1.5 py-0.5 rounded text-amber-300">"{ruleApplyPrompt.pattern}"</span>. 
                Do you want to run this rule now to automatically map their category, merchant, and tags?
              </p>
            </div>
          </div>
          <div className="flex gap-2.5 w-full md:w-auto shrink-0 justify-end font-sans">
            <button
              onClick={() => setRuleApplyPrompt(null)}
              className="bg-zinc-850 hover:bg-zinc-800 text-zinc-300 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer w-full md:w-auto"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={executeRulePromptNow}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 px-5 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1 w-full md:w-auto shadow-md"
            >
              Apply to {ruleApplyPrompt.matchingRowIds.length} rows now
            </button>
          </div>
        </div>
      )}

      {/* SECTION 1: INGESTION ENGINE */}
      <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/80 shadow-xl space-y-6 backdrop-blur-sm">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white font-display flex items-center gap-2">
            <Upload className="text-emerald-400" size={20} />
            Import Bank Statements
          </h2>
          <p className="text-sm text-zinc-400 font-sans mt-0.5">
            Ingest financial feeds. Map custom headers, preserve raw rows, and route unknown classifications to review.
          </p>
        </div>

        {/* ACCOUNT DESTINATION & QUICK DEMO TEMPLATES */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-950 p-4 rounded-xl border border-zinc-800/80">
          <div className="space-y-1 w-full sm:max-w-xs text-zinc-350">
            <span className="text-[10px] uppercase font-bold text-zinc-400 font-mono tracking-wider">Financial Account</span>
            <SearchableAccountSelect
              value={targetAccountId}
              onChange={setTargetAccountId}
              accounts={financialAccountOptions}
              className="block w-full mt-1.5"
            />
          </div>

          <div className="space-y-1 text-right">
            <span className="text-[10px] uppercase font-bold text-zinc-400 font-mono tracking-wider block">Quick Sandbox Templates</span>
            <div className="flex flex-wrap gap-2 justify-end mt-1">
              <button 
                onClick={loadChaseCCSample}
                className="bg-zinc-850 hover:bg-zinc-800 text-zinc-200 px-3 py-1.5 rounded-lg text-[10px] font-bold border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer"
              >
                Chase CC Sapphire Sample
              </button>
              <button 
                onClick={loadVenmoSample}
                className="bg-zinc-850 hover:bg-zinc-800 text-zinc-200 px-3 py-1.5 rounded-lg text-[10px] font-bold border border-zinc-800 hover:border-zinc-700 transition-all cursor-pointer"
              >
                Venmo Statement Sample
              </button>
            </div>
          </div>
        </div>

        {/* DRAG-AND-DROP OR TEXT AREA */}
        {!showMissingStep && !showMappingStep ? (
          <div className="space-y-4">
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
                dragActive ? 'border-emerald-500 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-950/40 hover:bg-zinc-950/80'
              }`}
            >
              <Upload className="mx-auto text-zinc-400 mb-2" size={28} />
              <p className="text-xs text-zinc-300 font-medium">
                Drag & Drop bank statement CSV here, or{' '}
                <label className="text-emerald-400 hover:underline cursor-pointer font-bold">
                  browse files
                  <input 
                    type="file" 
                    accept=".csv, .txt" 
                    className="hidden" 
                    onChange={handleFileChange} 
                  />
                </label>
              </p>
              <p className="text-[10px] text-zinc-500 font-mono mt-1">CSV format with comma dividers</p>
            </div>

            {/* RAW DATA PASTING CONTAINER */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-zinc-400 flex items-center gap-1">
                  <Clipboard size={14} /> Paste raw statement log lines (Optional)
                </label>
                {rawText && (
                  <button 
                    onClick={() => handleParseData(rawText)}
                    className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowRight size={14} /> Process Data
                  </button>
                )}
              </div>
              <textarea
                placeholder="Transaction Date,Description,Amount&#10;06/25/2026,GITHUB SPONSOR DEV SUBS,-10.00&#10;06/26/2026,WHOLEFOODS MARKET,-65.40"
                value={rawText}
                onChange={e => setRawText(e.target.value)}
                rows={5}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs font-mono text-zinc-100 focus:outline-none focus:border-zinc-700 placeholder:text-zinc-700"
              />
            </div>
          </div>
        ) : showMissingStep ? (
          
          /* RESOLVE MISSING RECORDS (DYNAMIC WIZARD) */
          <div className="bg-zinc-950/60 p-6 rounded-2xl border-2 border-amber-500/30 space-y-6 animate-fadeIn" id="missing-resolver-wizard">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5 font-display">
                  <AlertTriangle size={16} className="text-amber-400 shrink-0" />
                  Approve Missing Ledger Records
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  The CSV contains counterparties or categories that are not currently in your system. Map them now or leave blank.
                </p>
              </div>
              <button 
                onClick={() => {
                  setShowMissingStep(false);
                  setShowMappingStep(true);
                }}
                className="text-xs text-zinc-400 hover:underline cursor-pointer font-semibold self-start sm:self-center"
              >
                Go Back
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Missing Counterparties */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <Tag size={12} className="text-emerald-400" />
                  Missing Counterparties / Clients ({missingCPList.length})
                </h4>
                {missingCPList.length === 0 ? (
                  <p className="text-[11px] text-zinc-500 italic">No missing counterparties found in this batch.</p>
                ) : (
                  <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-3 max-h-64 overflow-y-auto space-y-2">
                    {missingCPList.map((cp, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 rounded bg-zinc-950/40 hover:bg-zinc-950/80 transition-all border border-zinc-900">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-200">
                          <input 
                            type="checkbox"
                            checked={cp.checked}
                            onChange={e => {
                              const updated = [...missingCPList];
                              updated[idx].checked = e.target.checked;
                              setMissingCPList(updated);
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500 bg-zinc-900 border-zinc-800 w-4 h-4"
                          />
                          <span className="font-medium">{cp.name}</span>
                        </label>
                        
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-zinc-500">Business?</span>
                          <button
                            type="button"
                            onClick={() => {
                              const updated = [...missingCPList];
                              updated[idx].isBusiness = !updated[idx].isBusiness;
                              setMissingCPList(updated);
                            }}
                            className={`text-[9px] px-2 py-0.5 rounded font-bold transition-all border cursor-pointer ${
                              cp.isBusiness 
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                            }`}
                          >
                            {cp.isBusiness ? 'YES' : 'NO'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Missing Accounts */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                  <Settings size={12} className="text-emerald-400" />
                  Unmatched Ledger/Category Labels ({missingCatList.length})
                </h4>
                {missingCatList.length === 0 ? (
                  <p className="text-[11px] text-zinc-500 italic">No unmatched labels found in this batch.</p>
                ) : (
                  <div className="bg-zinc-900/40 border border-zinc-850 rounded-xl p-3 max-h-64 overflow-y-auto space-y-2.5">
                    {missingCatList.map((cat, idx) => (
                      <div key={idx} className="p-2.5 rounded bg-zinc-950/40 border border-zinc-900 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-200">
                            <input 
                              type="checkbox"
                              checked={cat.checked}
                              onChange={e => {
                                const updated = [...missingCatList];
                                updated[idx].checked = e.target.checked;
                                setMissingCatList(updated);
                              }}
                              className="rounded text-emerald-600 focus:ring-emerald-500 bg-zinc-900 border-zinc-800 w-4 h-4"
                            />
                            <span className="font-semibold">{cat.name}</span>
                          </label>
                          <span className="text-[9px] font-mono text-zinc-500 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">Review</span>
                        </div>

                        {cat.checked && (
                          <div className="grid grid-cols-2 gap-2 pl-6 pt-1">
                            <div>
                              <span className="text-[9px] text-zinc-400 uppercase tracking-wide block mb-0.5">Account Type</span>
                              <select
                                value={cat.type}
                                onChange={e => {
                                  const updated = [...missingCatList];
                                  updated[idx].type = e.target.value;
                                  setMissingCatList(updated);
                                }}
                                className="w-full text-[10px] bg-zinc-900 border border-zinc-850 text-zinc-200 rounded px-1.5 py-0.5 focus:outline-none font-semibold cursor-pointer"
                              >
                                <option value="expense">Expense</option>
                                <option value="revenue">Revenue</option>
                                <option value="asset">Asset</option>
                                <option value="liability">Liability</option>
                                <option value="equity">Equity</option>
                              </select>
                            </div>
                            <div>
                              <span className="text-[9px] text-zinc-400 uppercase tracking-wide block mb-0.5">COA Code Label</span>
                              <input 
                                type="text"
                                value={cat.code}
                                onChange={e => {
                                  const updated = [...missingCatList];
                                  updated[idx].code = e.target.value;
                                  setMissingCatList(updated);
                                }}
                                className="w-full text-[10px] bg-zinc-900 border border-zinc-850 text-zinc-200 rounded px-1.5 py-0.5 font-mono focus:outline-none focus:border-zinc-700"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Ingest Actions */}
            <div className="flex flex-col sm:flex-row justify-end gap-2 border-t border-zinc-800/80 pt-4">
              <button
                onClick={resetImportState}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer w-full sm:w-auto"
              >
                Cancel Import
              </button>
              <button
                onClick={() => handleResolveAndComplete(false)}
                className="border border-zinc-800 hover:bg-zinc-900 text-zinc-300 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer w-full sm:w-auto"
              >
                Leave Blank & Complete Ingestion
              </button>
              <button
                onClick={() => handleResolveAndComplete(true)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 cursor-pointer border border-emerald-500/30 shadow-lg w-full sm:w-auto"
              >
                <CheckCircle size={14} /> Create Selected & Complete
              </button>
            </div>
          </div>
        ) : (
          
          /* COLUMN MAPPER (FREE MAP MULTI-MAPPING) */
          <div className="bg-zinc-950/60 p-5 rounded-2xl border border-zinc-800/80 space-y-5 animate-fadeIn" id="column-mapper-wizard">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/40 pb-3">
              <div>
                <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-1.5 font-display">
                  <Settings size={16} className="text-emerald-400 shrink-0" />
                  Map CSV Columns to App Fields
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  You can map a single CSV column to multiple targets (e.g., Map Description to Description AND Memo) or combine columns.
                </p>
              </div>
              <button 
                onClick={() => setShowMappingStep(false)}
                className="text-xs text-zinc-400 hover:underline cursor-pointer font-semibold self-start sm:self-center"
              >
                Go Back
              </button>
            </div>

            {/* AMOUNT COLUMN MODE SELECTOR & HEADER TOGGLE */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/30 p-4 rounded-xl border border-zinc-800/60">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-zinc-400 font-mono tracking-wider block">Amount Column Structure</span>
                <div className="flex gap-4">
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-zinc-300 font-medium">
                    <input 
                      type="radio" 
                      name="amountMode" 
                      value="single"
                      checked={amountMode === 'single'} 
                      onChange={() => handleAmountModeChange('single')}
                      className="text-emerald-600 focus:ring-emerald-500 bg-zinc-900 border-zinc-800 w-4 h-4 cursor-pointer"
                    />
                    Single Column (Positive = Inflow, Negative = Outflow)
                  </label>
                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-zinc-300 font-medium">
                    <input 
                      type="radio" 
                      name="amountMode" 
                      value="separate"
                      checked={amountMode === 'separate'} 
                      onChange={() => handleAmountModeChange('separate')}
                      className="text-emerald-600 focus:ring-emerald-500 bg-zinc-900 border-zinc-800 w-4 h-4 cursor-pointer"
                    />
                    Separate Columns (Outflow & Inflow)
                  </label>
                </div>
              </div>

              <div className="flex items-center">
                <label className="inline-flex items-center gap-2 cursor-pointer text-xs text-zinc-300 font-medium">
                  <input 
                    type="checkbox" 
                    checked={hasHeaders} 
                    onChange={e => setHasHeaders(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 bg-zinc-900 border-zinc-800 w-4 h-4 cursor-pointer"
                  />
                  First row represents labels (skip header row)
                </label>
              </div>
            </div>

            {/* INTERACTIVE COLUMN MAPPER MATRIX */}
            <div className="space-y-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block font-mono">Column Assignments Matrix</span>
              
              <div className="space-y-3">
                {parsedLines[0]?.map((header, colIdx) => {
                  const sampleValue = parsedLines[hasHeaders ? 1 : 0]?.[colIdx] || '';
                  const mappedFields = columnMappings[colIdx] || [];

                  return (
                    <div key={colIdx} className="bg-zinc-900/60 p-4 rounded-xl border border-zinc-850 flex flex-col xl:flex-row xl:items-center justify-between gap-4 transition-all hover:border-zinc-700/60">
                      
                      {/* Column Metadata */}
                      <div className="space-y-0.5 max-w-xs shrink-0">
                        <span className="text-[10px] font-mono font-bold text-emerald-400">Column {colIdx + 1}</span>
                        <h4 className="text-xs font-bold text-zinc-200 truncate" title={header}>
                          Header: {header || <span className="text-zinc-600 italic">No Label</span>}
                        </h4>
                        <p className="text-[11px] text-zinc-400 truncate">
                          Sample: <span className="font-mono text-zinc-300">{sampleValue || <span className="text-zinc-600 italic">null</span>}</span>
                        </p>
                      </div>

                      {/* Map Targets Grid */}
                      <div className="flex flex-wrap gap-1.5 xl:justify-end items-center">
                        <button
                          type="button"
                          onClick={() => {
                            setColumnMappings(prev => ({
                              ...prev,
                              [colIdx]: []
                            }));
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all flex items-center gap-1 cursor-pointer ${
                            mappedFields.length === 0
                              ? 'bg-zinc-800 text-zinc-200 border-zinc-700 shadow-md font-bold'
                              : 'bg-zinc-950 text-zinc-500 border-zinc-850 hover:text-zinc-300 hover:border-zinc-750'
                          }`}
                          title="Do not map or parse this column"
                        >
                          {mappedFields.length === 0 && <Check size={10} />}
                          Ignore Column
                        </button>

                        {targetFields.map(field => {
                          const isSelected = mappedFields.includes(field.id);
                          return (
                            <button
                              key={field.id}
                              type="button"
                              onClick={() => toggleMapping(colIdx, field.id)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all flex items-center gap-1 cursor-pointer ${
                                isSelected
                                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25 shadow-md font-bold'
                                  : 'bg-zinc-950 text-zinc-500 border-zinc-850 hover:text-zinc-300 hover:border-zinc-700'
                              }`}
                              title={field.desc}
                            >
                              {isSelected && <Check size={10} />}
                              {field.label}
                              {field.required && !isSelected && <span className="text-rose-500">*</span>}
                            </button>
                          );
                        })}
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>

            {/* Validation Notification Banner */}
            {(() => {
              const mappedTargets = Object.values(columnMappings).flat();
              const missingRequired = targetFields.filter(f => f.required && !mappedTargets.includes(f.id));
              
              if (missingRequired.length > 0) {
                return (
                  <div className="bg-rose-500/5 text-rose-400 text-xs px-3 py-2 rounded-xl border border-rose-500/20 flex items-center gap-2">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>Please assign column mappings for required parameters: <span className="font-bold">{missingRequired.map(r => r.label).join(', ')}</span></span>
                  </div>
                );
              }
              return null;
            })()}

            {/* INGEST ACTIONS */}
            <div className="flex justify-end gap-2 border-t border-zinc-800/40 pt-4">
              <button
                onClick={() => setParsedLines([])}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleIngest}
                disabled={(() => {
                  const mappedTargets = Object.values(columnMappings).flat();
                  return targetFields.some(f => f.required && !mappedTargets.includes(f.id));
                })()}
                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-650 disabled:border-transparent text-white px-5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer border border-emerald-500/30 shadow-lg transition-all"
              >
                <CheckCircle size={14} /> Ingest {hasHeaders ? parsedLines.length - 1 : parsedLines.length} Rows
              </button>
            </div>
          </div>
        )}
      </div>

      {/* SECTION 2: IMPORT BATCHES AUDIT LOG */}
      <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/80 shadow-xl space-y-4 backdrop-blur-sm">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100 font-display flex items-center gap-2">
            <FileText size={16} className="text-zinc-400" />
            Import History ({importBatches.length})
          </h3>
          <p className="text-[11px] text-zinc-500 font-sans">
            A secure trail of all CSV statement batches processed by the dual-entry parser.
          </p>
        </div>

        {importBatches.length === 0 ? (
          <p className="text-xs text-zinc-500 py-2">No batches have been uploaded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left text-zinc-300 border-collapse">
              <thead className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider bg-zinc-950/40 border-b border-zinc-800/80">
                <tr>
                  <th className="px-4 py-3">Date Uploaded</th>
                  <th className="px-4 py-3">File Name Reference</th>
                  <th className="px-4 py-3">Inbound Liquidity Account</th>
                  <th className="px-4 py-3 text-right">Extracted Rows</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {importBatches.map(b => (
                  <tr key={b.id} className="hover:bg-zinc-900/30 transition-all">
                    <td className="px-4 py-3.5 font-medium text-zinc-400">
                      {new Date(b.createdAt).toLocaleDateString()} {new Date(b.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="px-4 py-3.5 font-mono font-semibold text-zinc-200">
                      {b.fileName}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="bg-zinc-950 px-2 py-1 rounded text-zinc-400 border border-zinc-850 font-mono text-[10px]">
                        {accounts.find(a => a.id === b.sourceAccountId)?.name || 'Checking'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-semibold text-emerald-400 font-mono">
                      {b.rawCount} events
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SECTION 3: RULES CONFIGURATOR */}
      <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/80 shadow-xl space-y-4 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100 font-display flex items-center gap-2">
              <Settings size={16} className="text-zinc-400" />
              Automated Categorization Rules ({rules.length})
            </h3>
            <p className="text-[11px] text-zinc-500 font-sans">
              Setup rules to automatically categorize bank descriptions, match counterparties, and allocate tags based on keywords.
            </p>
          </div>
          <button
            onClick={() => setShowRuleForm(!showRuleForm)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:underline cursor-pointer"
          >
            <Plus size={14} /> Add Manual Rule
          </button>
        </div>

        {/* AUTOMATED RULES FORM */}
        {showRuleForm && (
          <form onSubmit={handleCreateRuleSubmit} className="bg-zinc-950/80 p-5 rounded-xl border border-zinc-850 space-y-4 animate-fadeIn">
            <h4 className="font-bold text-xs text-zinc-200">Create Automated Match Rule</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-zinc-400 font-bold mb-1 font-mono">If Bank description contains:</label>
                <input 
                  type="text" 
                  placeholder="e.g. WHOLEFOODS, GITHUB, FIGMA"
                  value={newRulePattern} 
                  onChange={e => setNewRulePattern(e.target.value)} 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-750"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 font-bold mb-1 font-mono">Rule Memo Name:</label>
                <input 
                  type="text" 
                  placeholder="e.g. Auto-suggest software expense"
                  value={newRuleMemo} 
                  onChange={e => setNewRuleMemo(e.target.value)} 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-zinc-750"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] text-zinc-400 font-bold mb-1 font-mono">Suggested category:</label>
                <SearchableAccountSelect
                  value={newRuleCat}
                  onChange={setNewRuleCat}
                  accounts={accounts}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 font-bold mb-1 font-mono">Tags (Comma-separated):</label>
                <input 
                  type="text" 
                  placeholder="business, software"
                  value={newRuleTags} 
                  onChange={e => setNewRuleTags(e.target.value)} 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-2 text-xs text-zinc-100 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 font-bold mb-1 font-mono">Normalized merchant name:</label>
                <input 
                  type="text" 
                  placeholder="e.g. Figma Inc."
                  value={newRuleCounterparty} 
                  onChange={e => setNewRuleCounterparty(e.target.value)} 
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-2 text-xs text-zinc-100 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button 
                type="button" 
                onClick={() => setShowRuleForm(false)}
                className="bg-zinc-800 text-zinc-300 rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-zinc-700 cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="bg-emerald-600 text-white rounded-lg px-3.5 py-1.5 text-xs font-bold hover:bg-emerald-500 cursor-pointer"
              >
                Save Matching Rule
              </button>
            </div>
          </form>
        )}

        {/* RULES LIST */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-zinc-300 border-collapse">
            <thead className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider bg-zinc-950/40 border-b border-zinc-800/80">
              <tr>
                <th className="px-4 py-2.5">Pattern keyword</th>
                <th className="px-4 py-2.5">Auto-suggest category</th>
                <th className="px-4 py-2.5">Auto-suggest merchant</th>
                <th className="px-4 py-2.5">Auto tags</th>
                <th className="px-4 py-2.5 text-right">Delete</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {rules.map(r => {
                const suggAcc = accounts.find(a => a.id === r.suggestedAccountId);
                return (
                  <tr key={r.id} className="hover:bg-zinc-900/30 transition-all">
                    <td className="px-4 py-3">
                      <span className="font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20 rounded-md px-1.5 py-0.5 text-[11px] font-semibold">
                        {r.pattern}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-300">
                      ({suggAcc?.code}) {suggAcc?.name || 'Unassigned'}
                    </td>
                    <td className="px-4 py-3 font-semibold text-zinc-100">
                      {r.suggestedCounterparty || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.suggestedTags.map(tag => (
                          <span key={tag} className="bg-zinc-800/60 text-zinc-400 text-[9px] px-1.5 py-0.5 rounded-full border border-zinc-700/20">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => deleteRule(r.id)}
                        className="text-zinc-400 hover:text-rose-400 cursor-pointer"
                        title="Delete matching rule"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
