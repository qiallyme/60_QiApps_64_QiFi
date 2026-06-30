/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HashRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { QiProvider, useQiStore } from './store';

// Core Views
import LedgerView from './components/LedgerView';
import ReviewQueueView from './components/ReviewQueueView';
import ImportView from './components/ImportView';
import ChartOfAccountsView from './components/ChartOfAccountsView';
import EvidenceView from './components/EvidenceView';
import ReconciliationView from './components/ReconciliationView';
import ForecastView from './components/ForecastView';
import CounterpartyView from './components/CounterpartyView';
import AccountabilityView from './components/AccountabilityView';
import ReportsView from './components/ReportsView';
import SettingsView from './components/SettingsView';

import { 
  TrendingUp, Inbox, Sparkles, Layers, BookOpen,
  Users, FileText, ShieldCheck, BarChart2, ShieldAlert,
  Settings as SettingsIcon, Menu, X, CheckSquare
} from 'lucide-react';

function SidebarAndNav() {
  const location = useLocation();
  const { rawRows } = useQiStore();

  const pendingCount = rawRows.filter(r => r.status === 'pending').length;
  const currentPath = location.pathname;

  // Helper to check active state for style classes
  const isActive = (path: string) => {
    if (path === '/transactions') {
      return currentPath === '/transactions' || currentPath === '/transactions/new';
    }
    if (path === '/counterparties') {
      return currentPath.startsWith('/counterparties');
    }
    return currentPath === path;
  };

  const linkClass = (path: string) => {
    const active = isActive(path);
    return `w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-tight transition-all cursor-pointer ${
      active 
        ? 'bg-zinc-800/80 text-zinc-100 shadow-md border border-zinc-700/30' 
        : 'hover:bg-zinc-800/30 text-zinc-400 hover:text-zinc-200'
    }`;
  };

  const navIconClass = (path: string) => {
    return isActive(path) ? 'text-emerald-400' : 'text-zinc-400';
  };

  return (
    <div className="min-h-screen bg-[#090a0f] flex flex-col md:flex-row font-sans text-zinc-300">
      
      {/* DESKTOP SIDE BAR RAIL */}
      <aside className="hidden md:flex flex-col w-64 bg-zinc-900/30 text-zinc-300 border-r border-zinc-800/80 shrink-0 select-none">
        
        {/* Brand Header */}
        <div className="p-6 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">
              ☯
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white font-display">
                QiFi
              </h1>
              <p className="text-[10px] text-zinc-500 font-medium">Sovereign Money Hub</p>
            </div>
          </div>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 p-4 space-y-6 overflow-y-auto">
          {/* Home Section */}
          <div className="space-y-1.5">
            <span className="text-[9px] uppercase font-bold text-zinc-600 font-mono tracking-wider px-3.5 block">Home Hub</span>
            
            <Link to="/dashboard" className={linkClass('/dashboard')}>
              <div className="flex items-center gap-2.5">
                <TrendingUp size={16} className={navIconClass('/dashboard')} />
                <span>Dashboard / Forecast</span>
              </div>
            </Link>

            <Link to="/imports/review" className={linkClass('/imports/review')}>
              <div className="flex items-center gap-2.5">
                <Inbox size={16} className={navIconClass('/imports/review')} />
                <span>Review Queue</span>
              </div>
              {pendingCount > 0 && (
                <span className="bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {pendingCount}
                </span>
              )}
            </Link>

            <Link to="/imports" className={linkClass('/imports')}>
              <div className="flex items-center gap-2.5">
                <Sparkles size={16} className={navIconClass('/imports')} />
                <span>Ingest Bank Data</span>
              </div>
            </Link>

            <Link to="/accounts" className={linkClass('/accounts')}>
              <div className="flex items-center gap-2.5">
                <Layers size={16} className={navIconClass('/accounts')} />
                <span>Accounts & Balances</span>
              </div>
            </Link>

            <Link to="/transactions" className={linkClass('/transactions')}>
              <div className="flex items-center gap-2.5">
                <BookOpen size={16} className={navIconClass('/transactions')} />
                <span>Transactions Log</span>
              </div>
            </Link>
          </div>

          {/* Parties Section */}
          <div className="space-y-1.5">
            <span className="text-[9px] uppercase font-bold text-zinc-600 font-mono tracking-wider px-3.5 block">Parties & Audits</span>

            <Link to="/counterparties" className={linkClass('/counterparties')}>
              <div className="flex items-center gap-2.5">
                <Users size={16} className={navIconClass('/counterparties')} />
                <span>Counterparties</span>
              </div>
            </Link>

            <Link to="/accountability" className={linkClass('/accountability')}>
              <div className="flex items-center gap-2.5">
                <ShieldAlert size={16} className={navIconClass('/accountability')} />
                <span>Accountability / IOUs</span>
              </div>
            </Link>

            <Link to="/evidence" className={linkClass('/evidence')}>
              <div className="flex items-center gap-2.5">
                <FileText size={16} className={navIconClass('/evidence')} />
                <span>Receipts & Evidence</span>
              </div>
            </Link>

            <Link to="/reconcile" className={linkClass('/reconcile')}>
              <div className="flex items-center gap-2.5">
                <ShieldCheck size={16} className={navIconClass('/reconcile')} />
                <span>Statement Reconcile</span>
              </div>
            </Link>

            <Link to="/reports" className={linkClass('/reports')}>
              <div className="flex items-center gap-2.5">
                <BarChart2 size={16} className={navIconClass('/reports')} />
                <span>Business P&L Reports</span>
              </div>
            </Link>
          </div>

          {/* Settings section */}
          <div className="space-y-1.5 pt-2 border-t border-zinc-800/40">
            <Link to="/settings" className={linkClass('/settings')}>
              <div className="flex items-center gap-2.5">
                <SettingsIcon size={16} className={navIconClass('/settings')} />
                <span>Sovereign Settings</span>
              </div>
            </Link>
          </div>
        </div>
      </aside>

      {/* MOBILE BOTTOM NAVIGATION BAR & TOP BAR */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* MOBILE HEADER DOCK */}
        <header className="md:hidden bg-zinc-900/60 backdrop-blur-md text-white border-b border-zinc-800/80 p-4 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs">
              ☯
            </div>
            <div>
              <h1 className="text-sm font-bold flex items-center gap-1 font-display">
                QiFi
              </h1>
              <p className="text-[9px] text-zinc-400">Zen Cash Flow Tracker</p>
            </div>
          </div>
          
          <Link to="/settings" className="text-zinc-400 hover:text-white" title="Settings">
            <SettingsIcon size={16} />
          </Link>
        </header>

        {/* MAIN VIEW FRAMEWORK */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 md:pb-6 max-w-5xl">
          <div className="animate-fadeIn">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<ForecastView />} />
              <Route path="/accounts" element={<ChartOfAccountsView />} />
              <Route path="/transactions" element={<LedgerView />} />
              <Route path="/transactions/new" element={<LedgerView />} />
              <Route path="/imports" element={<ImportView />} />
              <Route path="/imports/review" element={<ReviewQueueView />} />
              <Route path="/counterparties" element={<CounterpartyView />} />
              <Route path="/counterparties/:id" element={<CounterpartyView />} />
              <Route path="/accountability" element={<AccountabilityView />} />
              <Route path="/evidence" element={<EvidenceView />} />
              <Route path="/reconcile" element={<ReconciliationView />} />
              <Route path="/reports" element={<ReportsView />} />
              <Route path="/settings" element={<SettingsView />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </main>

        {/* MOBILE BOTTOM NAVIGATION BAR (Consolidated into 5 critical targets) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-900/90 backdrop-blur-md border-t border-zinc-800/80 py-2.5 px-3 flex justify-around items-center select-none z-50">
          <Link to="/dashboard" className={`flex flex-col items-center gap-1 transition-all ${isActive('/dashboard') ? 'text-emerald-400' : 'text-zinc-500'}`}>
            <TrendingUp size={18} />
            <span className="text-[9px] font-semibold">Forecast</span>
          </Link>
          <Link to="/imports/review" className={`flex flex-col items-center gap-1 transition-all relative ${isActive('/imports/review') ? 'text-emerald-400' : 'text-zinc-500'}`}>
            <Inbox size={18} />
            <span className="text-[9px] font-semibold">Review</span>
            {pendingCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-emerald-600 text-white text-[8px] h-4 w-4 rounded-full font-bold flex items-center justify-center border border-zinc-900">
                {pendingCount}
              </span>
            )}
          </Link>
          <Link to="/transactions" className={`flex flex-col items-center gap-1 transition-all ${isActive('/transactions') ? 'text-emerald-400' : 'text-zinc-500'}`}>
            <BookOpen size={18} />
            <span className="text-[9px] font-semibold">Ledger</span>
          </Link>
          <Link to="/counterparties" className={`flex flex-col items-center gap-1 transition-all ${isActive('/counterparties') ? 'text-emerald-400' : 'text-zinc-500'}`}>
            <Users size={18} />
            <span className="text-[9px] font-semibold">Partners</span>
          </Link>
          <Link to="/reports" className={`flex flex-col items-center gap-1 transition-all ${isActive('/reports') ? 'text-emerald-400' : 'text-zinc-500'}`}>
            <BarChart2 size={18} />
            <span className="text-[9px] font-semibold">Reports</span>
          </Link>
        </nav>
      </div>

    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <QiProvider>
        <SidebarAndNav />
      </QiProvider>
    </HashRouter>
  );
}
