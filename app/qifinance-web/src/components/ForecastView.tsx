/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useQiStore } from '../store';
import { RecurringSchedule } from '../types';
import { 
  Calendar, CreditCard, ArrowUpRight, ArrowDownLeft, Plus, 
  Trash2, ToggleLeft, ToggleRight, DollarSign, TrendingUp, Sparkles, X, PlusCircle,
  FileText, Users, Upload, Check, Bookmark, Layers, Sliders, ShieldCheck, Database
} from 'lucide-react';

const DBOARD_DEFAULT_CODES: Record<string, { code: string; label: string }[]> = {
  asset: [
    { code: '1010', label: '1010 - Checking' },
    { code: '1020', label: '1020 - Savings' },
    { code: '1210', label: '1210 - Loans Out' },
  ],
  liability: [
    { code: '2010', label: '2010 - Credit Card' },
    { code: '2300', label: '2300 - Loan Debt' },
  ],
  expense: [
    { code: '5010', label: '5010 - Rent' },
    { code: '5020', label: '5020 - Software' },
    { code: '5050', label: '5050 - Travel' },
    { code: '5060', label: '5060 - Groceries' },
  ],
  revenue: [
    { code: '4010', label: '4010 - Sales' },
    { code: '4020', label: '4020 - Consulting' },
  ]
};

