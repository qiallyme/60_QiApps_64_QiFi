/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { useQiStore } from '../store';
import { RecurringSchedule } from '../types';
import { 
  Calendar, CreditCard, ArrowUpRight, ArrowDownLeft, Plus, 
  Trash2, ToggleLeft, ToggleRight, DollarSign, TrendingUp, Sparkles, X, PlusCircle 
} from 'lucide-react';

export default function ForecastView() {
  const { 
    schedules, 
    accounts, 
    addSchedule, 
    deleteSchedule, 
    updateSchedule,
    getAccountBalance 
  } = useQiStore();

  // New Schedule form state
  const [showAddForm, setShowAddForm] = useState(() => {
    return !!localStorage.getItem('qifi_draft_schedule');
  });
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
    return 'assets-checking';
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
    return '2026-07-01';
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
      newSchedSource !== 'assets-checking' ||
      newSchedFreq !== 'monthly' ||
      newSchedDate !== '2026-07-01'
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

  // Checking Account starting balance
  const currentCheckingBalance = useMemo(() => {
    return getAccountBalance('assets-checking');
  }, [getAccountBalance]);

  // Compute 90-Day Projected Rollforward Timeline
  const projectedTimeline = useMemo(() => {
    const today = new Date('2026-06-30'); // Anchor current date
    const days90Limit = new Date('2026-06-30');
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
    const activeCheckingSchedules = schedules.filter(s => s.isActive && s.sourceAccountId === 'assets-checking');
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
  }, [schedules, currentCheckingBalance, accounts]);

  // Group forecast steps by buckets: 30, 60, 90 days
  const forecastBuckets = useMemo(() => {
    const today = new Date('2026-06-30');
    
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
      sourceAccountId: newSchedSource,
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
        <form onSubmit={handleSubmit} className="bg-zinc-900/60 p-6 rounded-2xl border border-zinc-800/80 shadow-2xl backdrop-blur-md space-y-4 animate-fadeIn">
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
                value={newSchedSource}
                onChange={e => setNewSchedSource(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700"
              >
                {accounts.filter(a => ['asset', 'liability'].includes(a.type)).map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
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
                setNewSchedDate('2026-07-01');
                setNewSchedCat('expenses-software');
                setNewSchedSource('assets-checking');
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
