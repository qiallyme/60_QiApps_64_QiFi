import React, { useState } from 'react';
import { db, postgresMigrations } from '../db';
import { 
  Download, 
  RefreshCcw, 
  Upload, 
  Server, 
  Cloud, 
  Lock, 
  Key, 
  FileCode,
  CheckCircle,
  HelpCircle,
  Clipboard
} from 'lucide-react';

interface SettingsProps {
  triggerRefresh: () => void;
}

export function SettingsView({ triggerRefresh }: SettingsProps) {
  const [copiedMigration, setCopiedMigration] = useState(false);

  const handleCopyMigrations = () => {
    navigator.clipboard.writeText(postgresMigrations);
    setCopiedMigration(true);
    setTimeout(() => setCopiedMigration(false), 2000);
  };

  const handleResetDatabase = () => {
    if (confirm('Verify: Reset ALL local ledger tables, accounts, categories, and bills to original seed defaults? This deletes all current custom records permanently.')) {
      db.resetAll();
      alert('Local bookkeeping database reset to default seeds successfully.');
      triggerRefresh();
    }
  };

  const handleExportJSON = () => {
    const data: Record<string, string | null> = {};
    const keys = [
      'qifinance_accounts',
      'qifinance_categories',
      'qifinance_journal_entries',
      'qifinance_journal_lines',
      'qifinance_people',
      'qifinance_debts',
      'qifinance_bills',
      'qifinance_assets',
      'qifinance_import_batches'
    ];

    keys.forEach(key => {
      data[key] = localStorage.getItem(key);
    });

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data, null, 2))}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `qifinance_ledger_export_${new Date().toISOString().substring(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleRestoreJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const files = e.target.files;
    if (!files || files.length === 0) return;

    fileReader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        Object.entries(parsed).forEach(([key, val]) => {
          if (val) localStorage.setItem(key, val as string);
        });
        alert('Ledger persistent tables successfully recovered from JSON backup! Page refreshing.');
        triggerRefresh();
      } catch (err) {
        alert('Invalid backup structure matching expected schema parameters.');
      }
    };
    fileReader.readAsText(files[0]);
  };

  return (
    <div className="space-y-6 animate-fade-in" id="settings_view_block">
       {/* Upper bar */}
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-2 border-b border-gray-100">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 font-sans" id="settings_main_title">
            Private ledger configurations
          </h2>
          <p className="text-xs text-slate-500 font-mono">
            SETUP COPILOTS • SCHEMA EXPORTS & DEPLOYMENT ENGINES
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="settings_grid">
        {/* Left column: Admin utilities (2 columns) */}
        <div className="lg:col-span-2 space-y-6" id="settings_utilities_col">
          
          {/* Box 1: Backup / Restore */}
          <div className="p-5 bg-white border border-gray-150 rounded-xl space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5 font-sans">
                LocalStorage State Backup & Transfers
              </h3>
              <p className="text-xs text-slate-505 font-mono">EXPORT ENTIRE LOCAL LEDGER AS SEGREGATED PORTABLE JSON RECORDS</p>
            </div>

            <div className="flex flex-wrap gap-3 pt-1 text-xs">
              <button 
                onClick={handleExportJSON}
                className="p-2 px-4 bg-slate-100 hover:bg-slate-205 border border-slate-250 text-slate-800 rounded flex items-center gap-1.5 font-semibold cursor-pointer"
                id="btn_export_json"
              >
                <Download className="w-4 h-4 text-slate-600" />
                Download JSON Backup
              </button>

              <label 
                className="p-2 px-4 bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-800 rounded flex items-center gap-1.5 font-semibold cursor-pointer"
                id="lbl_restore_json"
              >
                <Upload className="w-4 h-4 text-slate-600" />
                Upload JSON Backup
                <input 
                  type="file"
                  accept=".json"
                  onChange={handleRestoreJSON}
                  className="hidden"
                />
              </label>

              <button 
                onClick={handleResetDatabase}
                className="p-2 px-4 bg-rose-50 hover:bg-rose-950 hover:text-white border border-rose-100 text-rose-700 transition-all rounded flex items-center gap-1.5 font-semibold ml-auto cursor-pointer"
                id="btn_reset_db"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                Reset database defaults
              </button>
            </div>
          </div>

          {/* Box 2: Supabase Migrations */}
          <div className="p-5 bg-white border border-gray-150 rounded-xl space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5 font-sans">
                  PostgreSQL / Supabase Schema migrations SQL
                </h3>
                <p className="text-xs text-slate-500 font-mono font-sans">PRODUCTION-DEPLOYABLE TABLE RELATIONS WITH ENUMS, TRIGGERS, & CONSTRAINTS</p>
              </div>

              <button 
                onClick={handleCopyMigrations}
                className={`p-1 px-[10px] rounded text-[11px] font-mono leading-none tracking-wider font-extrabold flex items-center gap-1 border transition-all cursor-pointer ${copiedMigration ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-slate-90 bg-slate-100 hover:bg-slate-200 border-slate-250 text-slate-700'}`}
                id="btn_copy_sql"
              >
                <Clipboard className="w-3.5 h-3.5" />
                {copiedMigration ? 'Copied migrations!' : 'Copy SQL Script'}
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-lg font-mono text-[9.5px] text-emerald-400 overflow-x-auto max-h-[190px] border border-slate-800" id="sql_migrations_viewer">
              <pre>{postgresMigrations}</pre>
            </div>
          </div>
        </div>

        {/* Right column: Cloud deployment instructions (1 column) */}
        <div className="space-y-4 font-sans" id="settings_doc_col">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono font-sans">Cloud Infrastructure guides</h3>

          {/* Guide item 1: Cloudflare pages */}
          <div className="p-4 bg-white border border-gray-150 rounded-xl space-y-2">
            <h4 className="text-xs font-bold text-slate-850 flex items-center gap-1.5">
              <Cloud className="w-4 h-4 text-blue-500" />
              Cloudflare Pages Hosting
            </h4>
            <p className="text-[11px] text-slate-500 leading-normal">
              Deploying QiFinance on Cloudflare Pages is incredibly simple:
            </p>
            <ol className="text-[10px] text-slate-600 font-mono list-decimal list-inside space-y-1 bg-slate-50 p-2.5 rounded border border-slate-100">
              <li>Link your GitHub repository in your Cloudflare dashboard.</li>
              <li>Setup target directory build command: <span className="font-bold text-slate-900">npm run build</span>.</li>
              <li>Configure root build outputs directory as: <span className="font-bold text-slate-900">dist</span>.</li>
            </ol>
          </div>

          {/* Guide item 2: Zero Trust */}
          <div className="p-4 bg-white border border-gray-150 rounded-xl space-y-2">
            <h4 className="text-xs font-bold text-slate-850 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-emerald-500" />
              Cloudflare Zero Trust
            </h4>
            <p className="text-[11px] text-slate-500 leading-normal">
              Protect your private database ledger before browser-side credentials loading:
            </p>
            <ol className="text-[10px] text-slate-600 font-mono list-decimal list-inside space-y-1 bg-slate-50 p-2.5 rounded border border-slate-100">
              <li>Establish an Access application in Cloudflare Zero Trust.</li>
              <li>Route to your private build URL.</li>
              <li>Configure rules to only authorize your emails (e.g. your cloud account login verification).</li>
            </ol>
          </div>

          {/* Guide item 3: Supabase setup */}
          <div className="p-4 bg-white border border-gray-150 rounded-xl space-y-2">
            <h4 className="text-xs font-bold text-slate-850 flex items-center gap-1.5">
              <Server className="w-4 h-4 text-orange-500" />
              Supabase SQL integrations
            </h4>
            <p className="text-[11px] text-slate-500 leading-normal">
              Deploy double-entry schemas safely on cloud SQL postgres arrays:
            </p>
            <ol className="text-[10px] text-slate-605 font-mono list-decimal list-inside space-y-1 bg-slate-50 p-2.5 rounded border border-slate-100">
              <li>Open SQL Editor in your Supabase project dashboard.</li>
              <li>Paste the auto-generated Copy SQL Code block.</li>
              <li>Execute to create relational ledger constraints instantly.</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
