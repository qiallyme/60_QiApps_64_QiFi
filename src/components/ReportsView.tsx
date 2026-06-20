import React, { useState } from "react";
import { db } from "../db";
import {
  FileText,
  Layers,
  ShieldAlert,
  CheckSquare,
  BookOpen,
  AlertTriangle,
  FileSpreadsheet,
  DollarSign,
} from "lucide-react";
import { Account, JournalLine, JournalEntry } from "../types";

export function ReportsView() {
  const [activeReportTab, setActiveReportTab] = useState<
    "trial" | "balance_sheet" | "income" | "audit_review"
  >("balance_sheet");

  const accounts = db.getAccounts();
  const entries = db.getJournalEntries();
  const lines = db.getJournalLines();
  const people = db.getPeople();

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(val);
  };

  // 1. TRIAL BALANCE calculations
  // Sum of total Debit movements vs Credit movements for each account to prove equilibrium
  const trialData = accounts.map((acct) => {
    let debitSum = 0;
    let creditSum = 0;

    // Sum only posted entries lines
    const postedEntries = entries.filter((e) => e.status === "posted");
    const postedIds = new Set(postedEntries.map((e) => e.id));

    lines.forEach((l) => {
      if (l.account_id === acct.id && postedIds.has(l.journal_entry_id)) {
        debitSum += l.debit_amount;
        creditSum += l.credit_amount;
      }
    });

    return {
      account: acct,
      debit: debitSum,
      credit: creditSum,
    };
  });

  const trialTotalDebit = trialData.reduce((sum, d) => sum + d.debit, 0);
  const trialTotalCredit = trialData.reduce((sum, d) => sum + d.credit, 0);

  // 2. BALANCE SHEET calculations
  // Group Assets and Liabilities
  // Normal asset types list
  const assetTypes = ["checking", "savings", "cash", "asset", "receivable"];
  const liabilityTypes = ["credit_card", "loan", "liability", "payable"];

  const balanceSheetAssets = accounts.filter((a) =>
    assetTypes.includes(a.account_type),
  );
  const balanceSheetLiabilities = accounts.filter((a) =>
    liabilityTypes.includes(a.account_type),
  );

  const totalAssets = balanceSheetAssets.reduce(
    (sum, a) => sum + a.current_balance,
    0,
  );
  const totalLiabilities = balanceSheetLiabilities.reduce(
    (sum, a) => sum + a.current_balance,
    0,
  );

  // Equity normal-credit balance = opening assets minus opening liabilities plus retained earnings
  const balanceSheetEquity = totalAssets - totalLiabilities;

  // 3. INCOME STATEMENT / Profit & Loss
  // Revenues (Consulting Income, other income types) minus expenses (food, rent, utility matching)
  const incomeAccounts = accounts.filter((a) => a.account_type === "income");
  const expenseAccounts = accounts.filter((a) => a.account_type === "expense");

  const revenueSum = incomeAccounts.reduce(
    (sum, a) => sum + a.current_balance,
    0,
  );
  const expenseSum = expenseAccounts.reduce(
    (sum, a) => sum + a.current_balance,
    0,
  );
  const netIncome = revenueSum - expenseSum;

  // 4. AUDIT & CONFIRMATIONS REGISTER data selection
  const [auditDateStart, setAuditDateStart] = useState<string>("");
  const [auditDateEnd, setAuditDateEnd] = useState<string>("");
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<string>("all");

  const categories = db.getCategories();

  const allEntriesMissingEvidence = entries.filter((e) => {
    if (e.evidence_url) return false;
    if (auditDateStart && new Date(e.entry_date) < new Date(auditDateStart))
      return false;
    if (auditDateEnd && new Date(e.entry_date) > new Date(auditDateEnd))
      return false;
    if (auditCategoryFilter !== "all") {
      const entryLines = lines.filter((l) => l.journal_entry_id === e.id);
      if (
        !entryLines.some(
          (l) => l.category_id === auditCategoryFilter && l.debit_amount > 0,
        )
      )
        return false;
    }
    // "where an evidence_url is expected" - assume posted transactions?
    if (e.status === "draft") return false;
    return true;
  });

  const unreviewedTransactions = entries.filter(
    (e) => e.needs_review || e.status === "draft",
  );
  const disputedTransactions = entries.filter(
    (e) => e.is_disputed || e.is_reimbursable,
  );

  return (
    <div className="space-y-6" id="reports_view_container">
      {/* Upper header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-2 border-b border-gray-100 pb-4">
        <div>
          <h2
            className="text-xl font-bold tracking-tight text-slate-900 font-sans"
            id="reports_main_title"
          >
            Financial & Audit Ledger Statements
          </h2>
          <p className="text-xs text-slate-500 font-mono">
            REAL TIME LEDGER EXTRACTS COMPILING PROFIT, SOLVENCY &
            RECONCILIATION ACCURACY
          </p>
        </div>
      </div>

      {/* Reports Tabs Menu */}
      <div
        className="flex flex-wrap gap-2.5 border-b border-gray-150 pb-2 text-xs font-bold uppercase font-mono tracking-wider w-full"
        id="reports_tabs_menu"
      >
        <button
          onClick={() => setActiveReportTab("balance_sheet")}
          className={`p-2 px-4 rounded-lg flex items-center gap-1.5 cursor-pointer ${activeReportTab === "balance_sheet" ? "bg-slate-900 text-white" : "hover:bg-slate-50 text-slate-700"}`}
          id="btn_report_tab_bs"
        >
          <Layers className="w-3.5 h-3.5" />
          Balance Sheet
        </button>

        <button
          onClick={() => setActiveReportTab("income")}
          className={`p-2 px-4 rounded-lg flex items-center gap-1.5 cursor-pointer ${activeReportTab === "income" ? "bg-slate-900 text-white" : "hover:bg-slate-50 text-slate-700"}`}
          id="btn_report_tab_is"
        >
          <FileText className="w-3.5 h-3.5" />
          P&L / Income Statement
        </button>

        <button
          onClick={() => setActiveReportTab("trial")}
          className={`p-2 px-4 rounded-lg flex items-center gap-1.5 cursor-pointer ${activeReportTab === "trial" ? "bg-slate-900 text-white" : "hover:bg-slate-50 text-slate-700"}`}
          id="btn_report_tab_trial"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          Trial Balance
        </button>

        <button
          onClick={() => setActiveReportTab("audit_review")}
          className={`p-2 px-4 rounded-lg flex items-center gap-1.5 cursor-pointer ${activeReportTab === "audit_review" ? "bg-slate-900 text-white" : "hover:bg-slate-50 text-text-slate-700"}`}
          id="btn_report_tab_audit"
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          Audit & Confirmations
        </button>
      </div>

      {/* TAB CONTENTS */}
      <div
        className="bg-white rounded-xl border border-gray-150 p-6 shadow-xs min-h-[300px]"
        id="reports_content_box"
      >
        {/* Balance Sheet Statement */}
        {activeReportTab === "balance_sheet" && (
          <div className="space-y-4 max-w-3xl mx-auto" id="report_statement_bs">
            <div className="text-center border-b border-gray-100 pb-4 space-y-1">
              <h3 className="text-sm font-black font-mono tracking-widest uppercase text-slate-800">
                QiFinance Private Balance Sheet Statement
              </h3>
              <p className="text-[10px] text-slate-450 font-mono">
                PREPARED RETROACTIVELY FOR ALL TRANSACTIONS GENERATED
              </p>
            </div>

            <div className="space-y-4 font-sans text-xs" id="bs_tables">
              {/* Assets Group */}
              <div className="space-y-2">
                <h4 className="font-extrabold uppercase font-mono text-[10px] text-slate-500 border-b border-gray-100 pb-1">
                  A. Current & non-current Assets
                </h4>
                <div className="space-y-1 pl-2">
                  {balanceSheetAssets.map((acct) => (
                    <div
                      key={acct.id}
                      className="flex justify-between py-1 border-b border-dashed border-slate-50 text-slate-805"
                    >
                      <span>{acct.name}</span>
                      <span className="font-mono">
                        {formatCurrency(acct.current_balance)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-extrabold text-slate-950 pl-2 pt-1">
                  <span>Total Capital Assets</span>
                  <span className="font-mono">
                    {formatCurrency(totalAssets)}
                  </span>
                </div>
              </div>

              {/* Liabilities Group */}
              <div className="space-y-2 pt-2">
                <h4 className="font-extrabold uppercase font-mono text-[10px] text-slate-500 border-b border-gray-100 pb-1">
                  B. Total Liabilities & Payables
                </h4>
                <div className="space-y-1 pl-2">
                  {balanceSheetLiabilities.map((acct) => (
                    <div
                      key={acct.id}
                      className="flex justify-between py-1 border-b border-dashed border-slate-100 text-slate-805"
                    >
                      <span>{acct.name}</span>
                      <span className="font-mono">
                        {formatCurrency(acct.current_balance)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-extrabold text-slate-950 pl-2 pt-1 border-b border-gray-100 pb-2">
                  <span>Total Book Liabilities</span>
                  <span className="font-mono text-rose-600">
                    {formatCurrency(totalLiabilities)}
                  </span>
                </div>
              </div>

              {/* Equity calculation */}
              <div className="space-y-2 pt-2">
                <h4 className="font-extrabold uppercase font-mono text-[10px] text-slate-500 border-b border-gray-100 pb-1">
                  C. Retained owner Equity
                </h4>
                <div className="flex justify-between font-extrabold text-slate-950 pl-2 pt-1">
                  <span>Owner Capital Solvency (Assets - Liabilities)</span>
                  <span className="font-mono text-emerald-850">
                    {formatCurrency(balanceSheetEquity)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Profit and Loss / Income Statement */}
        {activeReportTab === "income" && (
          <div className="space-y-4 max-w-3xl mx-auto" id="report_statement_is">
            <div className="text-center border-b border-gray-100 pb-4 space-y-1">
              <h3 className="text-sm font-black font-mono tracking-widest uppercase text-slate-800">
                Income profit and loss summary
              </h3>
              <p className="text-[10px] text-slate-450 font-mono">
                FOR CURRENT REPORTING YEAR BOOK ACTIVITY
              </p>
            </div>

            <div className="space-y-5 text-xs text-slate-800" id="is_tables">
              {/* Category: Revenue */}
              <div className="space-y-2">
                <h4 className="font-extrabold uppercase font-mono text-[10px] text-slate-500 border-b border-gray-100 pb-1">
                  1. Gross Revenue consultings
                </h4>
                <div className="space-y-1 pl-2">
                  {incomeAccounts.map((acct) => (
                    <div
                      key={acct.id}
                      className="flex justify-between py-1 text-slate-800"
                    >
                      <span>{acct.name}</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {formatCurrency(acct.current_balance)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-extrabold text-slate-950 pl-2 pt-1">
                  <span>Total Operating Revenue</span>
                  <span className="font-mono">
                    {formatCurrency(revenueSum)}
                  </span>
                </div>
              </div>

              {/* Category: Expenditures */}
              <div className="space-y-2">
                <h4 className="font-extrabold uppercase font-mono text-[10px] text-slate-500 border-b border-gray-100 pb-1">
                  2. Detailed expenditures
                </h4>
                <div className="space-y-1 pl-2">
                  {expenseAccounts.map((acct) => (
                    <div
                      key={acct.id}
                      className="flex justify-between py-1 border-b border-dashed border-slate-100"
                    >
                      <span>{acct.name}</span>
                      <span className="font-mono">
                        {formatCurrency(acct.current_balance)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between font-extrabold text-slate-950 pl-2 pt-1 border-b border-gray-100 pb-2">
                  <span>Total Operating Expenses</span>
                  <span className="font-mono text-rose-600">
                    {formatCurrency(expenseSum)}
                  </span>
                </div>
              </div>

              {/* Net profits */}
              <div className="flex justify-between font-extrabold text-slate-950 pl-2 pt-2 text-sm">
                <span>Book Net Income Profit (Loss)</span>
                <span
                  className={`font-mono ${netIncome >= 0 ? "text-emerald-850" : "text-rose-700"}`}
                >
                  {formatCurrency(netIncome)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Trial Balance Statement */}
        {activeReportTab === "trial" && (
          <div className="space-y-4" id="report_statement_trial">
            <div className="text-center border-b border-gray-100 pb-4 space-y-1">
              <h3 className="text-sm font-black font-mono tracking-widest uppercase text-slate-805">
                Bookkeeping Trial Balance verification
              </h3>
              <p className="text-[10px] text-slate-450 font-mono">
                TRIAL TOTALS MUST HARMONIZE EXACTLY BEFORE AUDITING
              </p>
            </div>

            <div className="overflow-x-auto text-xs" id="trial_balance_table">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[9px] uppercase font-mono text-slate-400 border-b border-slate-150">
                    <th className="p-2.5 pl-4">GL account code</th>
                    <th className="p-2.5">Account class</th>
                    <th className="p-2.5 text-right pr-6 font-mono">
                      debits sum (+)
                    </th>
                    <th className="p-2.5 text-right pr-4 font-mono">
                      credits sum (-)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-[11px] font-sans">
                  {trialData.map((d) => (
                    <tr key={d.account.id} className="hover:bg-slate-50/50">
                      <td className="p-2.5 pl-4 font-bold text-slate-700">
                        {d.account.name}
                      </td>
                      <td className="p-2.5 capitalize">
                        {d.account.account_type}
                      </td>
                      <td className="p-2.5 text-right pr-6 font-mono text-emerald-800 font-bold">
                        {d.debit > 0 ? formatCurrency(d.debit) : "—"}
                      </td>
                      <td className="p-2.5 text-right pr-4 font-mono text-rose-700 font-semibold">
                        {d.credit > 0 ? formatCurrency(d.credit) : "—"}
                      </td>
                    </tr>
                  ))}

                  {/* Ledger Trial total sum row */}
                  <tr className="bg-slate-950 text-white font-mono font-extrabold">
                    <td colSpan={2} className="p-3 pl-4 rounded-l-md">
                      TRIAL BALANCE BALANCER INTEGRITY
                    </td>
                    <td className="p-3 text-right pr-6 text-emerald-300">
                      {formatCurrency(trialTotalDebit)}
                    </td>
                    <td className="p-3 text-right pr-4 text-rose-300 rounded-r-md">
                      {formatCurrency(trialTotalCredit)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {Math.abs(trialTotalDebit - trialTotalCredit) < 0.02 ? (
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-800 text-[11px] font-mono flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-emerald-700" />
                <span>
                  Verification Success: Double-entry equations match perfectly.
                  Trial balance delta: $0.00
                </span>
              </div>
            ) : (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-700" />
                <span>
                  Validation Failure: Out of equilibrium by{" "}
                  {formatCurrency(Math.abs(trialTotalDebit - trialTotalCredit))}
                  . Review Ledger adjustment history.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Audit & Confirmations review panel */}
        {activeReportTab === "audit_review" && (
          <div className="space-y-6" id="report_statement_audit">
            <div className="text-center border-b border-gray-100 pb-4 space-y-1">
              <h3 className="text-sm font-black font-mono tracking-widest uppercase text-slate-805">
                Audit & Compliance Reports
              </h3>
              <p className="text-[10px] text-slate-450 font-mono">
                MISSING EVIDENCE & UNREVIEWED TRANSACTIONS
              </p>
            </div>

            {/* Split sub-rows mapping */}
            <div
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
              id="audit_grid"
            >
              {/* Box 1: Missing Evidence Report */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
                <div className="flex justify-between items-start">
                  <h4 className="text-[10px] font-bold font-mono uppercase tracking-wider text-slate-500 border-b pb-1.5 flex items-center gap-1 w-full">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    Missing Evidence Report ({allEntriesMissingEvidence.length})
                  </h4>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-slate-500 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={auditDateStart}
                      onChange={(e) => setAuditDateStart(e.target.value)}
                      className="w-full p-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-mono text-slate-500 mb-1">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={auditDateEnd}
                      onChange={(e) => setAuditDateEnd(e.target.value)}
                      className="w-full p-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] uppercase font-mono text-slate-500 mb-1">
                      Category (Debited)
                    </label>
                    <select
                      value={auditCategoryFilter}
                      onChange={(e) => setAuditCategoryFilter(e.target.value)}
                      className="w-full p-1.5 border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500 outline-none"
                    >
                      <option value="all">All Categories</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div
                  className="space-y-2 max-h-[300px] overflow-y-auto"
                  id="audit_missing_ev_list"
                >
                  {allEntriesMissingEvidence.length === 0 ? (
                    <div className="text-xs text-center text-slate-400 p-4 font-mono">
                      No matching records.
                    </div>
                  ) : (
                    allEntriesMissingEvidence.map((e) => (
                      <div
                        key={e.id}
                        className="p-2 bg-white rounded border text-[11px] text-slate-800"
                      >
                        <p className="font-bold truncate text-slate-900">
                          {e.description}
                        </p>
                        <p className="text-[9px] text-slate-450 font-mono mt-0.5">
                          Date: {e.entry_date} • Ref: #{e.id.substring(0, 8)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-6">
                {/* Box 2: Transactions pending Review */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="text-[10px] font-bold font-mono uppercase tracking-wider text-slate-500 border-b pb-1.5 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-blue-500" />
                    Unreviewed registers ({unreviewedTransactions.length})
                  </h4>
                  <div
                    className="space-y-2 max-h-[140px] overflow-y-auto"
                    id="audit_unreviewed_list"
                  >
                    {unreviewedTransactions.map((e) => (
                      <div
                        key={e.id}
                        className="p-2 bg-white rounded border text-[11px] text-slate-850"
                      >
                        <p className="font-bold truncate">{e.description}</p>
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                          Status: {e.status} • Ref: #{e.id.substring(0, 8)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Box 3: Disputed or reimbursement items */}
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="text-[10px] font-bold font-mono uppercase tracking-wider text-slate-500 border-b pb-1.5 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                    Active Dispute/Claims ({disputedTransactions.length})
                  </h4>
                  <div
                    className="space-y-2 max-h-[140px] overflow-y-auto"
                    id="audit_disputes_list"
                  >
                    {disputedTransactions.map((e) => (
                      <div
                        key={e.id}
                        className="p-2 bg-white rounded border text-[11px] text-slate-850"
                      >
                        <p className="font-bold truncate">{e.description}</p>
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">
                          {e.is_disputed
                            ? "Disputed charge"
                            : "reimbursable claim"}{" "}
                          • Date: {e.entry_date}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
