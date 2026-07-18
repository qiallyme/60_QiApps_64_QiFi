/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { useQiStore } from '../store';
import { 
  Settings as SettingsIcon, Download, Upload, RefreshCw, 
  Shield, HelpCircle, HardDrive, Database, Info, Trash2,
  CheckCircle, AlertTriangle, X, Sun, Moon, Palette
} from 'lucide-react';

export default function SettingsView() {
  const { exportData, importData, resetToDefault, clearToBlankLedger } = useQiStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [theme, setTheme] = useState(() => localStorage.getItem('qifi_theme') || 'dark');
  const [accent, setAccent] = useState(() => localStorage.getItem('qifi_accent') || 'emerald');

  const applyAppearance = (nextTheme: string, nextAccent: string) => {
    setTheme(nextTheme); setAccent(nextAccent);
    localStorage.setItem('qifi_theme', nextTheme);
    localStorage.setItem('qifi_accent', nextAccent);
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.dataset.accent = nextAccent;
  };

  // Custom modal states
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'danger' | 'info' | 'warning';
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const showConfirm = (title: string, message: string, type: 'danger' | 'info' | 'warning', onConfirm: () => void) => {
    setModalState({
      isOpen: true,
      title,
      message,
      type,
      onConfirm
    });
  };

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info') => {
    setAlertState({
      isOpen: true,
      title,
      message,
      type
    });
  };

  const handleBackup = () => {
    const dataStr = exportData();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qifinance_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const success = importData(event.target.result as string);
          if (success) {
            showAlert(
              "Backup Restored",
              "Backup successfully restored! Your ledger has been updated.",
              "success"
            );
          } else {
            showAlert(
              "Restore Failed",
              "Failed to restore backup. Please make sure the backup file has a valid JSON ledger format.",
              "error"
            );
          }
        }
      };
      reader.readAsText(file);
    }
  };

  const handleReset = () => {
    showConfirm(
      "Reset Database?",
      "Wipe all current data changes and reload the default double-entry demo transactions?",
      "warning",
      () => {
        resetToDefault();
        showAlert(
          "Demo Restored",
          "Your ledger was successfully reset to the default demo state.",
          "success"
        );
      }
    );
  };

  const handleWipe = () => {
    showConfirm(
      "Wipe Ledger?",
      "Wipe all transaction history? This will clear all transactions, statements, counterparties, schedules, and raw rows, leaving you with a clean, blank standard Chart of Accounts to start entering your own real records.",
      "danger",
      () => {
        clearToBlankLedger();
        showAlert(
          "Ledger Wiped",
          "Database successfully wiped to a blank slate! You can now start entering your own transactions.",
          "success"
        );
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white font-display flex items-center gap-2">
          <SettingsIcon className="text-emerald-400" size={24} />
          Sovereign Backup & Settings
        </h2>
        <p className="text-xs text-zinc-400">
          Control your financial data. No cloud-locking, no corporate spyware. Your ledger, your machine.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2 bg-zinc-900/30 border border-zinc-800/80 p-5 rounded-2xl space-y-4">
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2"><Palette size={16} className="text-emerald-400"/>Appearance</h3>
          <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
            <div className="inline-flex rounded-xl border border-zinc-800 bg-zinc-950/60 p-1">
              {[['dark','Dark',Moon],['light','Light',Sun]].map(([value,label,Icon]: any) => <button key={value} onClick={() => applyAppearance(value, accent)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold ${theme === value ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-400'}`}><Icon size={14}/>{label}</button>)}
            </div>
            <div className="flex items-center gap-2"><span className="text-xs text-zinc-500 mr-1">Accent</span>{['emerald','blue','violet','amber'].map((color) => <button key={color} onClick={() => applyAppearance(theme, color)} aria-label={`${color} accent`} className={`h-8 w-8 rounded-full border-2 ${accent === color ? 'border-white scale-110' : 'border-transparent'} accent-swatch accent-${color}`}/>)}</div>
          </div>
        </div>
        {/* Core Controls Card */}
        <div className="bg-zinc-900/30 border border-zinc-800/80 p-6 rounded-2xl space-y-6 backdrop-blur-sm">
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2 font-display">
            <Database size={16} className="text-emerald-400" />
            Ledger Data Operations
          </h3>

          <div className="space-y-4">
            {/* Export */}
            <div className="flex items-center justify-between p-4 bg-zinc-950/40 rounded-xl border border-zinc-800/50">
              <div>
                <span className="text-xs font-bold text-zinc-200 block">Export Full Ledger</span>
                <span className="text-[10px] text-zinc-500">Download your entire double-entry ledger as raw JSON.</span>
              </div>
              <button
                onClick={handleBackup}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shrink-0"
              >
                <Download size={14} /> Export Backup
              </button>
            </div>

            {/* Import */}
            <div className="flex items-center justify-between p-4 bg-zinc-950/40 rounded-xl border border-zinc-800/50">
              <div>
                <span className="text-xs font-bold text-zinc-200 block">Restore Ledger Backup</span>
                <span className="text-[10px] text-zinc-500">Restore your database from an existing JSON backup.</span>
              </div>
              <label className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-sm shrink-0">
                <Upload size={14} /> Import State File
                <input 
                  type="file" 
                  ref={fileInputRef}
                  accept=".json" 
                  className="hidden" 
                  onChange={handleRestore} 
                />
              </label>
            </div>

            {/* Wipe to Blank Ledger */}
            <div className="flex items-center justify-between p-4 bg-zinc-950/40 rounded-xl border border-zinc-800/50">
              <div>
                <span className="text-xs font-bold text-zinc-200 block">Wipe to Blank Ledger</span>
                <span className="text-[10px] text-zinc-500">Remove all sample transactions and start fresh with empty records.</span>
              </div>
              <button
                onClick={handleWipe}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 border border-zinc-700 hover:border-zinc-600 transition-all cursor-pointer shrink-0"
              >
                <Trash2 size={14} className="text-rose-400" /> Wipe Ledger
              </button>
            </div>

            {/* Clear Database */}
            <div className="flex items-center justify-between p-4 bg-zinc-950/40 rounded-xl border border-rose-500/10">
              <div>
                <span className="text-xs font-bold text-rose-400 block">Reset Database</span>
                <span className="text-[10px] text-zinc-500">Wipe all your transactions and reload default double-entry data.</span>
              </div>
              <button
                onClick={handleReset}
                className="bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 border border-rose-500/20 hover:border-rose-500 transition-all cursor-pointer shrink-0"
              >
                <RefreshCw size={14} /> Reload Demo Data
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Security & Philosophy */}
        <div className="space-y-6">
          {/* Philosophy Card */}
          <div className="bg-zinc-900/30 border border-zinc-800/80 p-6 rounded-2xl space-y-4 backdrop-blur-sm">
            <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2 font-display">
              <Shield size={16} className="text-emerald-400" />
              The QiFi Data Guarantee
            </h3>

            <div className="space-y-3 text-xs text-zinc-400 leading-relaxed font-sans">
              <p>
                Traditional financial tools force you to link accounts via third-party brokers (like Plaid) and store your logs on vulnerable servers. They sell your data, market unwanted loans, and freeze accounts arbitrarily.
              </p>
              <p className="font-semibold text-zinc-300">
                QiFi does none of that. 
              </p>
              <p>
                Every transaction you import, receipt you attach, and category you define is saved through the QiFi API into your Supabase finance tables, with browser storage kept as a local fallback and draft cache.
              </p>
              <div className="p-3.5 bg-zinc-950/40 rounded-xl border border-zinc-800/60 flex gap-2.5 items-start mt-2">
                <Info size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-zinc-500 leading-normal">
                  To guarantee your data remains permanent and unlinked from company lock-ins, remember to download a backup file regularly. Store it in secure, encrypted cloud repositories of your choice.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CUSTOM CONFIRMATION MODAL */}
      {modalState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-xl shrink-0 ${
                modalState.type === 'danger' 
                  ? 'bg-rose-500/10 border border-rose-500/20 text-rose-400' 
                  : modalState.type === 'warning'
                    ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
                    : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              }`}>
                {modalState.type === 'danger' ? (
                  <Trash2 size={20} />
                ) : modalState.type === 'warning' ? (
                  <AlertTriangle size={20} />
                ) : (
                  <Info size={20} />
                )}
              </div>
              <div className="space-y-1 flex-1">
                <h4 className="font-bold text-zinc-100 text-sm font-display">{modalState.title}</h4>
                <p className="text-zinc-400 text-xs leading-relaxed">{modalState.message}</p>
              </div>
            </div>
            
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setModalState(prev => ({ ...prev, isOpen: false }))}
                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold px-4 py-2 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setModalState(prev => ({ ...prev, isOpen: false }));
                  if (modalState.onConfirm) modalState.onConfirm();
                }}
                className={`text-white text-xs font-semibold px-4 py-2 rounded-xl cursor-pointer ${
                  modalState.type === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-500 border border-rose-500/30'
                    : modalState.type === 'warning'
                      ? 'bg-amber-600 hover:bg-amber-500 border border-amber-500/30 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/30'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM ALERT MODAL */}
      {alertState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-2 bg-zinc-950 border border-zinc-850">
              {alertState.type === 'success' ? (
                <CheckCircle size={24} className="text-emerald-400" />
              ) : alertState.type === 'error' ? (
                <AlertTriangle size={24} className="text-rose-400" />
              ) : (
                <Info size={24} className="text-emerald-400" />
              )}
            </div>
            
            <div className="space-y-1">
              <h4 className="font-bold text-zinc-100 text-sm font-display">{alertState.title}</h4>
              <p className="text-zinc-400 text-xs leading-relaxed">{alertState.message}</p>
            </div>

            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
                className="bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/30 text-white text-xs font-semibold px-6 py-2 rounded-xl cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
