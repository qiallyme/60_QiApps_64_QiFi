/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Building2, Plus, WalletCards } from 'lucide-react';
import { qifinanceApi } from '../lib/qifinanceApi';
import { useQiStore } from '../store';

export default function FinancialAccountsView() {
  const { financialAccounts, accounts, refreshData } = useQiStore();
  const [name, setName] = React.useState('');
  const [institution, setInstitution] = React.useState('');
  const [accountMask, setAccountMask] = React.useState('');
  const [accountKind, setAccountKind] = React.useState('checking');
  const [defaultLedgerAccountId, setDefaultLedgerAccountId] = React.useState('ledger-bank-accounts');
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  const handleKindChange = (nextKind: string) => {
    setAccountKind(nextKind);
    if (nextKind === 'credit_card') setDefaultLedgerAccountId('ledger-credit-cards-payable');
    else if (nextKind === 'loan') setDefaultLedgerAccountId('ledger-loans-payable');
    else if (nextKind === 'cash') setDefaultLedgerAccountId('ledger-cash-on-hand');
    else setDefaultLedgerAccountId('ledger-bank-accounts');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    setError('');
    try {
      await qifinanceApi.createFinancialAccount({
        id: `fa-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`,
        name,
        institution,
        accountMask,
        accountKind,
        sourceProvider: 'manual',
        currentBalance: 0,
        currency: 'USD',
        defaultLedgerAccountId,
        isActive: true
      });
      setName('');
      setInstitution('');
      setAccountMask('');
      await refreshData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create financial account.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-zinc-200">
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center justify-center">
            <WalletCards size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white font-display">Financial Accounts</h2>
            <p className="text-xs text-zinc-500">Real bank, card, cash, wallet, and loan accounts</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-3 bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Account name" className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500/60" />
        <input value={institution} onChange={e => setInstitution(e.target.value)} placeholder="Institution" className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500/60" />
        <input value={accountMask} onChange={e => setAccountMask(e.target.value)} placeholder="Mask / last 4" className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500/60" />
        <select value={accountKind} onChange={e => handleKindChange(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500/60">
          <option value="checking">Checking</option>
          <option value="savings">Savings</option>
          <option value="credit_card">Credit Card</option>
          <option value="loan">Loan</option>
          <option value="wallet">Wallet</option>
          <option value="cash">Cash</option>
          <option value="platform">Platform</option>
          <option value="other">Other</option>
        </select>
        <button disabled={isSaving || !name.trim()} className="bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 rounded-lg px-3 py-2 text-sm font-bold flex items-center justify-center gap-2">
          <Plus size={15} />
          Add
        </button>
        <select value={defaultLedgerAccountId} onChange={e => setDefaultLedgerAccountId(e.target.value)} className="md:col-span-5 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500/60">
          {accounts.filter(account => ['asset', 'liability'].includes(account.type)).map(account => (
            <option key={account.id} value={account.id}>{account.code} - {account.name}</option>
          ))}
        </select>
        {error && <div className="md:col-span-5 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2">{error}</div>}
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {financialAccounts.map(account => {
          const defaultLedger = accounts.find(item => item.id === account.defaultLedgerAccountId);
          return (
            <div key={account.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-white">{account.name}</div>
                  <div className="text-xs text-zinc-500">{account.accountKind.replace('_', ' ')}{account.accountMask ? ` / ${account.accountMask}` : ''}</div>
                </div>
                <Building2 size={16} className="text-emerald-300 shrink-0" />
              </div>
              <div className="text-xs text-zinc-400">{account.institution || 'No institution recorded'}</div>
              <div className="text-[11px] text-zinc-500 border-t border-zinc-800 pt-3">
                Default ledger: <span className="text-zinc-300">{defaultLedger ? `${defaultLedger.code} ${defaultLedger.name}` : 'Unmapped'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
