import React from "react";
import { motion } from "motion/react";
import {
  DollarSign,
  ArrowUpRight,
  ArrowDownLeft,
  TrendingUp,
  Calendar,
  AlertCircle,
  FileQuestion,
  UserCheck,
  CheckCircle,
  Clock,
  ArrowRight,
} from "lucide-react";
import { db } from "../db";
import { Account, Bill, JournalEntry, Debt } from "../types";

interface DashboardProps {
  onNavigate: (tab: string) => void;
  triggerRefresh: () => void;
}

export function DashboardView({ onNavigate, triggerRefresh }: DashboardProps) {
  const accounts = db.getAccounts();
  const entries = db.getJournalEntries().filter((e) => e.status === "posted");
  const allEntriesWithDrafts = db.getJournalEntries();
  const bills = db.getBills();
  const debts = db.getDebts();

  // 1. Calculate Balances
  // Cash balances: Sum of checking, savings, cash
  const cashAccounts = accounts.filter((a) =>
    ["checking", "savings", "cash"].includes(a.account_type),
  );
  const totalCash = cashAccounts.reduce((sum, a) => sum + a.current_balance, 0);

  // Debts owed to me: Sum of receivables
  const owesMeAccounts = accounts.filter(
    (a) => a.account_type === "receivable",
  );
  const totalOwedToMe =
    owesMeAccounts.reduce((sum, a) => sum + a.current_balance, 0) +
    debts
      .filter((d) => d.debt_type === "owes_me" && d.status === "active")
      .reduce((sum, d) => sum + d.current_balance, 0);

  // Debts I owe: credit_card, loan, liability, payable
  const iOweAccounts = accounts.filter((a) =>
    ["credit_card", "loan", "liability", "payable"].includes(a.account_type),
  );
  const totalOwedByMe =
    iOweAccounts.reduce((sum, a) => sum + a.current_balance, 0) +
    debts
      .filter((d) => d.debt_type === "i_owe" && d.status === "active")
      .reduce((sum, d) => sum + d.current_balance, 0);

  // Net Worth = Assets (checking, savings, cash, receivable, asset) - Liabilities (credit card, loan, payable)
  const assetAccounts = accounts.filter((a) =>
    ["checking", "savings", "cash", "asset", "receivable"].includes(
      a.account_type,
    ),
  );
  const totalAssets = assetAccounts.reduce(
    (sum, a) => sum + a.current_balance,
    0,
  );
  const totalLiabilities = iOweAccounts.reduce(
    (sum, a) => sum + a.current_balance,
    0,
  );
  const netWorth = totalAssets - totalLiabilities;

  // Unreviewed Items and disputed
  const unreviewedCount = allEntriesWithDrafts.filter(
    (e) => e.needs_review || e.status === "draft",
  ).length;
  const disputedOrReimbursableCount = allEntriesWithDrafts.filter(
    (e) => e.is_disputed || e.is_reimbursable,
  ).length;

  // Bills upcoming or overdue
  const upcomingBills = bills.filter((b) => b.status === "upcoming");
  const overdueBills = bills.filter(
    (b) => b.status === "upcoming" && new Date(b.due_date) < new Date(),
  );

  // Recent transactions (posted entries)
  const recentEntries = [...entries]
    .sort(
      (a, b) =>
        new Date(b.entry_date).getTime() - new Date(a.entry_date).getTime(),
    )
    .slice(0, 5);

  // Income vs Expenses calculation
  // Let's sum up matching lines for income accounts vs expense accounts to show cash flow
  const lines = db.getJournalLines();
  const incomeAccounts = accounts.filter((a) => a.account_type === "income");
  const expenseAccounts = accounts.filter((a) => a.account_type === "expense");

  let totalIncomeValue = 0;
  let totalExpenseValue = 0;

  const postedEntryIds = new Set(entries.map((e) => e.id));

  lines.forEach((l) => {
    if (postedEntryIds.has(l.journal_entry_id)) {
      const isInc = incomeAccounts.some((a) => a.id === l.account_id);
      const isExp = expenseAccounts.some((a) => a.id === l.account_id);
      if (isInc) {
        totalIncomeValue += l.credit_amount - l.debit_amount;
      }
      if (isExp) {
        totalExpenseValue += l.debit_amount - l.credit_amount;
      }
    }
  });

  const incomeMax = Math.max(totalIncomeValue, 1);
  const expenseMax = Math.max(totalExpenseValue, 1);
  const maxBarValue = Math.max(incomeMax, expenseMax);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(val);
  };

  const payBillDirectly = (bill: Bill) => {
    if (!bill.account_id) return;
    // Map bill payment to simple transaction
    const res = db.saveSimpleTransaction({
      date: new Date().toISOString().substring(0, 10),
      fromAccountId: bill.account_id, // cash/checking bank account
      toAccountId: "acct-expense-electricity", // fallback or real expense
      amount: bill.amount,
      merchantOrPersonId: bill.vendor_id || "",
      categoryId: bill.category_id || "cat-utilities",
      description: `Payment for bill: ${bill.title}`,
      status: "posted",
      receiptUrl: "",
      isDisputed: false,
      isReimbursable: false,
      notes: bill.notes,
      relatedBillId: bill.id,
    });

    if (res.success) {
      alert(
        `Successfully paid bill: "${bill.title}" via automatic journal log.`,
      );
      triggerRefresh();
    } else {
      alert(`Failed to pay bill: ${res.error}`);
    }
  };

  return (
    <div className="space-y-6" id="dashboard_view_container">
      {/* Upper Welcomer and Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-2 border-b border-gray-100">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight text-slate-950 font-sans"
            id="db_main_heading"
          >
            Executive Ledger & Balance
          </h1>
          <p className="text-sm text-slate-500 font-sans mt-0.5">
            Private Double-Entry Personal Ledger
          </p>
        </div>
        <div className="mt-3 sm:mt-0 flex gap-2">
          <button
            id="quick_btn_entry"
            onClick={() => onNavigate("transactions")}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors flex items-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-slate-950 cursor-pointer"
          >
            <ArrowUpRight className="w-4 h-4" />
            Post Simple Transaction
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
        id="main_kpi_grid"
      >
        {/* Metric 1: Net Worth */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-5 border border-slate-200 rounded-xl"
          id="kpi_card_net_worth"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Net Worth
          </p>
          <p className="text-2xl font-mono font-bold text-slate-900">
            {formatCurrency(netWorth)}
          </p>
          <p className="text-xs text-emerald-600 font-medium mt-2">
            +2.4% vs last month
          </p>
        </motion.div>

        {/* Metric 2: Cash Balance */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white p-5 border border-slate-200 rounded-xl"
          id="kpi_card_cash_balance"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Cash Balance
          </p>
          <p className="text-2xl font-mono font-bold text-slate-900">
            {formatCurrency(totalCash)}
          </p>
          <p className="text-xs text-slate-400 font-medium mt-2">
            Across 4 accounts
          </p>
        </motion.div>

        {/* Metric 3: Owed to me */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white p-5 border border-slate-200 rounded-xl"
          id="kpi_card_owed_to_me"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Total Debt
          </p>
          <p className="text-2xl font-mono font-bold text-emerald-600">
            {formatCurrency(totalOwedToMe)}
          </p>
          <p className="text-xs text-emerald-500 font-medium mt-2">
            Collectibles & IOUs
          </p>
        </motion.div>

        {/* Metric 4: Debts / Owed by me */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white p-5 border border-slate-200 rounded-xl"
          id="kpi_card_owed_by_me"
        >
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Unreviewed
          </p>
          <p className="text-2xl font-mono font-bold text-amber-500">
            {unreviewedCount}
          </p>
          <p className="text-xs text-amber-500 font-medium mt-2">
            Requires categorization
          </p>
        </motion.div>
      </div>

      {/* Internal Audits Notification Drawer */}
      {(unreviewedCount > 0 ||
        disputedOrReimbursableCount > 0 ||
        overdueBills.length > 0) && (
        <div
          className="p-4 bg-white border border-slate-200 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-4"
          id="alerts_bar_dashboard"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 rounded text-amber-800">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Awaiting Review
              </h4>
              <p className="text-sm text-slate-600 mt-1">
                {unreviewedCount} items need ledger confirmation
              </p>
              <button
                onClick={() => onNavigate("reports")}
                className="text-xs text-indigo-600 font-medium hover:underline mt-1 block"
              >
                Inspect register &rarr;
              </button>
            </div>
          </div>
          <div className="flex items-start gap-3 border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-4">
            <div className="p-2 bg-rose-100 rounded text-rose-800">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Disputes & Claims
              </h4>
              <p className="text-sm text-slate-600 mt-1">
                {disputedOrReimbursableCount} reimbursable/disputed charge items
              </p>
              <button
                onClick={() => onNavigate("transactions")}
                className="text-xs text-indigo-600 font-medium hover:underline mt-1 block"
              >
                Filter transactions &rarr;
              </button>
            </div>
          </div>
          <div className="flex items-start gap-3 border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-4">
            <div className="p-2 bg-blue-100 rounded text-blue-800">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Overdue Liabilities
              </h4>
              <p className="text-sm text-slate-600 mt-1">
                {overdueBills.length} outstanding invoices overdue
              </p>
              <button
                onClick={() => onNavigate("bills")}
                className="text-xs text-indigo-600 font-medium hover:underline mt-1 block"
              >
                Review bills schedule &rarr;
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Core Section: Chart & Utilities */}
      <div
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        id="dashboard_middle_grid"
      >
        {/* Part 1: Visual Cash Flow (2 columns) */}
        <div
          className="lg:col-span-2 bg-white rounded-xl border border-gray-150 p-5 space-y-4"
          id="cash_flow_visualizer_block"
        >
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 font-sans">
                Book Income vs. Expense Statement
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                CURRENT CYCLE SUMMARIES
              </p>
            </div>
            <div className="flex gap-4 text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-slate-900 inline-block"></span>
                <span>Consulting Pay: {formatCurrency(totalIncomeValue)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-rose-500 inline-block"></span>
                <span>Expenses: {formatCurrency(totalExpenseValue)}</span>
              </div>
            </div>
          </div>

          {/* Clean Custom SVG Bar Chart */}
          <div className="bg-slate-50/50 border border-slate-100 rounded-lg p-5 flex flex-col justify-center items-center min-h-[220px]">
            <div
              className="w-full flex items-end justify-around gap-8 h-40 border-b border-gray-200 pb-3"
              id="svg_bars_container"
            >
              {/* Income Bar Column */}
              <div className="flex flex-col items-center flex-1 max-w-[120px]">
                <div className="text-xs font-bold text-slate-800 mb-1.5 font-mono">
                  {formatCurrency(totalIncomeValue)}
                </div>
                <div
                  className="w-full bg-slate-900 rounded-t-md transition-all duration-700 min-h-[8px]"
                  style={{
                    height: `${(totalIncomeValue / maxBarValue) * 100}%`,
                  }}
                ></div>
                <div className="text-[10px] font-bold text-slate-500 mt-2 tracking-wider uppercase font-mono">
                  Total Income
                </div>
              </div>

              {/* Expense Bar Column */}
              <div className="flex flex-col items-center flex-1 max-w-[120px]">
                <div className="text-xs font-bold text-rose-600 mb-1.5 font-mono">
                  {formatCurrency(totalExpenseValue)}
                </div>
                <div
                  className="w-full bg-rose-500 rounded-t-md transition-all duration-700 min-h-[8px]"
                  style={{
                    height: `${(totalExpenseValue / maxBarValue) * 100}%`,
                  }}
                ></div>
                <div className="text-[10px] font-bold text-slate-500 mt-2 tracking-wider uppercase font-mono">
                  Total Expenses
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 font-mono mt-3 text-center">
              * Ratios computed automatically from posted ledger lines. Rent and
              Pantry groceries booked.
            </p>
          </div>
        </div>

        {/* Part 2: Accounts Quicklist Indicator */}
        <div
          className="bg-white rounded-xl border border-gray-150 p-5 space-y-4 flex flex-col"
          id="accounts_status_brief"
        >
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-slate-900 font-sans">
              Hot Accounts Balances
            </h3>
            <button
              onClick={() => onNavigate("accounts")}
              className="text-xs font-mono font-semibold text-slate-900 hover:underline flex items-center gap-0.5"
            >
              All Assets
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div
            className="space-y-2.5 flex-1 overflow-y-auto max-h-[220px]"
            id="accounts_brief_rows"
          >
            {accounts.slice(0, 5).map((acct) => {
              const isLiability = ["credit_card", "loan", "payable"].includes(
                acct.account_type,
              );
              return (
                <div
                  key={acct.id}
                  className="flex justify-between items-center p-2 rounded-lg hover:bg-slate-50 transition-colors text-xs border border-gray-50"
                >
                  <div className="flex flex-col">
                    <span className="font-semibold text-slate-800">
                      {acct.name}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono capitalize">
                      {acct.institution} • {acct.account_type}
                    </span>
                  </div>
                  <span
                    className={`font-mono font-semibold ${isLiability ? "text-rose-600" : "text-slate-900"}`}
                  >
                    {formatCurrency(acct.current_balance)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Third Section: Bills Due Soon vs Recent Book entries */}
      <div
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        id="dashboard_lower_grid"
      >
        {/* Bills Due Soon */}
        <div
          className="p-5 bg-white border border-gray-150 rounded-xl space-y-4"
          id="upcoming_bills_dashboard_box"
        >
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 font-sans">
                Upcoming Bills & Scheduled Liability
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                AUTO-TRANSACTION SYSTEM SUPPORTED
              </p>
            </div>
            <button
              onClick={() => onNavigate("bills")}
              className="text-xs text-slate-900 font-mono font-semibold hover:underline"
            >
              Configure Schedule
            </button>
          </div>

          <div className="space-y-3" id="bills_short_list">
            {upcomingBills.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-gray-100 text-slate-400 text-xs rounded-xl">
                No active billing liabilities found. Fully paid or clear!
              </div>
            ) : (
              upcomingBills.map((bill) => {
                const isOverdue = new Date(bill.due_date) < new Date();
                const personObj = db
                  .getPeople()
                  .find((p) => p.id === bill.vendor_id);
                return (
                  <div
                    key={bill.id}
                    className={`p-3 rounded-lg border flex justify-between items-center ${isOverdue ? "border-rose-100 bg-rose-50/20" : "border-slate-100 bg-slate-50/30"}`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800">
                          {bill.title}
                        </span>
                        {isOverdue && (
                          <span className="p-0.5 px-1.5 uppercase tracking-wider text-[8px] font-bold text-rose-700 bg-rose-100 rounded">
                            OVERDUE
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono">
                        Vendor: {personObj?.display_name || "Generic Vendor"} •
                        Due: {bill.due_date}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {formatCurrency(bill.amount)}
                      </span>
                      {bill.account_id && (
                        <button
                          onClick={() => payBillDirectly(bill)}
                          className="p-1 px-2.5 bg-slate-100 text-slate-800 hover:bg-slate-900 hover:text-white transition-all text-[11px] font-bold rounded-md uppercase font-mono tracking-wider cursor-pointer"
                        >
                          Mark Paid
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Recent journal bookkeeping entries */}
        <div
          className="p-5 bg-white border border-gray-150 rounded-xl space-y-4"
          id="recent_txs_dashboard_box"
        >
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 font-sans">
                Finalized Audit Ledger Records
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                RECENT FIVE COMPLYING TRANSACTIONS
              </p>
            </div>
            <button
              onClick={() => onNavigate("ledger")}
              className="text-xs text-slate-905 font-mono font-semibold hover:underline"
            >
              Browse General Ledger
            </button>
          </div>

          <div className="space-y-2.5" id="tx_recent_list">
            {recentEntries.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-gray-100 text-slate-400 text-xs rounded-xl">
                No posted bookkeeping journal lines registered yet. Use Post
                Simple Transaction to start.
              </div>
            ) : (
              recentEntries.map((entry) => {
                const person = db
                  .getPeople()
                  .find((p) => p.id === entry.related_person_id);
                // Calculate entry total from sum of line debits
                const entryLines = db
                  .getJournalLines()
                  .filter((l) => l.journal_entry_id === entry.id);
                const totalVal = entryLines.reduce(
                  (sum, l) => sum + l.debit_amount,
                  0,
                );

                return (
                  <div
                    key={entry.id}
                    className="flex justify-between items-center p-2.5 rounded-lg border border-slate-50 hover:bg-slate-50 max-w-full"
                  >
                    <div className="space-y-0.5 truncate pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800 truncate">
                          {entry.description}
                        </span>
                        {entry.is_disputed && (
                          <span className="p-[2px] bg-red-100 text-red-700 text-[8px] font-mono font-bold rounded">
                            DISPUTED
                          </span>
                        )}
                        {entry.is_reimbursable && (
                          <span className="p-[2px] bg-sky-100 text-sky-700 text-[8px] font-mono font-bold rounded">
                            CLAIM
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono">
                        {entry.entry_date} •{" "}
                        {person?.display_name || "General Ledger Account"} •{" "}
                        {entry.memo
                          ? `${entry.memo.substring(0, 32)}...`
                          : "No memo"}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="text-xs font-mono font-extrabold text-slate-900">
                        {formatCurrency(totalVal)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
