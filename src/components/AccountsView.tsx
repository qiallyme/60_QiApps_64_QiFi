import React, { useState } from "react";
import { db } from "../db";
import { Account, AccountType } from "../types";
import {
  Building,
  Plus,
  Search,
  Trash2,
  BookOpen,
  Coins,
  HelpCircle,
  FileText,
  AlertCircle,
  Download,
} from "lucide-react";
import { ImportCSVModal } from "./ImportCSVModal";

interface AccountsViewProps {
  triggerRefresh: () => void;
}

export function AccountsView({ triggerRefresh }: AccountsViewProps) {
  const accounts = db.getAccounts();
  const journalLines = db.getJournalLines();
  const journalEntries = db
    .getJournalEntries()
    .filter((e) => e.status === "posted");

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [importAccount, setImportAccount] = useState<Account | null>(null);

  // Creation/Edit states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("checking");
  const [institution, setInstitution] = useState("");
  const [last4, setLast4] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [openingBalance, setOpeningBalance] = useState(0);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"active" | "archived">("active");

  const accountTypesList: AccountType[] = [
    "checking",
    "savings",
    "cash",
    "credit_card",
    "loan",
    "asset",
    "liability",
    "income",
    "expense",
    "equity",
    "receivable",
    "payable",
  ];

  const handleEdit = (acct: Account) => {
    setId(acct.id);
    setName(acct.name);
    setAccountType(acct.account_type);
    setInstitution(acct.institution);
    setLast4(acct.last_4);
    setCurrency(acct.currency);
    setOpeningBalance(acct.opening_balance);
    setNotes(acct.notes);
    setStatus(acct.status);
    setIsFormOpen(true);
  };

  const handleCreateNew = () => {
    setId("");
    setName("");
    setAccountType("checking");
    setInstitution("");
    setLast4("");
    setCurrency("USD");
    setOpeningBalance(0);
    setNotes("");
    setStatus("active");
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return alert("Please enter a descriptive account name.");

    const preparedId =
      id || `acct-${Math.random().toString(36).substring(2, 9)}`;

    db.saveAccount({
      id: preparedId,
      name,
      account_type: accountType,
      institution: institution || "Self",
      last_4: last4 || "0000",
      currency,
      opening_balance: Number(openingBalance),
      current_balance: Number(openingBalance), // dynamic recomputed later
      status,
      notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    setIsFormOpen(false);
    triggerRefresh();
  };

  // Filter accounts
  const filteredAccounts = accounts.filter(
    (acct) =>
      acct.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acct.institution.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acct.account_type.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Compute Lines related to Selected Account for register view
  const registerLines = selectedAccount
    ? journalLines
        .filter((l) => {
          const entry = journalEntries.find((e) => e.id === l.journal_entry_id);
          return l.account_id === selectedAccount.id && entry;
        })
        .map((l) => {
          const entry = journalEntries.find(
            (e) => e.id === l.journal_entry_id,
          )!;
          return {
            ...l,
            entry_date: entry.entry_date,
            description: entry.description,
            status: entry.status,
          };
        })
        .sort(
          (a, b) =>
            new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime(),
        )
    : [];

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(val);
  };

  return (
    <div className="space-y-6" id="accounts_view_block">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-2 border-b border-gray-100">
        <div>
          <h2
            className="text-xl font-bold tracking-tight text-slate-900 font-sans"
            id="accounts_main_title"
          >
            Chart of Accounts & Ledger Assets
          </h2>
          <p className="text-xs text-slate-500 font-mono">
            BALANCES DERIVED FROM VERIFIED TRANSACTION DOUBLE-ENTRY AUDITS
          </p>
        </div>
        <button
          onClick={handleCreateNew}
          className="mt-3 sm:mt-0 flex items-center gap-1.5 px-4 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-sm font-sans focus:outline-none cursor-pointer"
          id="btn_add_account"
        >
          <Plus className="w-4 h-4" />
          Add Chart Account
        </button>
      </div>

      {/* Main double column split */}
      <div
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        id="accounts_main_layout"
      >
        {/* Left Side: Accounts List (2 Columns or full depending on selection) */}
        <div
          className={`space-y-4 lg:col-span-2 ${selectedAccount ? "" : "lg:col-span-3"}`}
          id="accounts_master_panel"
        >
          {/* Search bar info */}
          <div className="flex items-center gap-2 bg-white p-3 rounded-lg border border-gray-150">
            <Search className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search Chart accounts by name, type, or institution..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs text-slate-800 placeholder-slate-400 focus:outline-none flex-1 border-none bg-transparent"
              id="accounts_search_field"
            />
          </div>

          <div
            className="bg-white border border-slate-200 rounded-xl overflow-hidden"
            id="accounts_cards_grid"
          >
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 font-bold">
                <tr>
                  <th className="px-4 py-3 border-b border-slate-200">Name</th>
                  <th className="px-4 py-3 border-b border-slate-200">
                    Institution
                  </th>
                  <th className="px-4 py-3 border-b border-slate-200">Type</th>
                  <th className="px-4 py-3 border-b border-slate-200 text-right">
                    Opening
                  </th>
                  <th className="px-4 py-3 border-b border-slate-200 text-right">
                    Current
                  </th>
                  <th className="px-4 py-3 border-b border-slate-200 text-center">
                    Status
                  </th>
                  <th className="px-4 py-3 border-b border-slate-200 text-center">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No matching accounts discovered.
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((acct) => {
                    const isActive = acct.status === "active";
                    const isSelected = selectedAccount?.id === acct.id;

                    return (
                      <tr
                        key={acct.id}
                        className={`${isSelected ? "bg-indigo-50/50" : "hover:bg-slate-50"}`}
                      >
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {acct.name}
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-[10px] uppercase tracking-wider">
                          {acct.institution}
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-mono text-[10px] uppercase">
                          {acct.account_type}
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          {formatCurrency(acct.opening_balance)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(acct.current_balance)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}
                          >
                            {acct.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() =>
                                setSelectedAccount(isSelected ? null : acct)
                              }
                              className="text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              Register
                            </button>
                            <button
                              onClick={() => setImportAccount(acct)}
                              className="text-emerald-600 hover:text-emerald-800 font-medium"
                            >
                              Import
                            </button>
                            <button
                              onClick={() => handleEdit(acct)}
                              className="text-slate-500 hover:text-slate-800 font-medium"
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div
            className="bg-white border border-slate-200 rounded-xl overflow-hidden mt-8"
            id="categories_cards_grid"
          >
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800">
                Categories (Nominal Accounts)
              </h3>
            </div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500 font-bold">
                <tr>
                  <th className="px-4 py-3 border-b border-slate-200">Name</th>
                  <th className="px-4 py-3 border-b border-slate-200">Type</th>
                  <th className="px-4 py-3 border-b border-slate-200">
                    Description / Notes
                  </th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-100">
                {db.getCategories().map((cat) => (
                  <tr key={cat.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900 capitalize">
                      {cat.name.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-[10px] uppercase">
                      {cat.category_type}
                    </td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">
                      {cat.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side / Detached Section: Account Ledger Register */}
        {selectedAccount && (
          <div
            className="bg-white rounded-xl border border-blue-100 p-5 space-y-4 lg:col-span-3 transition-all"
            id="accounts_register_detail"
          >
            <div className="flex justify-between items-start border-b border-gray-100 pb-3">
              <div>
                <span className="text-xs font-bold font-mono text-blue-700 uppercase">
                  Journal Ledger Register
                </span>
                <h3 className="text-base font-bold text-slate-900 font-sans mt-1">
                  {selectedAccount.name} History
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  All posted balanced double-entry listings involving this
                  account ID.
                </p>
              </div>
              <button
                onClick={() => setSelectedAccount(null)}
                className="text-xs font-bold text-slate-500 hover:text-slate-900 uppercase font-mono tracking-wider cursor-pointer"
                id="btn_close_register"
              >
                Close Register [esc]
              </button>
            </div>

            <div
              className="overflow-x-auto max-h-[300px]"
              id="register_table_container"
            >
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-100 text-slate-400 font-mono text-[10px] uppercase">
                    <th className="p-2.5">Post Date</th>
                    <th className="p-2.5">Journal Description</th>
                    <th className="p-2.5 text-right font-mono">Debit (+)</th>
                    <th className="p-2.5 text-right font-mono">Credit (-)</th>
                    <th className="p-2.5 text-right">Related Audit ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {registerLines.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-8 text-center text-slate-400 font-sans"
                      >
                        No transactions have been posted to this account since
                        opening balance setup.
                      </td>
                    </tr>
                  ) : (
                    registerLines.map((line) => (
                      <tr key={line.id} className="hover:bg-slate-50/50">
                        <td className="p-2.5 font-mono text-slate-650">
                          {line.entry_date}
                        </td>
                        <td className="p-2.5">
                          <p className="font-semibold text-slate-800">
                            {line.description}
                          </p>
                          {line.memo && (
                            <span className="text-[10px] text-slate-400 font-mono italic">
                              {line.memo}
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-right font-mono text-emerald-700 font-bold">
                          {line.debit_amount > 0
                            ? formatCurrency(line.debit_amount)
                            : "—"}
                        </td>
                        <td className="p-2.5 text-right font-mono text-rose-600 font-semibold">
                          {line.credit_amount > 0
                            ? formatCurrency(line.credit_amount)
                            : "—"}
                        </td>
                        <td className="p-2.5 text-right font-mono text-slate-400 text-[10px]">
                          #{line.journal_entry_id.substring(0, 8)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Account Add/Edit Drawer Modal */}
      {isFormOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
          id="accounts_modal_overlay"
        >
          <div
            className="bg-white rounded-xl shadow-lg border border-slate-300 w-full max-w-lg overflow-hidden animate-fade-in"
            id="accounts_modal_content"
          >
            <div className="p-4 bg-slate-950 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold tracking-tight uppercase font-mono">
                  {id ? "Modify Ledger Account" : "Draft New Ledger Account"}
                </h3>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-white font-mono text-xs cursor-pointer"
                id="btn_modal_cancel_upper"
              >
                Close (✖)
              </button>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-5 space-y-4"
              id="accounts_modal_form"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">
                    Account Display Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Chase Everyday Checking"
                    className="w-full p-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                    id="modal_acct_name"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">
                    Account Type
                  </label>
                  <select
                    value={accountType}
                    onChange={(e) =>
                      setAccountType(e.target.value as AccountType)
                    }
                    className="w-full p-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                    id="modal_acct_type"
                  >
                    {accountTypesList.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">
                    Institution Company
                  </label>
                  <input
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="e.g., JPMorgan Chase"
                    className="w-full p-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                    id="modal_acct_inst"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">
                    Last 4 Digits
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    value={last4}
                    onChange={(e) => setLast4(e.target.value)}
                    placeholder="e.g., 2004"
                    className="w-full p-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                    id="modal_acct_last4"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">
                    Currency Code
                  </label>
                  <input
                    type="text"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full p-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                    id="modal_acct_currency"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">
                    Opening Base Balance ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(Number(e.target.value))}
                    className="w-full p-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900"
                    id="modal_acct_open"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as "active" | "archived")
                    }
                    className="w-full p-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                    id="modal_acct_status"
                  >
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono mb-1">
                    Explanatory Memo Logs
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Brief notes detailing the specific utility of this chart line..."
                    className="w-full p-2 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-slate-900 h-16 resize-none"
                    id="modal_acct_notes"
                  />
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-blue-50/50 border border-blue-100 rounded-lg text-blue-900 text-[11px] font-sans">
                <AlertCircle className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
                <p>
                  <strong>Relational Integrity:</strong> Modifying the opening
                  balance shifts all downstream calculations instantly. The
                  transaction journal registers are preserved completely.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 text-xs">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="p-2 px-4 border border-slate-200 rounded hover:bg-slate-55 transition-colors font-semibold"
                  id="btn_modal_cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="p-2 px-5 bg-slate-900 text-white hover:bg-slate-800 transition-colors rounded font-bold cursor-pointer"
                  id="btn_modal_submit"
                >
                  Submit Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {importAccount && (
        <ImportCSVModal
          account={importAccount}
          onClose={() => setImportAccount(null)}
          onSuccess={() => {
            setImportAccount(null);
            triggerRefresh(); // Refresh parent states
          }}
        />
      )}
    </div>
  );
}