export default function ForecastView() {
  const { 
    schedules, 
    accounts, 
    addSchedule, 
    deleteSchedule, 
    updateSchedule,
    getAccountBalance,
    addAccount,
    addManualTransaction,
    addCounterparty,
    addObligation,
    counterparties,
    addAttachment,
    financialAccounts,
    transactions,
    rawRows,
    obligations
  } = useQiStore();
  const [forecastAccountId, setForecastAccountId] = useState(() => financialAccounts[0]?.id || '');

  React.useEffect(() => {
    if (!forecastAccountId && financialAccounts[0]) setForecastAccountId(financialAccounts[0].id);
  }, [financialAccounts, forecastAccountId]);

  // Quick Actions modal states
  const [quickModal, setQuickModal] = useState<'transaction' | 'bill' | 'account' | 'category' | 'counterparty' | null>(null);

  // 1. Quick Transaction states
  const [qTxDate, setQTxDate] = useState(new Date().toISOString().split('T')[0]);
  const [qTxDesc, setQTxDesc] = useState('');
  const [qTxAmount, setQTxAmount] = useState('');
  const [qTxSourceAcc, setQTxSourceAcc] = useState('');
  const [qTxCatAcc, setQTxCatAcc] = useState('suspense-uncategorized');
  const [qTxCounterparty, setQTxCounterparty] = useState('');
  const [qTxTagsText, setQTxTagsText] = useState('');
  const [qTxFileName, setQTxFileName] = useState('');
  const [qTxFileType, setQTxFileType] = useState('');
  const [qTxFileDataUrl, setQTxFileDataUrl] = useState('');

  // 2. Quick Account states
  const [qAccName, setQAccName] = useState('');
  const [qAccType, setQAccType] = useState<'asset' | 'liability'>('asset');
  const [qAccCodePreset, setQAccCodePreset] = useState('1010');
  const [qAccCustomCode, setQAccCustomCode] = useState('');
  const [qAccInstitution, setQAccInstitution] = useState('');
  const [qAccNumber, setQAccNumber] = useState('');
  const [qAccRouting, setQAccRouting] = useState('');
  const [qAccParentId, setQAccParentId] = useState('');
  const [qAccFileName, setQAccFileName] = useState('');
  const [qAccFileType, setQAccFileType] = useState('');
  const [qAccFileDataUrl, setQAccFileDataUrl] = useState('');

  // 3. Quick Category states
  const [qCatName, setQCatName] = useState('');
  const [qCatType, setQCatType] = useState<'expense' | 'revenue'>('expense');
  const [qCatCodePreset, setQCatCodePreset] = useState('5010');
  const [qCatCustomCode, setQCatCustomCode] = useState('');
  const [qCatDesc, setQCatDesc] = useState('');
  const [qCatParentId, setQCatParentId] = useState('');
  const [qCatFileName, setQCatFileName] = useState('');
  const [qCatFileType, setQCatFileType] = useState('');
  const [qCatFileDataUrl, setQCatFileDataUrl] = useState('');

  // 4. Quick Counterparty states
  const [qCpName, setQCpName] = useState('');
  const [qCpDesc, setQCpDesc] = useState('');
  const [qCpIsBusiness, setQCpIsBusiness] = useState(true);
  const [qCpRelationship, setQCpRelationship] = useState<any>('Client');
  const [qCpTagsText, setQCpTagsText] = useState('');
  const [qCpFileName, setQCpFileName] = useState('');
  const [qCpFileType, setQCpFileType] = useState('');
  const [qCpFileDataUrl, setQCpFileDataUrl] = useState('');

  // 5. Quick Bill / Obligation states
  const [qBillAmount, setQBillAmount] = useState('');
  const [qBillCpId, setQBillCpId] = useState('');
  const [qBillType, setQBillType] = useState<any>('owed_to_me');
  const [qBillDesc, setQBillDesc] = useState('');
  const [qBillDueDate, setQBillDueDate] = useState('');
  const [qBillFileName, setQBillFileName] = useState('');
  const [qBillFileType, setQBillFileType] = useState('');
  const [qBillFileDataUrl, setQBillFileDataUrl] = useState('');

  const handleQuickFileChange = (e: React.ChangeEvent<HTMLInputElement>, setFileName: any, setFileType: any, setFileDataUrl: any) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFileName(file.name);
      setFileType(file.type);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setFileDataUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleQuickTxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!qTxDesc || !qTxAmount || isNaN(Number(qTxAmount))) return;
    const txId = crypto.randomUUID();
    const createdTx = await addManualTransaction({
      id: txId,
      date: qTxDate,
      description: qTxDesc,
      rawDescription: qTxDesc,
      amount: Number(qTxAmount),
      sourceAccountId: qTxSourceAcc,
      tags: qTxTagsText.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
      counterparty: qTxCounterparty
    } as any, qTxCatAcc);

    if (createdTx && qTxFileDataUrl) {
      addAttachment(createdTx.id, qTxFileName, qTxFileType, qTxFileDataUrl, 'Uploaded via command center uploader');
    }
    
    setQTxDesc('');
    setQTxAmount('');
    setQTxCounterparty('');
    setQTxTagsText('');
    setQTxFileName('');
    setQTxFileType('');
    setQTxFileDataUrl('');
    setQuickModal(null);
  };

  const handleQuickAccSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = qAccCodePreset === 'custom' ? qAccCustomCode : qAccCodePreset;
    if (!code || !qAccName) return;
    const accId = `${qAccType}-${qAccName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    addAccount({
      id: accId,
      code,
      name: qAccName,
      type: qAccType,
      description: qAccInstitution ? `Account at ${qAccInstitution}` : 'Bank Account',
      institution: qAccInstitution,
      accountNumber: qAccNumber,
      routingNumber: qAccRouting,
      parentAccountId: qAccParentId || null
    });

    if (qAccFileDataUrl) {
      addAttachment(null, qAccFileName, qAccFileType, qAccFileDataUrl, 'Agreement stored on Account', null, accId);
    }

    setQAccName('');
    setQAccCustomCode('');
    setQAccInstitution('');
    setQAccNumber('');
    setQAccRouting('');
    setQAccParentId('');
    setQAccFileName('');
    setQAccFileType('');
    setQAccFileDataUrl('');
    setQuickModal(null);
  };

  const handleQuickCatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = qCatCodePreset === 'custom' ? qCatCustomCode : qCatCodePreset;
    if (!code || !qCatName) return;
    const accId = `${qCatType}-${qCatName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    addAccount({
      id: accId,
      code,
      name: qCatName,
      type: qCatType,
      description: qCatDesc,
      parentAccountId: qCatParentId || null
    });

    if (qCatFileDataUrl) {
      addAttachment(null, qCatFileName, qCatFileType, qCatFileDataUrl, 'Ingestion matching category rules guideline doc', null, accId);
    }

    setQCatName('');
    setQCatCustomCode('');
    setQCatDesc('');
    setQCatParentId('');
    setQCatFileName('');
    setQCatFileType('');
    setQCatFileDataUrl('');
    setQuickModal(null);
  };

  const handleQuickCpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qCpName) return;
    const cpId = `cp-${Date.now()}`;
    addCounterparty({
      id: cpId,
      name: qCpName,
      description: qCpDesc,
      tags: qCpTagsText.split(',').map(s => s.trim().toLowerCase()).filter(Boolean),
      isBusiness: qCpIsBusiness,
      relationshipType: qCpRelationship
    } as any);

    if (qCpFileDataUrl) {
      addAttachment(null, qCpFileName, qCpFileType, qCpFileDataUrl, 'W-9/Corporate invoice records links', null, null, cpId);
    }

    setQCpName('');
    setQCpDesc('');
    setQCpTagsText('');
    setQCpFileName('');
    setQCpFileType('');
    setQCpFileDataUrl('');
    setQuickModal(null);
  };

  const handleQuickBillSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qBillCpId || !qBillAmount || isNaN(Number(qBillAmount))) return;
    const oblId = `obl-${Date.now()}`;
    addObligation({
      id: oblId,
      counterpartyId: qBillCpId,
      amount: Number(qBillAmount),
      type: qBillType,
      description: qBillDesc,
      dueDate: qBillDueDate || undefined,
      status: 'active'
    } as any);

    if (qBillFileDataUrl) {
      addAttachment(null, qBillFileName, qBillFileType, qBillFileDataUrl, 'Statement PDF or invoice bill records', null, null, null, oblId);
    }

    setQBillAmount('');
    setQBillCpId('');
    setQBillDesc('');
    setQBillDueDate('');
    setQBillFileName('');
    setQBillFileType('');
    setQBillFileDataUrl('');
    setQuickModal(null);
  };

  // New Schedule form state
  // A saved draft must never force an editor open on page load.
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSchedName, setNewSchedName] = useState(() => {
    const draft = localStorage.getItem('qifi_draft_schedule');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.newSchedName !== undefined) return parsed.newSchedName;
      } catch (e) {}
    }
    return '';
  });

  const [newSchedAmount, setNewSchedAmount] = useState(() => {
    const draft = localStorage.getItem('qifi_draft_schedule');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.newSchedAmount !== undefined) return parsed.newSchedAmount;
      } catch (e) {}
    }
    return '';
  });

  const [newSchedCat, setNewSchedCat] = useState(() => {
    const draft = localStorage.getItem('qifi_draft_schedule');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.newSchedCat) return parsed.newSchedCat;
      } catch (e) {}
    }
    return 'expenses-software';
  });

  const [newSchedSource, setNewSchedSource] = useState(() => {
    const draft = localStorage.getItem('qifi_draft_schedule');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.newSchedSource) return parsed.newSchedSource;
      } catch (e) {}
    }
    return '';
  });

  const [newSchedFreq, setNewSchedFreq] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly'>(() => {
    const draft = localStorage.getItem('qifi_draft_schedule');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.newSchedFreq) return parsed.newSchedFreq;
      } catch (e) {}
    }
    return 'monthly';
  });

  const [newSchedDate, setNewSchedDate] = useState(() => {
    const draft = localStorage.getItem('qifi_draft_schedule');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.newSchedDate) return parsed.newSchedDate;
      } catch (e) {}
    }
    return new Date().toISOString().split('T')[0];
  });

  const [newSchedTags, setNewSchedTags] = useState(() => {
    const draft = localStorage.getItem('qifi_draft_schedule');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.newSchedTags !== undefined) return parsed.newSchedTags;
      } catch (e) {}
    }
    return '';
  });

  const [isDraftSaved, setIsDraftSaved] = useState(false);

  React.useEffect(() => {
    const hasValue = !!(
      newSchedName ||
      newSchedAmount ||
      newSchedTags ||
      newSchedCat !== 'expenses-software' ||
      newSchedSource !== '' ||
      newSchedFreq !== 'monthly' ||
      newSchedDate !== new Date().toISOString().split('T')[0]
    );

    if (hasValue) {
      const draft = {
        newSchedName,
        newSchedAmount,
        newSchedCat,
        newSchedSource,
        newSchedFreq,
        newSchedDate,
        newSchedTags
      };
      localStorage.setItem('qifi_draft_schedule', JSON.stringify(draft));
      setIsDraftSaved(true);
    } else {
      localStorage.removeItem('qifi_draft_schedule');
      setIsDraftSaved(false);
    }
  }, [newSchedName, newSchedAmount, newSchedCat, newSchedSource, newSchedFreq, newSchedDate, newSchedTags]);

  // Selected financial account starting balance
  const currentCheckingBalance = useMemo(() => {
    const financial = financialAccounts.find(account => account.id === forecastAccountId);
    if (!financial) return 0;
    const calculatedBalance = getAccountBalance(financial.defaultLedgerAccountId || financial.id);
    return calculatedBalance !== 0 ? calculatedBalance : Number(financial.currentBalance || 0);
  }, [financialAccounts, forecastAccountId, getAccountBalance]);

  const dashboardSummary = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const selectedTransactions = transactions.filter((tx) =>
      (!forecastAccountId || tx.sourceAccountId === forecastAccountId) &&
      new Date(`${tx.date}T00:00:00`) >= monthStart
    );
    const income = selectedTransactions
      .filter((tx) => tx.amount > 0)
      .reduce((sum, tx) => sum + tx.amount, 0);
    const spending = selectedTransactions
      .filter((tx) => tx.amount < 0)
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    return {
      income,
      spending,
      net: income - spending,
      needsReview: rawRows.filter((row) => row.status === 'pending').length +
        transactions.filter((tx) => tx.classificationStatus === 'needs_review').length,
      openObligations: obligations.filter((obligation) => obligation.status === 'active').length,
    };
  }, [forecastAccountId, obligations, rawRows, transactions]);

  // Compute 90-Day Projected Rollforward Timeline
  const projectedTimeline = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days90Limit = new Date(today);
    days90Limit.setDate(days90Limit.getDate() + 90);

    // Occurrences mapper
    const getOccurrences = (sched: RecurringSchedule, limit: Date) => {
      let occDate = new Date(sched.nextDueDate);
      const list: { date: Date; sched: RecurringSchedule }[] = [];
      
      // Safety bounds to prevent infinite loops
      let iterations = 0;
      while (occDate <= limit && iterations < 100) {
        iterations++;
        list.push({ date: new Date(occDate), sched });
        
        if (sched.frequency === 'weekly') {
          occDate.setDate(occDate.getDate() + 7);
        } else if (sched.frequency === 'monthly') {
          occDate.setMonth(occDate.getMonth() + 1);
        } else if (sched.frequency === 'quarterly') {
          occDate.setMonth(occDate.getMonth() + 3);
        } else if (sched.frequency === 'yearly') {
          occDate.setFullYear(occDate.getFullYear() + 1);
        } else {
          break;
        }
      }
      return list;
    };

    // Flatten all active checking occurrences
    const activeCheckingSchedules = schedules.filter(s => s.isActive && s.sourceAccountId === forecastAccountId);
    const allOccurrences = activeCheckingSchedules.flatMap(s => getOccurrences(s, days90Limit));

    // Sort chronologically
    allOccurrences.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Generate daily cash-flow steps
    let runningCheckingBalance = currentCheckingBalance;
    const timelineSteps: {
      date: string;
      name: string;
      amount: number;
      balance: number;
      categoryName: string;
    }[] = [];

    allOccurrences.forEach(occ => {
      runningCheckingBalance += occ.sched.amount;
      const catName = accounts.find(a => a.id === occ.sched.accountId)?.name || 'Transfer';
      
      timelineSteps.push({
        date: occ.date.toISOString().split('T')[0],
        name: occ.sched.name,
        amount: occ.sched.amount,
        balance: runningCheckingBalance,
        categoryName: catName
      });
    });

    return timelineSteps;
  }, [schedules, currentCheckingBalance, accounts, forecastAccountId]);

  // Group forecast steps by buckets: 30, 60, 90 days
  const forecastBuckets = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const steps30: typeof projectedTimeline = [];
    const steps60: typeof projectedTimeline = [];
    const steps90: typeof projectedTimeline = [];

    projectedTimeline.forEach(step => {
      const stepDate = new Date(step.date);
      const diffDays = Math.ceil((stepDate.getTime() - today.getTime()) / (1000 * 3600 * 24));
      
      if (diffDays <= 30) steps30.push(step);
      else if (diffDays <= 60) steps60.push(step);
      else steps90.push(step);
    });

    const sumOut = (steps: typeof projectedTimeline) => 
      steps.filter(s => s.amount < 0).reduce((sum, s) => sum + Math.abs(s.amount), 0);
    const sumIn = (steps: typeof projectedTimeline) => 
      steps.filter(s => s.amount > 0).reduce((sum, s) => sum + s.amount, 0);

    return {
      bucket30: { steps: steps30, out: sumOut(steps30), in: sumIn(steps30) },
      bucket60: { steps: steps60, out: sumOut(steps60), in: sumIn(steps60) },
      bucket90: { steps: steps90, out: sumOut(steps90), in: sumIn(steps90) }
    };
  }, [projectedTimeline]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSchedName || !newSchedAmount || isNaN(Number(newSchedAmount))) return;

    addSchedule({
      name: newSchedName,
      amount: Number(newSchedAmount),
      accountId: newSchedCat,
      sourceAccountId: newSchedSource || (financialAccounts.length > 0 ? financialAccounts[0].id : ''),
      frequency: newSchedFreq,
      nextDueDate: newSchedDate,
      tags: newSchedTags.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
    });

    setNewSchedName('');
    setNewSchedAmount('');
    setNewSchedTags('');
    localStorage.removeItem('qifi_draft_schedule');
    setIsDraftSaved(false);
    setShowAddForm(false);
  };

  const handleToggleActive = (sched: RecurringSchedule) => {
    updateSchedule({
      ...sched,
      isActive: !sched.isActive
    });
  };

  return (
    <div className="space-y-6">
      
      {/* VITAL POSITIONING */}
      <div className="bg-zinc-900/40 text-zinc-100 p-5 rounded-2xl border border-zinc-800/80 shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 backdrop-blur-sm">
        <div>
          <span className="text-[10px] uppercase font-bold text-zinc-400 font-mono tracking-wider">Cash & Bank Balance</span>
          <select value={forecastAccountId} onChange={(event) => setForecastAccountId(event.target.value)} className="ml-3 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-[10px] text-zinc-300">{financialAccounts.map(account => <option key={account.id} value={account.id}>{account.name}</option>)}</select>
          <div className="text-3xl font-extrabold tracking-tight font-mono text-white mt-1">
            ${currentCheckingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-zinc-400 block mt-1">Current starting point for the projection</span>
        </div>
        
        {/* Expected Final Net Position */}
        <div className="text-right sm:text-right border-t sm:border-t-0 sm:border-l border-zinc-800/80 pt-3 sm:pt-0 sm:pl-6">
          <span className="text-[10px] uppercase font-bold text-zinc-400 font-mono tracking-wider">90-Day Projected Balance</span>
          <div className="text-2xl font-bold tracking-tight font-mono text-emerald-400 mt-1">
            ${(projectedTimeline[projectedTimeline.length - 1]?.balance || currentCheckingBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-zinc-400 block mt-1 flex items-center gap-1 justify-end">
            <TrendingUp size={12} className="text-emerald-400" /> Projected Balance Trend Up
          </span>
        </div>
      </div>

      {/* LIVE OPERATIONAL SUMMARY */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Income This Month', value: dashboardSummary.income, tone: 'text-emerald-400', money: true },
          { label: 'Spent This Month', value: dashboardSummary.spending, tone: 'text-rose-400', money: true },
          { label: 'Net Cash Flow', value: dashboardSummary.net, tone: dashboardSummary.net >= 0 ? 'text-emerald-400' : 'text-rose-400', money: true },
          { label: 'Needs Review', value: dashboardSummary.needsReview, tone: dashboardSummary.needsReview ? 'text-amber-400' : 'text-zinc-200', money: false },
          { label: 'Open Obligations', value: dashboardSummary.openObligations, tone: dashboardSummary.openObligations ? 'text-sky-400' : 'text-zinc-200', money: false },
        ].map((metric) => (
          <div key={metric.label} className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4 min-w-0">
            <div className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 truncate">{metric.label}</div>
            <div className={`mt-2 text-xl font-bold font-mono ${metric.tone}`}>
              {metric.money
                ? `${Number(metric.value) < 0 ? '-' : ''}$${Math.abs(Number(metric.value)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : metric.value}
            </div>
            <div className="mt-1 text-[9px] text-zinc-600">Live from the selected account</div>
          </div>
        ))}
      </div>

      {/* ZEN OPERATIONS COMMAND BAR */}
      <div className="bg-zinc-900/30 border border-zinc-800/80 p-5 rounded-2xl shadow-xl backdrop-blur-sm space-y-3.5">
        <span className="text-[10px] uppercase font-bold text-zinc-400 font-mono tracking-wider block">Zen Operations Command</span>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
          <button
            onClick={() => setQuickModal('transaction')}
            className="flex flex-col items-center justify-center p-4 bg-zinc-950/60 border border-zinc-850 hover:border-emerald-500/40 rounded-xl hover:bg-emerald-500/5 transition-all text-center gap-2 cursor-pointer group shadow"
          >
            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 group-hover:text-emerald-400 transition-all shrink-0">
              <ArrowUpRight size={16} />
            </div>
            <div>
              <span className="text-xs font-bold text-zinc-200 block">New Transaction</span>
              <span className="text-[9px] text-zinc-500 mt-0.5 block leading-tight">Ledger Post + File</span>
            </div>
          </button>

          <button
            onClick={() => setQuickModal('bill')}
            className="flex flex-col items-center justify-center p-4 bg-zinc-950/60 border border-zinc-850 hover:border-emerald-500/40 rounded-xl hover:bg-emerald-500/5 transition-all text-center gap-2 cursor-pointer group shadow"
          >
            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 group-hover:text-emerald-400 transition-all shrink-0">
              <Calendar size={16} />
            </div>
            <div>
              <span className="text-xs font-bold text-zinc-200 block">New Bill / Schedule</span>
              <span className="text-[9px] text-zinc-500 mt-0.5 block leading-tight">IOUs & Schedules</span>
            </div>
          </button>

          <button
            onClick={() => setQuickModal('account')}
            className="flex flex-col items-center justify-center p-4 bg-zinc-950/60 border border-zinc-850 hover:border-emerald-500/40 rounded-xl hover:bg-emerald-500/5 transition-all text-center gap-2 cursor-pointer group shadow"
          >
            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 group-hover:text-emerald-400 transition-all shrink-0">
              <Database size={16} />
            </div>
            <div>
              <span className="text-xs font-bold text-zinc-200 block">New Bank Account</span>
              <span className="text-[9px] text-zinc-500 mt-0.5 block leading-tight">Assets & Cards</span>
            </div>
          </button>

          <button
            onClick={() => setQuickModal('category')}
            className="flex flex-col items-center justify-center p-4 bg-zinc-950/60 border border-zinc-850 hover:border-emerald-500/40 rounded-xl hover:bg-emerald-500/5 transition-all text-center gap-2 cursor-pointer group shadow"
          >
            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 group-hover:text-emerald-400 transition-all shrink-0">
              <Bookmark size={16} />
            </div>
            <div>
              <span className="text-xs font-bold text-zinc-200 block">New Category</span>
              <span className="text-[9px] text-zinc-500 mt-0.5 block leading-tight">Expenses & Incomes</span>
            </div>
          </button>

          <button
            onClick={() => setQuickModal('counterparty')}
            className="flex flex-col items-center justify-center p-4 bg-zinc-950/60 border border-zinc-850 hover:border-emerald-500/40 rounded-xl hover:bg-emerald-500/5 transition-all text-center gap-2 cursor-pointer group shadow"
          >
            <div className="p-2.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 group-hover:text-emerald-400 transition-all shrink-0">
              <Users size={16} />
            </div>
            <div>
              <span className="text-xs font-bold text-zinc-200 block">New Partner</span>
              <span className="text-[9px] text-zinc-500 mt-0.5 block leading-tight">Counterparties Log</span>
            </div>
          </button>
        </div>
      </div>

      {/* QUICK TRANSACTION MODAL OVERLAY */}
      {quickModal === 'transaction' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <form onSubmit={handleQuickTxSubmit} className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h4 className="font-bold text-white text-sm flex items-center gap-1.5 font-display">
                <ArrowUpRight className="text-emerald-400" size={18} />
                Post Manual balanced Transaction
              </h4>
              <button type="button" onClick={() => setQuickModal(null)} className="text-zinc-500 hover:text-white"><X size={16} /></button>
            </div>
            
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Date</label>
                <input type="date" value={qTxDate} onChange={e => setQTxDate(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700" required />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Amount (Negative = Expense)</label>
                <input type="number" step="0.01" placeholder="e.g. -24.50 or 1500" value={qTxAmount} onChange={e => setQTxAmount(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Checking / Credit Card Account</label>
                <select 
                  value={qTxSourceAcc || (financialAccounts.length > 0 ? financialAccounts[0].id : '')}
                  onChange={e => setQTxSourceAcc(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 focus:outline-none focus:border-emerald-500/50"
                >
                  {financialAccounts.map(fa => (
                    <option key={fa.id} value={fa.id}>{fa.name} ({fa.institution}) - ${fa.currentBalance.toFixed(2)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Expense / Income Category</label>
                <select value={qTxCatAcc} onChange={e => setQTxCatAcc(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700">
                  {accounts.filter(a => !['asset', 'liability'].includes(a.type)).map(a => (
                    <option key={a.id} value={a.id}>({a.code}) {a.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Counterparty Merchant</label>
                <input type="text" placeholder="e.g. Google Cloud" value={qTxCounterparty} onChange={e => setQTxCounterparty(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Tags (comma-separated)</label>
                <input type="text" placeholder="software, business" value={qTxTagsText} onChange={e => setQTxTagsText(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Description / Memo</label>
              <input type="text" placeholder="Lease rent billing or cloud server platform..." value={qTxDesc} onChange={e => setQTxDesc(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700" required />
            </div>

            {/* Receipt uploader */}
            <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-850 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-zinc-400 uppercase block tracking-wider">Source Receipt Attachment</span>
                <label className="bg-zinc-900 border border-zinc-800 hover:border-emerald-500 text-zinc-400 hover:text-white px-2 py-1 rounded text-[9px] font-bold cursor-pointer transition-all">
                  Upload file
                  <input type="file" accept="image/*,application/pdf,text/*,.csv,.tsv,.txt,.md,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx" className="hidden" onChange={e => handleQuickFileChange(e, setQTxFileName, setQTxFileType, setQTxFileDataUrl)} />
                </label>
              </div>
              {qTxFileName ? (
                <div className="text-[10px] text-emerald-400 font-mono font-bold truncate">✓ Attached: {qTxFileName}</div>
              ) : (
                <div className="text-[9px] text-zinc-600 italic">Optional PDF or receipt image for compliance evidence</div>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button type="button" onClick={() => setQuickModal(null)} className="bg-zinc-800 hover:bg-zinc-750 text-zinc-300 px-4 py-2 rounded-xl text-xs font-bold">Cancel</button>
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md">Post Transaction</button>
            </div>
          </form>
        </div>
      )}

      {/* QUICK BILL / OBLIGATION / SCHEDULE MODAL OVERLAY */}
      {quickModal === 'bill' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <form onSubmit={handleQuickBillSubmit} className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h4 className="font-bold text-white text-sm flex items-center gap-1.5 font-display">
                <Calendar className="text-emerald-400" size={18} />
                Register New Bill / Accountability IOU
              </h4>
              <button type="button" onClick={() => setQuickModal(null)} className="text-zinc-500 hover:text-white"><X size={16} /></button>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Select Counterparty / Partner</label>
                <select value={qBillCpId} onChange={e => setQBillCpId(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700" required>
                  <option value="">-- Choose Merchant / Partner --</option>
                  {counterparties.map(cp => (
                    <option key={cp.id} value={cp.id}>{cp.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Amount ($ USD)</label>
                <input type="number" step="0.01" placeholder="e.g. 500" value={qBillAmount} onChange={e => setQBillAmount(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Obligation Relationship</label>
                <select value={qBillType} onChange={e => setQBillType(e.target.value as any)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700">
                  <option value="owed_to_me">Owed To Me (Receivable / Loan Out)</option>
                  <option value="i_owe">I Owe (Payable / Loan In / Bill)</option>
                  <option value="reimbursable">Reimbursable business expense</option>
                  <option value="needs_evidence">Disputed / Needs evidence</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Due Date</label>
                <input type="date" value={qBillDueDate} onChange={e => setQBillDueDate(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Purpose / Details Description</label>
              <input type="text" placeholder="Rent obligation or family cash lend dental help..." value={qBillDesc} onChange={e => setQBillDesc(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700" required />
            </div>

            {/* Bill uploader */}
            <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-850 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-zinc-400 uppercase block tracking-wider">Bill Document / Invoice</span>
                <label className="bg-zinc-900 border border-zinc-800 hover:border-emerald-500 text-zinc-400 hover:text-white px-2 py-1 rounded text-[9px] font-bold cursor-pointer transition-all">
                  Upload Invoice PDF
                  <input type="file" accept="image/*,application/pdf,text/*,.csv,.tsv,.txt,.md,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx" className="hidden" onChange={e => handleQuickFileChange(e, setQBillFileName, setQBillFileType, setQBillFileDataUrl)} />
                </label>
              </div>
              {qBillFileName ? (
                <div className="text-[10px] text-emerald-400 font-mono font-bold truncate">✓ Attached: {qBillFileName}</div>
              ) : (
                <div className="text-[9px] text-zinc-600 italic">Link standard contractor invoices or utility agreements</div>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button type="button" onClick={() => setQuickModal(null)} className="bg-zinc-800 hover:bg-zinc-755 text-zinc-300 px-4 py-2 rounded-xl text-xs font-bold">Cancel</button>
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md">Register Bill</button>
            </div>
          </form>
        </div>
      )}

      {/* QUICK ACCOUNT CREATOR MODAL */}
      {quickModal === 'account' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <form onSubmit={handleQuickAccSubmit} className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h4 className="font-bold text-white text-sm flex items-center gap-1.5 font-display">
                <Database className="text-emerald-400" size={18} />
                Configure New Bank Account
              </h4>
              <button type="button" onClick={() => setQuickModal(null)} className="text-zinc-500 hover:text-white"><X size={16} /></button>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Account Class</label>
                <select value={qAccType} onChange={e => {
                  setQAccType(e.target.value as any);
                  const type = e.target.value;
                  const presets = DBOARD_DEFAULT_CODES[type] || [];
                  setQAccCodePreset(presets[0]?.code || 'custom');
                }} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700">
                  <option value="asset">Asset (Checking, Savings, Cash)</option>
                  <option value="liability">Liability (Credit Card, Loan debt)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Account Name</label>
                <input type="text" placeholder="e.g. Sapphire credit card" value={qAccName} onChange={e => setQAccName(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Category Code Default</label>
                <select value={qAccCodePreset} onChange={e => setQAccCodePreset(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700">
                  {(DBOARD_DEFAULT_CODES[qAccType] || []).map(p => (
                    <option key={p.code} value={p.code}>{p.label}</option>
                  ))}
                  <option value="custom">Create custom code...</option>
                </select>
              </div>
              {qAccCodePreset === 'custom' && (
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Custom Code</label>
                  <input type="text" placeholder="e.g. 1040" value={qAccCustomCode} onChange={e => qAccCustomCode} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700" required />
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3.5">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Institution</label>
                <input type="text" placeholder="e.g. Chase Bank" value={qAccInstitution} onChange={e => setQAccInstitution(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Account Number</label>
                <input type="text" placeholder="xxxxx5678" value={qAccNumber} onChange={e => setQAccNumber(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Routing Number</label>
                <input type="text" placeholder="021000021" value={qAccRouting} onChange={e => setQAccRouting(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700" />
              </div>
            </div>

            {/* Account Doc attachment */}
            <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-850 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-zinc-400 uppercase block tracking-wider">Account Agreement / W-9 Forms</span>
                <label className="bg-zinc-900 border border-zinc-800 hover:border-emerald-500 text-zinc-400 hover:text-white px-2 py-1 rounded text-[9px] font-bold cursor-pointer transition-all">
                  Attach Agreement
                  <input type="file" accept="image/*,application/pdf,text/*,.csv,.tsv,.txt,.md,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx" className="hidden" onChange={e => handleQuickFileChange(e, setQAccFileName, setQAccFileType, setQAccFileDataUrl)} />
                </label>
              </div>
              {qAccFileName ? (
                <div className="text-[10px] text-emerald-400 font-mono font-bold truncate">✓ Attached: {qAccFileName}</div>
              ) : (
                <div className="text-[9px] text-zinc-600 italic">Save bank agreements or signature cards securely</div>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button type="button" onClick={() => setQuickModal(null)} className="bg-zinc-800 hover:bg-zinc-755 text-zinc-300 px-4 py-2 rounded-xl text-xs font-bold">Cancel</button>
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md">Create Account</button>
            </div>
          </form>
        </div>
      )}

      {/* QUICK CATEGORY CREATOR MODAL */}
      {quickModal === 'category' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <form onSubmit={handleQuickCatSubmit} className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h4 className="font-bold text-white text-sm flex items-center gap-1.5 font-display">
                <Bookmark className="text-emerald-400" size={18} />
                Create Expense or Revenue Category
              </h4>
              <button type="button" onClick={() => setQuickModal(null)} className="text-zinc-500 hover:text-white"><X size={16} /></button>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Category Type</label>
                <select value={qCatType} onChange={e => {
                  setQCatType(e.target.value as any);
                  const presets = DBOARD_DEFAULT_CODES[e.target.value] || [];
                  setQCatCodePreset(presets[0]?.code || 'custom');
                }} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700">
                  <option value="expense">Expense (Lease rent, SaaS software, Food)</option>
                  <option value="revenue">Revenue / Income (Sales, Consulting contract)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Category Name</label>
                <input type="text" placeholder="e.g. Server hosting fees" value={qCatName} onChange={e => setQCatName(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Category Code Default</label>
                <select value={qCatCodePreset} onChange={e => setQCatCodePreset(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700">
                  {(DBOARD_DEFAULT_CODES[qCatType] || []).map(p => (
                    <option key={p.code} value={p.code}>{p.label}</option>
                  ))}
                  <option value="custom">Create custom code...</option>
                </select>
              </div>
              {qCatCodePreset === 'custom' && (
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Custom Code Number</label>
                  <input type="text" placeholder="e.g. 5080" value={qCatCustomCode} onChange={e => setQCatCustomCode(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700" required />
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Description purposes</label>
              <input type="text" placeholder="Primary categorization mapping guidelines..." value={qCatDesc} onChange={e => setQCatDesc(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700" />
            </div>

            {/* Category doc attachment */}
            <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-850 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-zinc-400 uppercase block tracking-wider">Guidelines or reference attachments</span>
                <label className="bg-zinc-900 border border-zinc-800 hover:border-emerald-500 text-zinc-400 hover:text-white px-2 py-1 rounded text-[9px] font-bold cursor-pointer transition-all">
                  Attach Guidelines
                  <input type="file" accept="image/*,application/pdf,text/*,.csv,.tsv,.txt,.md,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx" className="hidden" onChange={e => handleQuickFileChange(e, setQCatFileName, setQCatFileType, setQCatFileDataUrl)} />
                </label>
              </div>
              {qCatFileName ? (
                <div className="text-[10px] text-emerald-400 font-mono font-bold truncate">✓ Attached: {qCatFileName}</div>
              ) : (
                <div className="text-[9px] text-zinc-600 italic">Attach rules guidelines documents</div>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button type="button" onClick={() => setQuickModal(null)} className="bg-zinc-800 hover:bg-zinc-755 text-zinc-300 px-4 py-2 rounded-xl text-xs font-bold">Cancel</button>
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md">Create Category</button>
            </div>
          </form>
        </div>
      )}

      {/* QUICK COUNTERPARTY CREATOR MODAL */}
      {quickModal === 'counterparty' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <form onSubmit={handleQuickCpSubmit} className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
              <h4 className="font-bold text-white text-sm flex items-center gap-1.5 font-display">
                <Users className="text-emerald-400" size={18} />
                Register New Partner / Counterparty
              </h4>
              <button type="button" onClick={() => setQuickModal(null)} className="text-zinc-500 hover:text-white"><X size={16} /></button>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Partner Type</label>
                <select value={qCpIsBusiness ? 'biz' : 'pers'} onChange={e => setQCpIsBusiness(e.target.value === 'biz')} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700">
                  <option value="biz">Business Entity (Merchant, Agency, Client)</option>
                  <option value="pers">Individual (Family member, Landlord, Contractor)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Partner Name</label>
                <input type="text" placeholder="e.g. Acme Corp Consulting" value={qCpName} onChange={e => setQCpName(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700" required />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Relationship Type</label>
                <select value={qCpRelationship} onChange={e => setQCpRelationship(e.target.value as any)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700">
                  <option value="Client">Client</option>
                  <option value="Partner">Partner</option>
                  <option value="Family">Family member</option>
                  <option value="Friend">Friend</option>
                  <option value="Coworker">Contractor / Coworker</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Tags (comma-separated)</label>
                <input type="text" placeholder="contractor, dev-help" value={qCpTagsText} onChange={e => setQCpTagsText(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1">Memo description</label>
              <input type="text" placeholder="Monthly retainer consulting details or contract rates..." value={qCpDesc} onChange={e => setQCpDesc(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-zinc-700" />
            </div>

            {/* Counterparty attachment */}
            <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-850 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-zinc-400 uppercase block tracking-wider">Contract documents / agreements</span>
                <label className="bg-zinc-900 border border-zinc-800 hover:border-emerald-500 text-zinc-400 hover:text-white px-2 py-1 rounded text-[9px] font-bold cursor-pointer transition-all">
                  Attach Contract
                  <input type="file" accept="image/*,application/pdf,text/*,.csv,.tsv,.txt,.md,.json,.doc,.docx,.xls,.xlsx,.ppt,.pptx" className="hidden" onChange={e => handleQuickFileChange(e, setQCpFileName, setQCpFileType, setQCpFileDataUrl)} />
                </label>
              </div>
              {qCpFileName ? (
                <div className="text-[10px] text-emerald-400 font-mono font-bold truncate">✓ Attached: {qCpFileName}</div>
              ) : (
                <div className="text-[9px] text-zinc-600 italic">Attach W-9 forms, corporate records or service level agreements</div>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-2">
              <button type="button" onClick={() => setQuickModal(null)} className="bg-zinc-800 hover:bg-zinc-755 text-zinc-300 px-4 py-2 rounded-xl text-xs font-bold">Cancel</button>
              <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md">Register Partner</button>
            </div>
          </form>
        </div>
      )}

      {/* HEADER SECTION */}
      <div className="flex justify-between items-center pt-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white font-display">
            Future Cash Projection
          </h2>
          <p className="text-xs text-zinc-400 font-sans mt-0.5">
            Project your cash balance day-by-day under active schedules.
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium border border-emerald-500/30 shadow-lg cursor-pointer transition-all"
        >
          {showAddForm ? <X size={14} /> : <Plus size={14} />}
          {showAddForm ? 'Cancel Form' : 'New Schedule'}
        </button>
      </div>

      {/* NEW SCHEDULE POPUP FORM */}
      {showAddForm && (
        <form onSubmit={handleSubmit} className="fixed z-[80] inset-x-3 sm:inset-x-8 top-16 sm:top-24 mx-auto max-w-3xl max-h-[80vh] overflow-y-auto bg-zinc-900 p-5 sm:p-6 rounded-2xl border border-zinc-700 shadow-2xl backdrop-blur-xl space-y-4 animate-fadeIn">
          <h3 className="font-semibold text-zinc-100 text-sm flex items-center gap-1.5">
            <PlusCircle size={16} className="text-emerald-400" />
            Set Up Recurring Money Schedule
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Name */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Schedule Name</label>
              <input 
                type="text" 
                placeholder="e.g. Adobe Subscription, Mom Care"
                value={newSchedName} 
                onChange={e => setNewSchedName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-700"
                required
              />
            </div>
            {/* Amount */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Amount (Negative = Pay, Positive = Collect)</label>
              <input 
                type="number" 
                step="0.01"
                placeholder="e.g. -15.00 or 4500.00"
                value={newSchedAmount} 
                onChange={e => setNewSchedAmount(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-700"
                required
              />
            </div>
            {/* Frequency */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Billing Frequency</label>
              <select
                value={newSchedFreq}
                onChange={e => setNewSchedFreq(e.target.value as any)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Next Date */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Next Bill/Collect Date</label>
              <input 
                type="date" 
                value={newSchedDate} 
                onChange={e => setNewSchedDate(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-700"
                required
              />
            </div>
            {/* Source account */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Pay From / Deposit To</label>
              <select
                  value={newSchedSource || (financialAccounts.length > 0 ? financialAccounts[0].id : '')}
                  onChange={e => setNewSchedSource(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700"
                >
                  {financialAccounts.map(fa => (
                    <option key={fa.id} value={fa.id}>{fa.name} ({fa.institution}) - ${fa.currentBalance.toFixed(2)}</option>
                  ))}
                </select>
            </div>
            {/* Category */}
            <div>
              <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Select Category</label>
              <select
                value={newSchedCat}
                onChange={e => setNewSchedCat(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700"
              >
                {accounts.filter(a => !['asset', 'liability'].includes(a.type)).map(a => (
                  <option key={a.id} value={a.id}>({a.code}) {a.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-zinc-400 uppercase mb-1">Tags (Comma separated)</label>
            <input 
              type="text" 
              placeholder="e.g. software, personal, mom"
              value={newSchedTags} 
              onChange={e => setNewSchedTags(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-700"
            />
          </div>

          <div className="flex justify-end items-center gap-3 pt-1">
            {isDraftSaved && (
              <span className="text-zinc-500 text-[11px] flex items-center gap-1.5 animate-fadeIn mr-auto">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                Draft autosaved
              </span>
            )}
            <button 
              type="button" 
              onClick={() => {
                setNewSchedName('');
                setNewSchedAmount('');
                setNewSchedTags('');
                setNewSchedDate(new Date().toISOString().split('T')[0]);
                setNewSchedCat('expenses-software');
                setNewSchedSource(forecastAccountId);
                setNewSchedFreq('monthly');
                localStorage.removeItem('qifi_draft_schedule');
                setIsDraftSaved(false);
                setShowAddForm(false);
              }}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button 
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-lg text-xs font-semibold shadow-sm cursor-pointer"
            >
              Add Schedule
            </button>
          </div>
        </form>
      )}

      {/* TIMELINE FORECAST BENTO GROUPS (30 / 60 / 90 days) */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-1 font-display">
          <TrendingUp size={16} className="text-emerald-400" />
          Rolling 90-Day Cash Runway Projection
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* BUCKET 1: 30 DAYS */}
          <div className="bg-zinc-900/40 p-4 rounded-2xl border border-zinc-800/80 shadow-xl space-y-3 backdrop-blur-sm">
            <div className="flex justify-between items-center border-b border-zinc-800/60 pb-1.5 text-xs">
              <span className="font-bold text-zinc-200">Next 30 Days Outflow</span>
              <span className="text-rose-400 font-semibold font-mono">-${forecastBuckets.bucket30.out.toFixed(2)}</span>
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {forecastBuckets.bucket30.steps.length === 0 ? (
                <p className="text-[10px] text-zinc-500 text-center py-4 italic">No scheduled occurrences</p>
              ) : (
                forecastBuckets.bucket30.steps.map((step, idx) => (
                  <div key={idx} className="text-[11px] leading-tight flex justify-between items-center py-1.5 bg-zinc-950/60 px-2 rounded-lg border border-zinc-800/60">
                    <div>
                      <span className="font-semibold text-zinc-200 block truncate max-w-[120px]">{step.name}</span>
                      <span className="text-[9px] text-zinc-500 font-mono">{step.date}</span>
                    </div>
                    <div className="text-right">
                      <span className={`font-mono font-semibold ${step.amount < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {step.amount < 0 ? '-' : '+'}${Math.abs(step.amount).toFixed(2)}
                      </span>
                      <span className="text-[8px] text-zinc-500 font-mono block">Bal: ${step.balance.toFixed(0)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* BUCKET 2: 31 TO 60 DAYS */}
          <div className="bg-zinc-900/40 p-4 rounded-2xl border border-zinc-800/80 shadow-xl space-y-3 backdrop-blur-sm">
            <div className="flex justify-between items-center border-b border-zinc-800/60 pb-1.5 text-xs">
              <span className="font-bold text-zinc-200">Days 31 to 60 Outflow</span>
              <span className="text-rose-400 font-semibold font-mono">-${forecastBuckets.bucket60.out.toFixed(2)}</span>
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {forecastBuckets.bucket60.steps.length === 0 ? (
                <p className="text-[10px] text-zinc-500 text-center py-4 italic">No scheduled occurrences</p>
              ) : (
                forecastBuckets.bucket60.steps.map((step, idx) => (
                  <div key={idx} className="text-[11px] leading-tight flex justify-between items-center py-1.5 bg-zinc-950/60 px-2 rounded-lg border border-zinc-800/60">
                    <div>
                      <span className="font-semibold text-zinc-200 block truncate max-w-[120px]">{step.name}</span>
                      <span className="text-[9px] text-zinc-500 font-mono">{step.date}</span>
                    </div>
                    <div className="text-right">
                      <span className={`font-mono font-semibold ${step.amount < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {step.amount < 0 ? '-' : '+'}${Math.abs(step.amount).toFixed(2)}
                      </span>
                      <span className="text-[8px] text-zinc-500 font-mono block">Bal: ${step.balance.toFixed(0)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* BUCKET 3: 61 TO 90 DAYS */}
          <div className="bg-zinc-900/40 p-4 rounded-2xl border border-zinc-800/80 shadow-xl space-y-3 backdrop-blur-sm">
            <div className="flex justify-between items-center border-b border-zinc-800/60 pb-1.5 text-xs">
              <span className="font-bold text-zinc-200">Days 61 to 90 Outflow</span>
              <span className="text-rose-400 font-semibold font-mono">-${forecastBuckets.bucket90.out.toFixed(2)}</span>
            </div>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {forecastBuckets.bucket90.steps.length === 0 ? (
                <p className="text-[10px] text-zinc-500 text-center py-4 italic">No scheduled occurrences</p>
              ) : (
                forecastBuckets.bucket90.steps.map((step, idx) => (
                  <div key={idx} className="text-[11px] leading-tight flex justify-between items-center py-1.5 bg-zinc-950/60 px-2 rounded-lg border border-zinc-800/60">
                    <div>
                      <span className="font-semibold text-zinc-200 block truncate max-w-[120px]">{step.name}</span>
                      <span className="text-[9px] text-zinc-500 font-mono">{step.date}</span>
                    </div>
                    <div className="text-right">
                      <span className={`font-mono font-semibold ${step.amount < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {step.amount < 0 ? '-' : '+'}${Math.abs(step.amount).toFixed(2)}
                      </span>
                      <span className="text-[8px] text-zinc-500 font-mono block">Bal: ${step.balance.toFixed(0)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      {/* CORE ACTIVE RECURRING SCHEDULES */}
      <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/80 shadow-xl space-y-4 backdrop-blur-sm">
        <h3 className="text-sm font-semibold text-zinc-100 font-display">Active Recurring Schedules ({schedules.length})</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left text-zinc-300">
            <thead className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider bg-zinc-950/40 border-b border-zinc-800/80">
              <tr>
                <th className="px-4 py-2.5">Schedule</th>
                <th className="px-4 py-2.5">Billing Account</th>
                <th className="px-4 py-2.5">Frequency</th>
                <th className="px-4 py-2.5">Next Date</th>
                <th className="px-4 py-2.5 text-right">Amount</th>
                <th className="px-4 py-2.5 text-right">Toggle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {schedules.map(sched => {
                const isInc = sched.amount > 0;
                const paySource = accounts.find(a => a.id === sched.sourceAccountId);
                return (
                  <tr key={sched.id} className={`hover:bg-zinc-900/30 transition-all ${!sched.isActive ? 'opacity-40' : ''}`}>
                    <td className="px-4 py-3">
                      <div>
                        <span className="font-bold text-zinc-200 block">{sched.name}</span>
                        <div className="flex gap-1.5 mt-1">
                          {sched.tags.map(tag => (
                            <span key={tag} className="bg-zinc-800/60 text-zinc-400 text-[8px] px-1.5 py-0.5 rounded-full border border-zinc-700/20">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-300">
                      {paySource?.name || 'Cash'}
                    </td>
                    <td className="px-4 py-3 uppercase font-mono text-[10px] text-zinc-400 tracking-wider">
                      {sched.frequency}
                    </td>
                    <td className="px-4 py-3 font-medium text-zinc-300">
                      {sched.nextDueDate}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-mono font-bold ${isInc ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isInc ? '+' : '-'}${Math.abs(sched.amount).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => handleToggleActive(sched)}
                          className="text-zinc-400 hover:text-zinc-200 cursor-pointer"
                        >
                          {sched.isActive ? (
                            <ToggleRight size={22} className="text-emerald-400" />
                          ) : (
                            <ToggleLeft size={22} />
                          )}
                        </button>
                        <button
                          onClick={() => deleteSchedule(sched.id)}
                          className="text-zinc-400 hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
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
