import React, { useState } from 'react';
import { 
  BarChart3, 
  Coins, 
  GitCompare, 
  Activity, 
  Handshake, 
  Users, 
  Calendar, 
  ShieldAlert, 
  ShoppingBag, 
  Settings,
  Menu,
  X,
  Lock,
  LogOut,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Subcomponents import
import { DashboardView } from './components/DashboardView';
import { AccountsView } from './components/AccountsView';
import { TransactionsView } from './components/TransactionsView';
import { LedgerView } from './components/LedgerView';
import { DebtsView } from './components/DebtsView';
import { PeopleView } from './components/PeopleView';
import { BillsView } from './components/BillsView';
import { AssetsView } from './components/AssetsView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Dynamic recalculator pulls. When updated, we force queries on db.getAccounts() resulting in zero balance lag.
  const [dbTrigger, setDbTrigger] = useState(0);
  const triggerRefresh = () => setDbTrigger(prev => prev + 1);

  // Custom Navigation Sidebar items
  const sidebarItems = [
    { id: 'dashboard', label: 'Executive Dashboard', icon: BarChart3 },
    { id: 'accounts', label: 'Chart of Accounts', icon: Coins },
    { id: 'transactions', label: 'File Transactions', icon: Activity },
    { id: 'ledger', label: 'Double-Entry Ledger', icon: GitCompare },
    { id: 'debts', label: 'Informal IOUs', icon: Handshake },
    { id: 'people', label: 'Party Directory', icon: Users },
    { id: 'bills', label: 'Liability Bills', icon: Calendar },
    { id: 'assets', label: 'Holdings Assets', icon: ShoppingBag },
    { id: 'reports', label: 'Financial Auditing', icon: ShieldAlert },
    { id: 'settings', label: 'Settings & Exports', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#F1F3F5] flex flex-col md:flex-row text-slate-900 font-sans leading-relaxed" id="qifinance_root_layout">
      
      {/* Mobile Top Navigation header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-slate-900 text-white border-b border-slate-800 shadow-sm" id="mobile_navbar">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-bold text-xs h-7 w-7">Qi</div>
          <span className="font-bold tracking-tight text-white text-sm">QiFinance</span>
        </div>

        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white cursor-pointer"
          id="btn_hamburger_toggle"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Primary Desktop / Mobile Collapsible Sidebar */}
      <AnimatePresence>
        {(mobileMenuOpen || true) && (
          <motion.div 
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className={`w-64 bg-slate-900 text-slate-300 shrink-0 border-r border-slate-800 flex flex-col p-5 min-h-screen fixed md:sticky z-40 top-0 bottom-0 left-0 ${mobileMenuOpen ? 'block shadow-2xl transition-all' : 'hidden md:flex shadow-none'}`}
            id="sidebar_navigation_panel"
          >
            {/* Upper Logo and Info */}
            <div className="space-y-6">
              <div className="p-2 flex items-center gap-3">
                <div className="h-8 w-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">Qi</div>
                <h1 className="text-xl font-bold tracking-tight text-white">QiFinance</h1>
              </div>

              {/* Navigation Items list */}
              <nav className="space-y-1 px-2" id="sidebar_nav">
                {sidebarItems.map(item => {
                  const IconComponent = item.icon;
                  const isActive = currentTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setCurrentTab(item.id);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md flex items-center gap-3 cursor-pointer ${isActive ? 'bg-slate-800 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
                      id={`tab_trigger_${item.id}`}
                    >
                      <IconComponent className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                      {item.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Downward Workspace indicators */}
            <div className="p-4 border-t border-slate-800" id="sidebar_footer_sec">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-white">JD</div>
                <div>
                  <p className="text-xs font-semibold text-white">Jane Doe</p>
                  <p className="text-[10px] text-slate-500 uppercase">Private Vault</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main interactive Canvas scroll viewport */}
      <main className="flex-1 p-8 overflow-y-auto w-full min-h-screen" id="main_layout_canvas">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentTab + dbTrigger}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.15 }}
            className="w-full h-full"
            id={`tab-container-${currentTab}`}
          >
            {currentTab === 'dashboard' && (
              <DashboardView onNavigate={(tab) => setCurrentTab(tab)} triggerRefresh={triggerRefresh} />
            )}

            {currentTab === 'accounts' && (
              <AccountsView triggerRefresh={triggerRefresh} />
            )}

            {currentTab === 'transactions' && (
              <TransactionsView triggerRefresh={triggerRefresh} onNavigate={(tab) => setCurrentTab(tab)} />
            )}

            {currentTab === 'ledger' && (
              <LedgerView triggerRefresh={triggerRefresh} />
            )}

            {currentTab === 'debts' && (
              <DebtsView triggerRefresh={triggerRefresh} />
            )}

            {currentTab === 'people' && (
              <PeopleView triggerRefresh={triggerRefresh} />
            )}

            {currentTab === 'bills' && (
              <BillsView triggerRefresh={triggerRefresh} />
            )}

            {currentTab === 'assets' && (
              <AssetsView triggerRefresh={triggerRefresh} />
            )}

            {currentTab === 'reports' && (
              <ReportsView />
            )}

            {currentTab === 'settings' && (
              <SettingsView triggerRefresh={triggerRefresh} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
