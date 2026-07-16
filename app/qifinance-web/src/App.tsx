import React from 'react';
import { HashRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { QiProvider, useQiStore } from './store';
import { qifinanceApi } from './lib/qifinanceApi';
import { LogOut, MessageCircle, X } from 'lucide-react';
import { supabase } from './lib/supabase';
import { isDynamicImportError, lazyWithChunkRecovery, reloadLatestQiFiVersion } from './lib/chunkRecovery';

function isJwt(token: string): boolean {
  return token.startsWith('ey') && token.split('.').length === 3;
}

class WorkspaceErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error('[QiFi UI crash]', error, info); }
  render() {
    if (!this.state.error) return this.props.children;
    const staleVersion = isDynamicImportError(this.state.error);
    return <div className="m-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-rose-100"><h2 className="font-bold">This screen could not render</h2><p className="mt-2 text-sm text-rose-200">Your financial data was not deleted. {staleVersion ? 'QiFi found an outdated app file and can load the latest version.' : 'Reload the screen to recover.'}</p><pre className="mt-3 overflow-auto text-[10px] text-rose-300">{this.state.error.message}</pre><button onClick={() => { if (staleVersion) void reloadLatestQiFiVersion(); else { this.setState({ error: null }); window.location.reload(); } }} className="mt-4 rounded-xl bg-rose-500 px-4 py-2 text-xs font-bold text-white">{staleVersion ? 'Load latest QiFi version' : 'Reload safely'}</button></div>;
  }
}

function getAuthRedirectUrl(): string {
  const configured = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim();
  if (configured) return configured.endsWith('/') ? configured : `${configured}/`;
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return `${window.location.origin}/`;
  }
  return 'https://fi.qially.com/';
}

// Core Views
import AssistantView from './components/AssistantView';
const LedgerView = lazyWithChunkRecovery(() => import('./components/LedgerView'));
const ReviewQueueView = lazyWithChunkRecovery(() => import('./components/ReviewQueueView'));
const ImportView = lazyWithChunkRecovery(() => import('./components/ImportView'));
const ChartOfAccountsView = lazyWithChunkRecovery(() => import('./components/ChartOfAccountsView'));
const EvidenceView = lazyWithChunkRecovery(() => import('./components/EvidenceView'));
const ReconciliationView = lazyWithChunkRecovery(() => import('./components/ReconciliationView'));
const ForecastView = lazyWithChunkRecovery(() => import('./components/ForecastView'));
const CounterpartyView = lazyWithChunkRecovery(() => import('./components/CounterpartyView'));
const AccountabilityView = lazyWithChunkRecovery(() => import('./components/AccountabilityView'));
const ReportsView = lazyWithChunkRecovery(() => import('./components/ReportsView'));
const SettingsView = lazyWithChunkRecovery(() => import('./components/SettingsView'));
const CategoryRulesView = lazyWithChunkRecovery(() => import('./components/CategoryRulesView'));
const FinancialAccountsView = lazyWithChunkRecovery(() => import('./components/FinancialAccountsView'));

import { 
  TrendingUp, Inbox, Sparkles, Layers, BookOpen, WalletCards,
  Users, FileText, ShieldCheck, BarChart2, ShieldAlert,
  Settings as SettingsIcon, Sliders, LockKeyhole, Bot
} from 'lucide-react';

