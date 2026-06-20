/**
 * QiFinance Types and Database Structures
 */

export type AccountType =
  | "checking"
  | "savings"
  | "cash"
  | "credit_card"
  | "loan"
  | "asset"
  | "liability"
  | "income"
  | "expense"
  | "equity"
  | "receivable"
  | "payable";

export type JournalEntryStatus = "draft" | "posted" | "voided";
export type DebtType =
  | "owes_me"
  | "i_owe"
  | "disputed"
  | "reimbursement"
  | "claim"
  | "informal_ledger";
export type DebtStatus =
  | "active"
  | "paid"
  | "disputed"
  | "forgiven"
  | "written_off";
export type BillStatus = "upcoming" | "paid" | "overdue" | "cancelled";
export type AssetType =
  | "vehicle"
  | "electronics"
  | "property"
  | "equipment"
  | "cash_value"
  | "other";
export type PersonType =
  | "person"
  | "company"
  | "vendor"
  | "family"
  | "employer"
  | "platform"
  | "agency";

export interface Account {
  id: string;
  name: string;
  account_type: AccountType;
  institution: string;
  last_4: string;
  currency: string;
  opening_balance: number;
  current_balance: number;
  status: "active" | "archived";
  notes: string;
  csv_mapping?: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export type CategoryType =
  | "income"
  | "expense"
  | "equity"
  | "asset"
  | "liability";

export type CategoryName =
  | "income"
  | "food"
  | "rent"
  | "utilities"
  | "gas"
  | "car"
  | "insurance"
  | "medical"
  | "legal"
  | "caregiving"
  | "debt_payment"
  | "reimbursement"
  | "disputed_charge"
  | "business"
  | "personal"
  | "unknown";

export interface Category {
  id: string;
  name: CategoryName;
  parent_category_id: string | null;
  category_type: CategoryType;
  notes: string;
}

export interface JournalEntry {
  id: string;
  entry_date: string; // YYYY-MM-DD
  description: string;
  memo: string;
  source: string; // e.g., "manual", "bill_payment", "debt_payment", "import"
  status: JournalEntryStatus;
  related_person_id: string | null;
  related_bill_id: string | null;
  related_debt_id: string | null;
  related_asset_id: string | null;
  evidence_url: string | null;
  import_batch_id: string | null;
  reversal_for_entry_id?: string | null;
  created_at: string;
  updated_at: string;

  // Custom flags often requested for simplified transaction input
  is_disputed?: boolean;
  is_reimbursable?: boolean;
  needs_review?: boolean;
}

export interface JournalLine {
  id: string;
  journal_entry_id: string;
  account_id: string;
  category_id: string | null;
  debit_amount: number; // positive or 0
  credit_amount: number; // positive or 0
  memo: string;
  created_at: string;
}

export interface Person {
  id: string;
  display_name: string;
  type: PersonType;
  email: string;
  phone: string;
  notes: string;
  status: "active" | "inactive";
}

export interface Debt {
  id: string;
  title: string;
  debt_type: DebtType;
  person_id: string;
  original_amount: number;
  current_balance: number;
  currency: string;
  start_date: string;
  due_date: string | null;
  status: DebtStatus;
  priority: "low" | "medium" | "high";
  notes: string;
  evidence_url: string | null;
}

export interface Bill {
  id: string;
  vendor_id: string | null;
  title: string;
  amount: number;
  due_date: string;
  recurring_frequency: "none" | "weekly" | "biweekly" | "monthly" | "yearly";
  status: BillStatus;
  account_id: string | null; // proposed account to pay from
  category_id: string | null;
  notes: string;
  evidence_url: string | null;
}

export interface Asset {
  id: string;
  name: string;
  asset_type: AssetType;
  purchase_date: string;
  purchase_price: number;
  estimated_value: number;
  account_id: string | null; // connected cash/bank account if relevant
  status: "active" | "disposed";
  notes: string;
  evidence_url: string | null;
}

export interface ImportBatch {
  id: string;
  source_name: string;
  source_account_id: string;
  imported_file_name: string;
  import_date: string;
  status: "draft" | "imported" | "reconciled";
  notes: string;
}

// User-friendly Simple Transaction Form state
export interface SimpleTransactionInput {
  date: string;
  fromAccountId: string; // Account performing the action (Credit side for expense, Debit for income, Credit/Debit for transfers)
  toAccountId: string; // Recipient/Target Account (Debit side for expense, Credit for income, etc.)
  amount: number;
  merchantOrPersonId: string; // Link to Person/Party
  categoryId: string;
  description: string;
  status:
    | "draft"
    | "unreviewed"
    | "reviewed"
    | "confirmed"
    | "needs_evidence"
    | "disputed"
    | "reimbursable"
    | "ignored"
    | "posted";
  receiptUrl: string;
  isDisputed: boolean;
  isReimbursable: boolean;
  notes: string;
  relatedDebtId?: string;
  relatedBillId?: string;
}