function SidebarAndNav() {
  const location = useLocation();
  const { rawRows } = useQiStore();

  const pendingCount = rawRows.filter(r => r.status === 'pending').length;
  const currentPath = location.pathname;
  const [assistantOpen, setAssistantOpen] = React.useState(false);

  React.useEffect(() => {
    const theme = localStorage.getItem('qifi_theme') || 'dark';
    const accent = localStorage.getItem('qifi_accent') || 'emerald';
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.accent = accent;
  }, []);

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
    <div className="app-shell min-h-screen bg-[#090a0f] flex flex-col md:flex-row font-sans text-zinc-300">
      
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

            <Link to="/assistant" className={linkClass('/assistant')}>
              <div className="flex items-center gap-2.5">
                <Bot size={16} className={navIconClass('/assistant')} />
                <span>Qi Assistant</span>
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

            <Link to="/rules" className={linkClass('/rules')}>
              <div className="flex items-center gap-2.5">
                <Sliders size={16} className={navIconClass('/rules')} />
                <span>Category Rules</span>
              </div>
            </Link>

            <Link to="/financial-accounts" className={linkClass('/financial-accounts')}>
              <div className="flex items-center gap-2.5">
                <WalletCards size={16} className={navIconClass('/financial-accounts')} />
                <span>Financial Accounts</span>
              </div>
            </Link>

            <Link to="/accounts" className={linkClass('/accounts')}>
              <div className="flex items-center gap-2.5">
                <Layers size={16} className={navIconClass('/accounts')} />
                <span>Chart of Accounts</span>
              </div>
            </Link>

            <Link to="/transactions" className={linkClass('/transactions')}>
              <div className="flex items-center gap-2.5">
                <BookOpen size={16} className={navIconClass('/transactions')} />
                <span>Transactions Log</span>
              </div>
            </Link>
          </div>

          {/* Counterparties Section */}
          <div className="space-y-1.5">
            <span className="text-[9px] uppercase font-bold text-zinc-600 font-mono tracking-wider px-3.5 block">Counterparties & Audits</span>

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

          {/* Settings and Sign Out section */}
          <div className="space-y-1.5 pt-2 border-t border-zinc-800/40">
            <Link to="/settings" className={linkClass('/settings')}>
              <div className="flex items-center gap-2.5">
                <SettingsIcon size={16} className={navIconClass('/settings')} />
                <span>Sovereign Settings</span>
              </div>
            </Link>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                qifinanceApi.clearAuthToken();
                window.location.reload();
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold tracking-tight transition-all cursor-pointer hover:bg-rose-950/20 text-zinc-400 hover:text-rose-400 border border-transparent"
            >
              <div className="flex items-center gap-2.5">
                <LogOut size={16} />
                <span>Lock / Sign Out</span>
              </div>
            </button>
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
          
          <div className="flex items-center gap-3">
            <Link to="/settings" className="text-zinc-400 hover:text-white" title="Settings">
              <SettingsIcon size={16} />
            </Link>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                qifinanceApi.clearAuthToken();
                window.location.reload();
              }}
              className="text-zinc-400 hover:text-rose-400 cursor-pointer"
              title="Sign Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* MAIN VIEW FRAMEWORK */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-5 pb-20 md:pb-6 w-full max-w-7xl">
          <WorkspaceErrorBoundary><React.Suspense fallback={<div className="p-10 text-center text-xs text-zinc-500">Loading workspace…</div>}><div className="animate-fadeIn">
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<ForecastView />} />
              <Route path="/assistant" element={<AssistantView />} />
              <Route path="/accounts" element={<ChartOfAccountsView />} />
              <Route path="/financial-accounts" element={<FinancialAccountsView />} />
              <Route path="/transactions" element={<LedgerView />} />
              <Route path="/transactions/new" element={<LedgerView />} />
              <Route path="/imports" element={<ImportView />} />
              <Route path="/imports/review" element={<ReviewQueueView />} />
              <Route path="/rules" element={<CategoryRulesView />} />
              <Route path="/counterparties" element={<CounterpartyView />} />
              <Route path="/counterparties/:id" element={<CounterpartyView />} />
              <Route path="/accountability" element={<AccountabilityView />} />
              <Route path="/evidence" element={<EvidenceView />} />
              <Route path="/reconcile" element={<ReconciliationView />} />
              <Route path="/reports" element={<ReportsView />} />
              <Route path="/settings" element={<SettingsView />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div></React.Suspense></WorkspaceErrorBoundary>
        </main>

        {/* MOBILE BOTTOM NAVIGATION BAR (Consolidated into 5 critical targets) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-900/90 backdrop-blur-md border-t border-zinc-800/80 py-2.5 px-3 flex justify-around items-center select-none z-50">
          <Link to="/dashboard" className={`flex flex-col items-center gap-1 transition-all ${isActive('/dashboard') ? 'text-emerald-400' : 'text-zinc-500'}`}>
            <TrendingUp size={18} />
            <span className="text-[9px] font-semibold">Forecast</span>
          </Link>
          <Link to="/assistant" className={`flex flex-col items-center gap-1 transition-all ${isActive('/assistant') ? 'text-emerald-400' : 'text-zinc-500'}`}>
            <Bot size={18} />
            <span className="text-[9px] font-semibold">AI</span>
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
            <span className="text-[9px] font-semibold">Counterparties</span>
          </Link>
          <Link to="/reports" className={`flex flex-col items-center gap-1 transition-all ${isActive('/reports') ? 'text-emerald-400' : 'text-zinc-500'}`}>
            <BarChart2 size={18} />
            <span className="text-[9px] font-semibold">Reports</span>
          </Link>
        </nav>
        {currentPath !== '/assistant' && <>
          <button onClick={() => setAssistantOpen(true)} className="fixed right-4 bottom-20 md:bottom-6 z-40 h-12 w-12 rounded-full bg-emerald-500 text-zinc-950 shadow-2xl shadow-emerald-950/50 flex items-center justify-center hover:scale-105 transition-transform" title="Ask Qi about this page"><MessageCircle size={21}/></button>
          {assistantOpen && <div className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-sm flex justify-end" onClick={() => setAssistantOpen(false)}><section className="h-full w-full sm:max-w-xl bg-[#090a0f] border-l border-zinc-800 p-4 sm:p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between mb-2"><div><p className="text-xs font-bold text-emerald-400">Qi knows your current screen</p><p className="text-[10px] text-zinc-500">Context: {currentPath}</p></div><button onClick={() => setAssistantOpen(false)} className="p-2 rounded-lg bg-zinc-900 text-zinc-400 hover:text-white"><X size={16}/></button></div><AssistantView pageContext={currentPath}/></section></div>}
        </>}
      </div>

    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AuthGate>
        <QiProvider>
          <SidebarAndNav />
        </QiProvider>
      </AuthGate>
    </HashRouter>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = React.useState(() => qifinanceApi.hasAuthToken());
  const [mode, setMode] = React.useState<'magic-link' | 'passphrase'>('magic-link');
  const [email, setEmail] = React.useState('');
  const [passphrase, setPassphrase] = React.useState('');
  
  const [verifying, setVerifying] = React.useState(false);
  const [authError, setAuthError] = React.useState('');
  const [authSuccess, setAuthSuccess] = React.useState(false);
  const [isChecking, setIsChecking] = React.useState(false);
  const [infoMessage, setInfoMessage] = React.useState('');

  React.useEffect(() => {
    // 1. Check existing Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        qifinanceApi.setAuthToken(session.access_token);
        setUnlocked(true);
      }
    });

    // 2. Listen to active auth session changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        qifinanceApi.setAuthToken(session.access_token);
        setUnlocked(true);
      } else {
        const currentToken = qifinanceApi.getAuthToken();
        if (currentToken && isJwt(currentToken)) {
          qifinanceApi.clearAuthToken();
          setUnlocked(false);
        }
      }
    });

    // 3. Handle magic link token_hash verification
    const params = new URLSearchParams(window.location.search);
    const token_hash = params.get('token_hash');
    const type = params.get('type');

    if (token_hash) {
      setVerifying(true);
      supabase.auth.verifyOtp({
        token_hash,
        type: (type as any) || 'email',
      }).then(({ data, error }) => {
        if (error) {
          setAuthError(error.message);
        } else {
          setAuthSuccess(true);
          if (data.session) {
            qifinanceApi.setAuthToken(data.session.access_token);
            setUnlocked(true);
          }
          window.history.replaceState({}, document.title, '/');
        }
        setVerifying(false);
      });
    }

    return () => subscription.unsubscribe();
  }, []);

  const handleMagicLinkSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextEmail = email.trim();
    if (!nextEmail) return;

    setIsChecking(true);
    setAuthError('');
    setInfoMessage('');

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: nextEmail,
        options: {
          emailRedirectTo: getAuthRedirectUrl(),
        },
      });
      if (error) {
        setAuthError(error.message);
      } else {
        setInfoMessage('Check your email for the magic login link!');
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Failed to send magic link.');
    } finally {
      setIsChecking(false);
    }
  };

  const handlePassphraseSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextToken = passphrase.trim();
    if (!nextToken) return;

    setIsChecking(true);
    setAuthError('');
    setInfoMessage('');
    qifinanceApi.setAuthToken(nextToken);

    try {
      await qifinanceApi.getState();
      setUnlocked(true);
      setPassphrase('');
    } catch (err) {
      qifinanceApi.clearAuthToken();
      setAuthError(err instanceof Error ? err.message : 'Could not unlock QiFi.');
    } finally {
      setIsChecking(false);
    }
  };

  if (unlocked) return <>{children}</>;

  if (verifying) {
    return (
      <div className="min-h-screen bg-[#090a0f] flex items-center justify-center p-4 text-zinc-200 font-sans">
        <div className="w-full max-w-sm bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4 text-center">
          <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto animate-spin">
            ☯
          </div>
          <h1 className="text-base font-bold text-white font-display">Verifying</h1>
          <p className="text-xs text-zinc-400">Confirming your magic login link...</p>
        </div>
      </div>
    );
  }

  if (authError && !verifying) {
    return (
      <div className="min-h-screen bg-[#090a0f] flex items-center justify-center p-4 text-zinc-200 font-sans">
        <div className="w-full max-w-sm bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-5 text-center">
          <div className="h-12 w-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
            <LockKeyhole size={24} />
          </div>
          <h1 className="text-base font-bold text-white font-display">Authentication Failed</h1>
          <p className="text-xs text-rose-300 bg-rose-950/20 border border-rose-900/40 rounded-xl p-3">{authError}</p>
          <button
            onClick={() => {
              setAuthError('');
              window.history.replaceState({}, document.title, '/');
            }}
            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-sm rounded-xl py-2.5 transition-colors cursor-pointer"
          >
            Return to Login
          </button>
        </div>
      </div>
    );
  }

  if (authSuccess && !unlocked) {
    return (
      <div className="min-h-screen bg-[#090a0f] flex items-center justify-center p-4 text-zinc-200 font-sans">
        <div className="w-full max-w-sm bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4 text-center">
          <div className="h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto">
            ✓
          </div>
          <h1 className="text-base font-bold text-white font-display">Authorized</h1>
          <p className="text-xs text-zinc-400">Authentication successful! Loading your account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090a0f] flex items-center justify-center p-4 text-zinc-200 font-sans">
      <div className="w-full max-w-sm bg-zinc-900/70 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <LockKeyhole size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold text-white font-display">Unlock QiFi</h1>
            <p className="text-xs text-zinc-500">Private finance workspace</p>
          </div>
        </div>

        {mode === 'magic-link' ? (
          <form onSubmit={handleMagicLinkSubmit} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Email Address</span>
              <input
                autoFocus
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-emerald-500/60"
                required
              />
            </label>

            {infoMessage && (
              <div className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3">
                {infoMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isChecking || !email.trim()}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 font-bold text-sm rounded-xl py-2.5 transition-colors cursor-pointer"
            >
              {isChecking ? 'Sending Link...' : 'Send Magic Link'}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setMode('passphrase');
                  setAuthError('');
                  setInfoMessage('');
                }}
                className="text-[11px] text-zinc-500 hover:text-emerald-400 transition-colors cursor-pointer"
              >
                Or unlock with passphrase
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handlePassphraseSubmit} className="space-y-4">
            <label className="block space-y-2">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Passphrase</span>
              <input
                autoFocus
                type="password"
                placeholder="Legacy access key"
                value={passphrase}
                onChange={(event) => setPassphrase(event.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 outline-none focus:border-emerald-500/60"
                autoComplete="current-password"
                required
              />
            </label>

            <button
              type="submit"
              disabled={isChecking || !passphrase.trim()}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 font-bold text-sm rounded-xl py-2.5 transition-colors cursor-pointer"
            >
              {isChecking ? 'Checking...' : 'Unlock'}
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setMode('magic-link');
                  setAuthError('');
                  setInfoMessage('');
                }}
                className="text-[11px] text-zinc-500 hover:text-emerald-400 transition-colors cursor-pointer"
              >
                Or sign in via Magic Link
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
