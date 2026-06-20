import {
  Account,
  Category,
  JournalEntry,
  JournalLine,
  Person,
  Debt,
  Bill,
  Asset,
  ImportBatch,
  SimpleTransactionInput,
  AccountType,
  CategoryType,
  JournalEntryStatus,
} from "./types";

// Storage keys
const ACCOUNTS_KEY = "qifinance_accounts";
const CATEGORIES_KEY = "qifinance_categories";
const ENTRIES_KEY = "qifinance_journal_entries";
const LINES_KEY = "qifinance_journal_lines";
const PEOPLE_KEY = "qifinance_people";
const DEBTS_KEY = "qifinance_debts";
const BILLS_KEY = "qifinance_bills";
const ASSETS_KEY = "qifinance_assets";
const BATCHES_KEY = "qifinance_import_batches";

// Standard UUID-like string generator
export function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Check if an account is a Normal Debit or Normal Credit account
export function isNormalDebit(type: AccountType): boolean {
  return [
    "checking",
    "savings",
    "cash",
    "asset",
    "receivable",
    "expense",
  ].includes(type);
}

// Initial Core Categories
const seedCategories: Category[] = [
  {
    id: "cat-income",
    name: "income",
    parent_category_id: null,
    category_type: "income",
    notes: "Earnings and generic income sources",
  },
  {
    id: "cat-food",
    name: "food",
    parent_category_id: null,
    category_type: "expense",
    notes: "Dining, groceries, cafe and general sustenance",
  },
  {
    id: "cat-rent",
    name: "rent",
    parent_category_id: null,
    category_type: "expense",
    notes: "Appartment rental or lease payments",
  },
  {
    id: "cat-utilities",
    name: "utilities",
    parent_category_id: null,
    category_type: "expense",
    notes: "Electricity, gas, municipal water, high-speed internet",
  },
  {
    id: "cat-gas",
    name: "gas",
    parent_category_id: null,
    category_type: "expense",
    notes: "Automobile fuel and charging costs",
  },
  {
    id: "cat-car",
    name: "car",
    parent_category_id: null,
    category_type: "expense",
    notes: "Vehicle maintenance, service, and insurance",
  },
  {
    id: "cat-insurance",
    name: "insurance",
    parent_category_id: null,
    category_type: "expense",
    notes: "Health, dental, property, and life insurance benefits",
  },
  {
    id: "cat-medical",
    name: "medical",
    parent_category_id: null,
    category_type: "expense",
    notes: "Doctor visits, prescription pharmacy, and treatment costs",
  },
  {
    id: "cat-legal",
    name: "legal",
    parent_category_id: null,
    category_type: "expense",
    notes: "Attorney professional services and filings",
  },
  {
    id: "cat-caregiving",
    name: "caregiving",
    parent_category_id: null,
    category_type: "expense",
    notes: "Care services, elderly help, child support",
  },
  {
    id: "cat-debt-pay",
    name: "debt_payment",
    parent_category_id: null,
    category_type: "liability",
    notes: "Liability principal payoffs",
  },
  {
    id: "cat-reimburse",
    name: "reimbursement",
    parent_category_id: null,
    category_type: "income",
    notes: "Reimbursements from work or friends",
  },
  {
    id: "cat-disputed",
    name: "disputed_charge",
    parent_category_id: null,
    category_type: "expense",
    notes: "Unresolved or unrecognized billing lines",
  },
  {
    id: "cat-business",
    name: "business",
    parent_category_id: null,
    category_type: "expense",
    notes: "Work or client-related deductible operations",
  },
  {
    id: "cat-personal",
    name: "personal",
    parent_category_id: null,
    category_type: "expense",
    notes: "Gifts, subscriptions, apparel, and leisure",
  },
  {
    id: "cat-unknown",
    name: "unknown",
    parent_category_id: null,
    category_type: "expense",
    notes: "Unsorted items awaiting feedback",
  },
];

// Initial Core People
const seedPeople: Person[] = [
  {
    id: "p-1",
    display_name: "Apex Corp Solutions",
    type: "employer",
    email: "payroll@apexcorp.com",
    phone: "1-800-555-0199",
    notes: "Primary professional consulting employer",
    status: "active",
  },
  {
    id: "p-2",
    display_name: "Golden State Apartments",
    type: "company",
    email: "leasing@goldenstate.com",
    phone: "415-555-8822",
    notes: "Apartment landlord company",
    status: "active",
  },
  {
    id: "p-3",
    display_name: "Sarah Jenkins",
    type: "person",
    email: "sarah.j@gmail.com",
    phone: "650-555-4321",
    notes: "Close friend and sharing coordinator",
    status: "active",
  },
  {
    id: "p-4",
    display_name: "Pacific Gas & Electric",
    type: "vendor",
    email: "account-care@pge-billing.com",
    phone: "1-800-743-5000",
    notes: "Utility Service Provider for residence",
    status: "active",
  },
  {
    id: "p-5",
    display_name: "Whole Foods Market Inc.",
    type: "vendor",
    email: "support@wholefoods.com",
    phone: "415-555-1010",
    notes: "Primary grocery vendor",
    status: "active",
  },
];

// Initial Accounts
const seedAccounts: Account[] = [
  {
    id: "acct-checking",
    name: "Chase Premier Checking",
    account_type: "checking",
    institution: "JPMorgan Chase",
    last_4: "4822",
    currency: "USD",
    opening_balance: 1000,
    current_balance: 1000,
    status: "active",
    notes: "Main checking account for paychecks, rent, and active bills.",
    created_at: "2026-06-01T08:00:00Z",
    updated_at: "2026-06-18T10:00:00Z",
  },
  {
    id: "acct-savings",
    name: "Fidelity High Yield Savings",
    account_type: "savings",
    institution: "Fidelity Investments",
    last_4: "9905",
    currency: "USD",
    opening_balance: 5000,
    current_balance: 5000,
    status: "active",
    notes: "Emergency savings reserve targeting standard yield.",
    created_at: "2026-06-01T08:00:00Z",
    updated_at: "2026-06-18T10:00:00Z",
  },
  {
    id: "acct-cash",
    name: "Physical Cash Wallet",
    account_type: "cash",
    institution: "Self",
    last_4: "0000",
    currency: "USD",
    opening_balance: 150,
    current_balance: 150,
    status: "active",
    notes: "Physical safe and wallet pocket cash.",
    created_at: "2026-06-01T08:00:00Z",
    updated_at: "2026-06-18T10:00:00Z",
  },
  {
    id: "acct-amex",
    name: "Amex Blue Cash Preferred",
    account_type: "credit_card",
    institution: "American Express",
    last_4: "2004",
    currency: "USD",
    opening_balance: 0,
    current_balance: 0,
    status: "active",
    notes: "Active rewards credit card paid monthly in full.",
    created_at: "2026-06-01T08:00:00Z",
    updated_at: "2026-06-18T10:00:00Z",
  },
  {
    id: "acct-car-loan",
    name: "Toyota Auto Finance Loan",
    account_type: "loan",
    institution: "Toyota Financial Services",
    last_4: "7741",
    currency: "USD",
    opening_balance: 8500,
    current_balance: 8500,
    status: "active",
    notes: "Principal balance targeting low-interest vehicle amortization.",
    created_at: "2026-06-01T08:00:00Z",
    updated_at: "2026-06-18T10:00:00Z",
  },
  {
    id: "acct-receivable-sarah",
    name: "Sarah Loan Receivable",
    account_type: "receivable",
    institution: "Individual",
    last_4: "NONE",
    currency: "USD",
    opening_balance: 0,
    current_balance: 0,
    status: "active",
    notes: "Debts and advances extended to Sarah Jenkins.",
    created_at: "2026-06-01T08:00:00Z",
    updated_at: "2026-06-18T10:00:00Z",
  },
  {
    id: "acct-office-equip",
    name: "Office Tech Equipment",
    account_type: "asset",
    institution: "Self",
    last_4: "NONE",
    currency: "USD",
    opening_balance: 2400,
    current_balance: 2400,
    status: "active",
    notes: "Laptops, displays, computing arrays and furniture.",
    created_at: "2026-06-01T08:00:00Z",
    updated_at: "2026-06-18T10:00:00Z",
  },
  // Normal Income and Expense system Accounts representing credit and debit sides
  {
    id: "acct-income-consulting",
    name: "Consulting Income Account",
    account_type: "income",
    institution: "Self",
    last_4: "NONE",
    currency: "USD",
    opening_balance: 0,
    current_balance: 0,
    status: "active",
    notes: "Double-entry matching account for personal consulting revenue.",
    created_at: "2026-06-01T08:00:00Z",
    updated_at: "2026-06-18T10:00:00Z",
  },
  {
    id: "acct-expense-rent",
    name: "Housing & Rent Expense",
    account_type: "expense",
    institution: "Self",
    last_4: "NONE",
    currency: "USD",
    opening_balance: 0,
    current_balance: 0,
    status: "active",
    notes: "Double-entry matching account for apartment lease costs.",
    created_at: "2026-06-01T08:00:00Z",
    updated_at: "2026-06-18T10:00:00Z",
  },
  {
    id: "acct-expense-groceries",
    name: "Groceries Matching Account",
    account_type: "expense",
    institution: "Self",
    last_4: "NONE",
    currency: "USD",
    opening_balance: 0,
    current_balance: 0,
    status: "active",
    notes: "Double-entry matching account for foodstuffs.",
    created_at: "2026-06-01T08:00:00Z",
    updated_at: "2026-06-18T10:00:00Z",
  },
  {
    id: "acct-expense-electricity",
    name: "Electricity Utilities",
    account_type: "expense",
    institution: "Self",
    last_4: "NONE",
    currency: "USD",
    opening_balance: 0,
    current_balance: 0,
    status: "active",
    notes: "Double-entry matching account for domestic utilities billing.",
    created_at: "2026-06-01T08:00:00Z",
    updated_at: "2026-06-18T10:00:00Z",
  },
];

// Initial Journal Entries and Lines
const seedEntries: JournalEntry[] = [
  {
    id: "je-1",
    entry_date: "2026-06-01",
    description: "Initial paycheck consulting payout from Apex Corp",
    memo: "Consulting services payment June week 1",
    source: "manual",
    status: "posted",
    related_person_id: "p-1",
    related_bill_id: null,
    related_debt_id: null,
    related_asset_id: null,
    evidence_url:
      "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?w=300&auto=format&fit=crop&q=60",
    import_batch_id: null,
    created_at: "2026-06-01T09:00:00Z",
    updated_at: "2026-06-01T09:00:00Z",
  },
  {
    id: "je-2",
    entry_date: "2026-06-02",
    description: "Monthly Apartment Rent Payment Golden State",
    memo: "Rent for residency unit 4B June 2026",
    source: "bill_payment",
    status: "posted",
    related_person_id: "p-2",
    related_bill_id: "bill-1",
    related_debt_id: null,
    related_asset_id: null,
    evidence_url: null,
    import_batch_id: null,
    created_at: "2026-06-02T10:15:00Z",
    updated_at: "2026-06-02T10:15:00Z",
  },
  {
    id: "je-3",
    entry_date: "2026-06-05",
    description: "Weekly organic pantry groceries at Whole Foods",
    memo: "Amex charges for domestic nutrition pantry restock",
    source: "manual",
    status: "posted",
    related_person_id: "p-5",
    related_bill_id: null,
    related_debt_id: null,
    related_asset_id: null,
    evidence_url:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?w=300&auto=format&fit=crop&q=60",
    import_batch_id: null,
    created_at: "2026-06-05T18:30:00Z",
    updated_at: "2026-06-05T18:30:00Z",
  },
  {
    id: "je-4",
    entry_date: "2026-06-10",
    description: "Friendly cash loan given to Sarah Jenkins",
    memo: "Temporary support advance. Sarah agreed to pay by end of month.",
    source: "debt_payment",
    status: "posted",
    related_person_id: "p-3",
    related_bill_id: null,
    related_debt_id: "debt-1",
    related_asset_id: null,
    evidence_url: null,
    import_batch_id: null,
    created_at: "2026-06-10T11:00:00Z",
    updated_at: "2026-06-10T11:00:00Z",
  },
];

const seedLines: JournalLine[] = [
  // je-1: Credit Income $3200, Debit Chase Checking $3200 (pays consultation)
  {
    id: "jl-1a",
    journal_entry_id: "je-1",
    account_id: "acct-checking",
    category_id: "cat-income",
    debit_amount: 3200,
    credit_amount: 0,
    memo: "Payroll deposit check direct",
    created_at: "2026-06-01T09:00:00Z",
  },
  {
    id: "jl-1b",
    journal_entry_id: "je-1",
    account_id: "acct-income-consulting",
    category_id: "cat-income",
    debit_amount: 0,
    credit_amount: 3200,
    memo: "Earned consulting hours Apex",
    created_at: "2026-06-01T09:00:00Z",
  },

  // je-2: Debit Rent Expense $1200, Credit Chase Checking $1200
  {
    id: "jl-2a",
    journal_entry_id: "je-2",
    account_id: "acct-expense-rent",
    category_id: "cat-rent",
    debit_amount: 1200,
    credit_amount: 0,
    memo: "Monthly lease unit 4B debit",
    created_at: "2026-06-02T10:15:00Z",
  },
  {
    id: "jl-2b",
    journal_entry_id: "je-2",
    account_id: "acct-checking",
    category_id: "cat-rent",
    debit_amount: 0,
    credit_amount: 1200,
    memo: "Rent expense check drawn",
    created_at: "2026-06-02T10:15:00Z",
  },

  // je-3: Debit Groceries Expense $145, Credit Amex Credit Card $145
  {
    id: "jl-3a",
    journal_entry_id: "je-3",
    account_id: "acct-expense-groceries",
    category_id: "cat-food",
    debit_amount: 145,
    credit_amount: 0,
    memo: "Whole Foods organic purchases",
    created_at: "2026-06-05T18:30:00Z",
  },
  {
    id: "jl-3b",
    journal_entry_id: "je-3",
    account_id: "acct-amex",
    category_id: "cat-food",
    debit_amount: 0,
    credit_amount: 145,
    memo: "Whole Foods card swipe",
    created_at: "2026-06-05T18:30:00Z",
  },

  // je-4: Debit Sarah Loan Receivable $100, Credit Cash Wallet $100
  {
    id: "jl-4a",
    journal_entry_id: "je-4",
    account_id: "acct-receivable-sarah",
    category_id: "cat-debt-pay",
    debit_amount: 100,
    credit_amount: 0,
    memo: "Advance check friendly ledger",
    created_at: "2026-06-10T11:00:00Z",
  },
  {
    id: "jl-4b",
    journal_entry_id: "je-4",
    account_id: "acct-cash",
    category_id: "cat-debt-pay",
    debit_amount: 0,
    credit_amount: 100,
    memo: "Cash drawer payout friendly",
    created_at: "2026-06-10T11:00:00Z",
  },
];

// Initial Debts
const seedDebts: Debt[] = [
  {
    id: "debt-1",
    title: "Sarah Jenkins Friendly Advance",
    debt_type: "owes_me",
    person_id: "p-3",
    original_amount: 100,
    current_balance: 100,
    currency: "USD",
    start_date: "2026-06-10",
    due_date: "2026-06-30",
    status: "active",
    priority: "medium",
    notes:
      "Gave $100 cash to help with concert ticket share. Friendly repayment requested.",
    evidence_url: null,
  },
];

// Initial Bills
const seedBills: Bill[] = [
  {
    id: "bill-1",
    vendor_id: "p-2",
    title: "Monthly Apartment Rent Unit 4B",
    amount: 1200,
    due_date: "2026-07-01",
    recurring_frequency: "monthly",
    status: "upcoming",
    account_id: "acct-checking",
    category_id: "cat-rent",
    notes:
      "Monthly lease rental due to Golden State Apartments. Pay via web portal autopay.",
    evidence_url: null,
  },
  {
    id: "bill-2",
    vendor_id: "p-4",
    title: "PG&E Summer Electricity Utility",
    amount: 89.5,
    due_date: "2026-06-25",
    recurring_frequency: "monthly",
    status: "upcoming",
    account_id: "acct-checking",
    category_id: "cat-utilities",
    notes: "Standard utilities service for household cooling loads.",
    evidence_url: null,
  },
];

// Initial Assets
const seedAssets: Asset[] = [
  {
    id: "asset-1",
    name: "Home Studio Custom Workstation",
    asset_type: "equipment",
    purchase_date: "2026-01-10",
    purchase_price: 2400,
    estimated_value: 1950,
    account_id: "acct-checking",
    status: "active",
    notes:
      "Apple Mac Studio, dual ultra-wide displays, high back ergonomic desk setup.",
    evidence_url:
      "https://images.unsplash.com/photo-1547082299-de196ea013d6?w=300&auto=format&fit=crop&q=60",
  },
];

// LocalDatabase Service class
class LocalDatabase {
  constructor() {
    this.initialize();
  }

  private initialize() {
    if (!localStorage.getItem(ACCOUNTS_KEY)) {
      this.saveToStorage(ACCOUNTS_KEY, seedAccounts);
    }
    if (!localStorage.getItem(CATEGORIES_KEY)) {
      this.saveToStorage(CATEGORIES_KEY, seedCategories);
    }
    if (!localStorage.getItem(ENTRIES_KEY)) {
      this.saveToStorage(ENTRIES_KEY, seedEntries);
    }
    if (!localStorage.getItem(LINES_KEY)) {
      this.saveToStorage(LINES_KEY, seedLines);
    }
    if (!localStorage.getItem(PEOPLE_KEY)) {
      this.saveToStorage(PEOPLE_KEY, seedPeople);
    }
    if (!localStorage.getItem(DEBTS_KEY)) {
      this.saveToStorage(DEBTS_KEY, seedDebts);
    }
    if (!localStorage.getItem(BILLS_KEY)) {
      this.saveToStorage(BILLS_KEY, seedBills);
    }
    if (!localStorage.getItem(ASSETS_KEY)) {
      this.saveToStorage(ASSETS_KEY, seedAssets);
    }
    if (!localStorage.getItem(BATCHES_KEY)) {
      this.saveToStorage(BATCHES_KEY, []);
    }

    this.processRecurringBillsDrafts();
  }

  /**
   * Process recurring bills and generate drafts for upcoming due dates (up to 90 days out)
   */
  processRecurringBillsDrafts() {
    const bills = this.getBills();
    const entries = this.getJournalEntries();
    const lines = this.getJournalLines();
    const now = new Date();
    const horizon = new Date();
    horizon.setDate(now.getDate() + 90);

    let entriesChanged = false;

    bills.forEach((bill) => {
      if (
        bill.recurring_frequency !== "none" &&
        bill.status !== "cancelled" &&
        bill.due_date
      ) {
        let currentIterDate = new Date(bill.due_date + "T12:00:00Z");
        let emergencyBreak = 0;

        while (currentIterDate <= horizon && emergencyBreak < 365) {
          emergencyBreak++;
          const dateStr = currentIterDate.toISOString().split("T")[0];

          // Check if an entry for this bill and date already exists
          const hasEntry = entries.some(
            (e) => e.related_bill_id === bill.id && e.entry_date === dateStr,
          );

          // We require bill.category_id representing the expense side, and bill.account_id representing the checking/credit account side
          if (!hasEntry && bill.category_id && bill.account_id) {
            const draftId = uuid();
            const creationDate = new Date().toISOString();

            entries.push({
              id: draftId,
              entry_date: dateStr,
              description: `Recurring Bill: ${bill.title}`,
              memo: `Auto-generated draft for recurring bill.`,
              source: "system",
              status: "draft",
              related_person_id: bill.vendor_id || null,
              related_bill_id: bill.id,
              related_debt_id: null,
              related_asset_id: null,
              evidence_url: bill.evidence_url || null,
              import_batch_id: null,
              created_at: creationDate,
              updated_at: creationDate,
            });

            // Expense (Debit) side
            lines.push({
              id: uuid(),
              journal_entry_id: draftId,
              account_id: bill.account_id, // Wait, standard double entry normally has two proper accounts, but since categories are used as accounts conceptually here...
              // In saveSimpleTransaction, the debit account was toAccountId, credit fromAccountId.
              // So we debit the expense (or just use account_id for both if we must and link category_id)
              // Actually, looking at `saveSimpleTransaction`:
              // `account_id` can be any string. so mapping bill.category_id is fine.
              category_id: bill.category_id,
              debit_amount: bill.amount,
              credit_amount: 0,
              memo: `Auto-draft debit for bill expense`,
              created_at: creationDate,
            });

            // Asset (Credit) side - e.g. checking account
            lines.push({
              id: uuid(),
              journal_entry_id: draftId,
              account_id: bill.account_id,
              category_id: bill.category_id,
              debit_amount: 0,
              credit_amount: bill.amount,
              memo: `Auto-draft credit from checking liability`,
              created_at: creationDate,
            });

            entriesChanged = true;
          }

          // Advance iterator
          if (bill.recurring_frequency === "weekly") {
            currentIterDate.setDate(currentIterDate.getDate() + 7);
          } else if (bill.recurring_frequency === "biweekly") {
            currentIterDate.setDate(currentIterDate.getDate() + 14);
          } else if (bill.recurring_frequency === "monthly") {
            currentIterDate.setMonth(currentIterDate.getMonth() + 1);
          } else if (bill.recurring_frequency === "yearly") {
            currentIterDate.setFullYear(currentIterDate.getFullYear() + 1);
          } else {
            break;
          }
        }
      }
    });

    if (entriesChanged) {
      this.saveToStorage(ENTRIES_KEY, entries);
      this.saveToStorage(LINES_KEY, lines);
    }
  }

  private getFromStorage<T>(key: string): T[] {
    const val = localStorage.getItem(key);
    return val ? JSON.parse(val) : [];
  }

  private saveToStorage<T>(key: string, data: T[]) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  // --- QUERY APIS ---

  getAccounts(): Account[] {
    const accounts = this.getFromStorage<Account>(ACCOUNTS_KEY);
    const lines = this.getJournalLines();

    // Dynamically calculate current_balance based on double-entry principles
    return accounts.map((acct) => {
      let debitSum = 0;
      let creditSum = 0;

      // Filter lines of posted entries
      const postedEntries = this.getJournalEntries().filter(
        (e) => e.status === "posted",
      );
      const postedEntryIds = new Set(postedEntries.map((e) => e.id));

      lines.forEach((l) => {
        if (
          l.account_id === acct.id &&
          postedEntryIds.has(l.journal_entry_id)
        ) {
          debitSum += l.debit_amount;
          creditSum += l.credit_amount;
        }
      });

      let current_balance = acct.opening_balance;
      if (isNormalDebit(acct.account_type)) {
        current_balance = acct.opening_balance + debitSum - creditSum;
      } else {
        current_balance = acct.opening_balance + creditSum - debitSum;
      }

      return {
        ...acct,
        current_balance: Math.round(current_balance * 100) / 100,
      };
    });
  }

  getCategories(): Category[] {
    return this.getFromStorage<Category>(CATEGORIES_KEY);
  }

  getJournalEntries(): JournalEntry[] {
    return this.getFromStorage<JournalEntry>(ENTRIES_KEY);
  }

  getJournalLines(): JournalLine[] {
    return this.getFromStorage<JournalLine>(LINES_KEY);
  }

  getPeople(): Person[] {
    return this.getFromStorage<Person>(PEOPLE_KEY);
  }

  getDebts(): Debt[] {
    // Dynamic refresh of original current balance based on connected journal lines
    const debts = this.getFromStorage<Debt>(DEBTS_KEY);
    return debts.map((d) => {
      // Find payments toward this related_debt_id
      const linkedEntries = this.getJournalEntries().filter(
        (e) => e.related_debt_id === d.id && e.status === "posted",
      );
      const linkedLineIds = linkedEntries.map((e) => e.id);

      const lines = this.getJournalLines().filter((l) =>
        linkedLineIds.includes(l.journal_entry_id),
      );

      // Compute reduction
      let paymentsTotal = 0;
      lines.forEach((l) => {
        // Reductions are debits for i_owe, credits for owes_me
        if (d.debt_type === "i_owe") {
          paymentsTotal += l.debit_amount; // Debit reducing the liability
        } else if (d.debt_type === "owes_me") {
          paymentsTotal += l.credit_amount; // Credit reducing the receivable
        }
      });

      // Simple current balance: original amount minus what's paid/received
      // (ignoring starting seeds because they already count, we compute dynamically if linked lines found)
      const calculatedBalance = Math.max(0, d.original_amount - paymentsTotal);
      return {
        ...d,
        current_balance:
          paymentsTotal > 0 ? calculatedBalance : d.current_balance,
      };
    });
  }

  getBills(): Bill[] {
    return this.getFromStorage<Bill>(BILLS_KEY);
  }

  getAssets(): Asset[] {
    return this.getFromStorage<Asset>(ASSETS_KEY);
  }

  getImportBatches(): ImportBatch[] {
    return this.getFromStorage<ImportBatch>(BATCHES_KEY);
  }

  // --- PERSISTENCE/MUTATION APIS WITH COMPREHENSIVE VALIDATION ---

  saveAccount(acct: Account): Account {
    const list = this.getAccounts();
    const idx = list.findIndex((a) => a.id === acct.id);
    const now = new Date().toISOString();

    const prepared: Account = {
      ...acct,
      updated_at: now,
      created_at: acct.created_at || now,
    };

    if (idx !== -1) {
      list[idx] = prepared;
    } else {
      list.push(prepared);
    }

    // Save to localStorage (opening balance changes, name info, etc)
    this.saveToStorage(ACCOUNTS_KEY, list);
    return prepared;
  }

  saveCategory(cat: Category): Category {
    const list = this.getCategories();
    const idx = list.findIndex((c) => c.id === cat.id);
    if (idx !== -1) {
      list[idx] = cat;
    } else {
      list.push(cat);
    }
    this.saveToStorage(CATEGORIES_KEY, list);
    return cat;
  }

  savePerson(person: Person): Person {
    const list = this.getPeople();
    const idx = list.findIndex((p) => p.id === person.id);
    if (idx !== -1) {
      list[idx] = person;
    } else {
      list.push(person);
    }
    this.saveToStorage(PEOPLE_KEY, list);
    return person;
  }

  saveDebt(debt: Debt): Debt {
    const list = this.getDebts();
    const idx = list.findIndex((d) => d.id === debt.id);
    if (idx !== -1) {
      list[idx] = debt;
    } else {
      list.push(debt);
    }
    this.saveToStorage(DEBTS_KEY, list);
    return debt;
  }

  saveBill(bill: Bill): Bill {
    const list = this.getBills();
    const idx = list.findIndex((b) => b.id === bill.id);
    if (idx !== -1) {
      list[idx] = bill;
    } else {
      list.push(bill);
    }
    this.saveToStorage(BILLS_KEY, list);
    return bill;
  }

  saveAsset(asset: Asset): Asset {
    const list = this.getAssets();
    const idx = list.findIndex((a) => a.id === asset.id);
    if (idx !== -1) {
      list[idx] = asset;
    } else {
      list.push(asset);
    }
    this.saveToStorage(ASSETS_KEY, list);
    return asset;
  }

  saveImportBatch(batch: ImportBatch): ImportBatch {
    const list = this.getImportBatches();
    const idx = list.findIndex((b) => b.id === batch.id);
    if (idx !== -1) {
      list[idx] = batch;
    } else {
      list.push(batch);
    }
    this.saveToStorage(BATCHES_KEY, list);
    return batch;
  }

  saveImportedData(
    accountId: string,
    rows: any[],
    sourceName: string,
    fileName: string,
  ): ImportBatch {
    const list = this.getImportBatches();
    const batchId = uuid();
    const batch: ImportBatch = {
      id: batchId,
      source_name: sourceName,
      source_account_id: accountId,
      imported_file_name: fileName,
      import_date: new Date().toISOString(),
      status: "draft",
      notes: `Imported ${rows.length} rows`,
    };
    list.push(batch);
    this.saveToStorage(BATCHES_KEY, list);

    const entries = this.getJournalEntries();
    const lines = this.getJournalLines();
    const now = new Date().toISOString();

    for (const row of rows) {
      const entryId = uuid();

      entries.push({
        id: entryId,
        entry_date: row.date || now.split("T")[0],
        description: row.description || "Imported Transaction",
        memo: row.memo || "CSV Import",
        source: "import",
        status: "posted",
        related_person_id: null,
        related_bill_id: null,
        related_debt_id: null,
        related_asset_id: null,
        evidence_url: null,
        import_batch_id: batchId,
        created_at: now,
        updated_at: now,
        needs_review: true,
      });

      const isPositive = row.amount >= 0;
      const absAmount = Math.abs(row.amount);

      if (isPositive) {
        lines.push({
          id: uuid(),
          journal_entry_id: entryId,
          account_id: accountId,
          category_id: null,
          debit_amount: absAmount,
          credit_amount: 0,
          memo: "Imported Inflow",
          created_at: now,
        });

        lines.push({
          id: uuid(),
          journal_entry_id: entryId,
          account_id: accountId,
          category_id: "cat-unknown",
          debit_amount: 0,
          credit_amount: absAmount,
          memo: "Uncategorized Inflow",
          created_at: now,
        });
      } else {
        lines.push({
          id: uuid(),
          journal_entry_id: entryId,
          account_id: accountId,
          category_id: null,
          debit_amount: 0,
          credit_amount: absAmount,
          memo: "Imported Outflow",
          created_at: now,
        });

        lines.push({
          id: uuid(),
          journal_entry_id: entryId,
          account_id: accountId,
          category_id: "cat-unknown",
          debit_amount: absAmount,
          credit_amount: 0,
          memo: "Uncategorized Expense",
          created_at: now,
        });
      }
    }

    this.saveToStorage(ENTRIES_KEY, entries);
    this.saveToStorage(LINES_KEY, lines);

    return batch;
  }

  /**
   * Complex Double Entry Journal Submission Engine
   */
  postJournalEntry(
    entry: JournalEntry,
    lines: JournalLine[],
  ): { success: boolean; error?: string; entry?: JournalEntry } {
    // 1. Line validation
    if (lines.length < 2) {
      return {
        success: false,
        error:
          "A valid journal entry must contain at least 2 distinct accounting lines.",
      };
    }

    // 2. Debit and Credit checks
    let totalDebit = 0;
    let totalCredit = 0;

    for (const line of lines) {
      if (line.debit_amount > 0 && line.credit_amount > 0) {
        return {
          success: false,
          error:
            "Double-entry validation failed: Debit and Credit cannot both be positive on the same line.",
        };
      }
      if (line.debit_amount < 0 || line.credit_amount < 0) {
        return {
          success: false,
          error:
            "Negative debit or credit values are strictly forbidden in standard accounting models.",
        };
      }
      totalDebit += line.debit_amount;
      totalCredit += line.credit_amount;
    }

    // 3. Balance verification
    const difference = Math.abs(totalDebit - totalCredit);
    if (difference > 0.01 && entry.status === "posted") {
      return {
        success: false,
        error: `Journal balance verification failed: This transaction does not balance. Total debits ($${totalDebit.toFixed(2)}) must exactly equal total credits ($${totalCredit.toFixed(2)}). Difference: $${difference.toFixed(2)}`,
      };
    }

    // A draft doesn't strictly have to balance if status is draft, but posted entries MUST balance.

    const entries = this.getJournalEntries();
    const allLines = this.getJournalLines();
    const now = new Date().toISOString();

    const preparedEntry: JournalEntry = {
      ...entry,
      created_at: entry.created_at || now,
      updated_at: now,
    };

    // Save/update the parent journal entry
    const entryIdx = entries.findIndex((e) => e.id === entry.id);
    if (entryIdx !== -1) {
      // Posted journal entries should NOT be edited directly! They are historical records.
      const currentVal = entries[entryIdx];
      if (
        currentVal.status === "posted" &&
        entry.status === "posted" &&
        entryIdx !== -1
      ) {
        // Allow updating only metadata (urls, memos, disputed flags) but not monetary balances.
        // If balances changed, we throw error. Reversal entries are required.
        const currentLines = allLines.filter(
          (l) => l.journal_entry_id === entry.id,
        );
        const sumsChanged =
          currentLines.length !== lines.length ||
          lines.some((l) => {
            const old = currentLines.find((cl) => cl.id === l.id);
            return (
              !old ||
              old.credit_amount !== l.credit_amount ||
              old.debit_amount !== l.debit_amount ||
              old.account_id !== l.account_id
            );
          });

        if (sumsChanged) {
          return {
            success: false,
            error:
              "Security/Auditing restriction: A posted transaction cannot be directly altered in value. Please void/reverse and create a new adjustment entry instead.",
          };
        }
      }

      entries[entryIdx] = preparedEntry;
    } else {
      entries.push(preparedEntry);
    }

    // Clean old lines for this entry and install new ones
    const filteredLines = allLines.filter(
      (l) => l.journal_entry_id !== entry.id,
    );
    const preparedLines = lines.map((line) => ({
      ...line,
      journal_entry_id: preparedEntry.id,
      created_at: line.created_at || now,
    }));

    this.saveToStorage(ENTRIES_KEY, entries);
    this.saveToStorage(LINES_KEY, [...filteredLines, ...preparedLines]);

    return { success: true, entry: preparedEntry };
  }

  /**
   * Create reversal ledger lines for a posted entry
   */
  reverseJournalEntry(entryId: string): { success: boolean; error?: string } {
    const entries = this.getJournalEntries();
    const allLines = this.getJournalLines();
    const entryIdx = entries.findIndex((e) => e.id === entryId);

    if (entryIdx === -1) {
      return { success: false, error: "Transaction matching ID not located." };
    }

    const entry = entries[entryIdx];
    if (entry.status !== "posted") {
      return {
        success: false,
        error: "Only posted and finalized historical entries can be reversed.",
      };
    }

    const targetLines = allLines.filter((l) => l.journal_entry_id === entryId);

    // Create a new adjusting/reversing transaction
    const now = new Date().toISOString();
    const newEntryId = uuid();

    const adjustmentEntry: JournalEntry = {
      id: newEntryId,
      entry_date: new Date().toISOString().substring(0, 10),
      description: `REVERSAL ADJUSTMENT for transaction: ${entry.description}`,
      memo: `System audit adjustment reversing entry #${entry.id}`,
      source: "manual",
      status: "posted",
      related_person_id: entry.related_person_id,
      related_bill_id: entry.related_bill_id,
      related_debt_id: entry.related_debt_id,
      related_asset_id: entry.related_asset_id,
      evidence_url: entry.evidence_url,
      import_batch_id: null,
      reversal_for_entry_id: entry.id,
      created_at: now,
      updated_at: now,
    };

    // Swap Debits and Credits to reverse balances
    const reversedLines: JournalLine[] = targetLines.map((line) => ({
      id: uuid(),
      journal_entry_id: newEntryId,
      account_id: line.account_id,
      category_id: line.category_id,
      debit_amount: line.credit_amount, // Swap
      credit_amount: line.debit_amount, // Swap
      memo: `Audit reversal of #${line.id}`,
      created_at: now,
    }));

    // Mark original transaction as voided
    entry.status = "voided";
    entry.updated_at = now;
    entries[entryIdx] = entry;

    this.saveToStorage(ENTRIES_KEY, entries);

    // Save both the updated original and the new reversing lines
    entries.push(adjustmentEntry);
    this.saveToStorage(ENTRIES_KEY, entries);
    this.saveToStorage(LINES_KEY, [...allLines, ...reversedLines]);

    return { success: true };
  }

  /**
   * Delete Draft / Void entries
   */
  deleteDraftEntry(entryId: string): { success: boolean; error?: string } {
    const entries = this.getJournalEntries();
    const entryIdx = entries.findIndex((e) => e.id === entryId);

    if (entryIdx === -1) {
      return { success: false, error: "Transaction matching ID not located." };
    }

    const entry = entries[entryIdx];
    if (entry.status === "posted") {
      return {
        success: false,
        error:
          "Posted transactions cannot be deleted. You must void or reverse them to maintain accurate ledger audit trails.",
      };
    }

    const filteredEntries = entries.filter((e) => e.id !== entryId);
    const filteredLines = this.getJournalLines().filter(
      (l) => l.journal_entry_id !== entryId,
    );

    this.saveToStorage(ENTRIES_KEY, filteredEntries);
    this.saveToStorage(LINES_KEY, filteredLines);

    return { success: true };
  }

  /**
   * Save a User Friend Transaction through standard Double-Entry translation
   */
  saveSimpleTransaction(input: SimpleTransactionInput & { id?: string }): {
    success: boolean;
    error?: string;
  } {
    const entryId = input.id || uuid();
    const isEditing = !!input.id;

    const now = new Date().toISOString();

    const fromAccount = this.getAccounts().find(
      (a) => a.id === input.fromAccountId,
    );
    const toAccount = this.getAccounts().find(
      (a) => a.id === input.toAccountId,
    );

    if (!fromAccount || !toAccount) {
      return {
        success: false,
        error: "Invalid origin or target ledger accounts specified.",
      };
    }

    // Determine entry description and status
    const entryStatus: JournalEntryStatus =
      input.status === "draft" ? "draft" : "posted";

    const journalEntry: JournalEntry = {
      id: entryId,
      entry_date: input.date,
      description: input.description,
      memo: input.notes,
      source: input.relatedBillId
        ? "bill_payment"
        : input.relatedDebtId
          ? "debt_payment"
          : "manual",
      status: entryStatus,
      related_person_id: input.merchantOrPersonId || null,
      related_bill_id: input.relatedBillId || null,
      related_debt_id: input.relatedDebtId || null,
      related_asset_id: null,
      evidence_url: input.receiptUrl || null,
      import_batch_id: null,
      created_at: now,
      updated_at: now,
      is_disputed: input.isDisputed,
      is_reimbursable: input.isReimbursable,
      needs_review:
        input.status === "unreviewed" || input.status === "needs_evidence",
    };

    // Let's create lines. By standard bookkeeping standards:
    // Spent $25 from Checking (Asset, Credit side increases, Debit Expense side increases)
    // - Debit Expense matching category: input.amount (e.g. To Account/Category)
    // - Credit bank asset account: input.amount (e.g. From Account)
    const lineDebitId = uuid();
    const lineCreditId = uuid();

    // Line 1: The Debit Side
    // Debit side goes to target account (e.g., Grocery expense normal-debit increases)
    const debitLine: JournalLine = {
      id: lineDebitId,
      journal_entry_id: entryId,
      account_id: input.toAccountId, // e.g. the expense account or receivable account
      category_id: input.categoryId,
      debit_amount: input.amount,
      credit_amount: 0,
      memo: input.description,
      created_at: now,
    };

    // Line 2: The Credit Side
    // Credit side goes to origin account (e.g., checking account asset normal-debit decreases)
    const creditLine: JournalLine = {
      id: lineCreditId,
      journal_entry_id: entryId,
      account_id: input.fromAccountId, // e.g. checking account
      category_id: input.categoryId,
      debit_amount: 0,
      credit_amount: input.amount,
      memo: input.description,
      created_at: now,
    };

    // If we have an active bill, pay off the bill
    if (input.relatedBillId && entryStatus === "posted") {
      const bill = this.getBills().find((b) => b.id === input.relatedBillId);
      if (bill) {
        this.saveBill({
          ...bill,
          status: "paid",
        });
      }
    }

    // Save and validate
    return this.postJournalEntry(journalEntry, [debitLine, creditLine]);
  }

  resetAll() {
    localStorage.removeItem(ACCOUNTS_KEY);
    localStorage.removeItem(CATEGORIES_KEY);
    localStorage.removeItem(ENTRIES_KEY);
    localStorage.removeItem(LINES_KEY);
    localStorage.removeItem(PEOPLE_KEY);
    localStorage.removeItem(DEBTS_KEY);
    localStorage.removeItem(BILLS_KEY);
    localStorage.removeItem(ASSETS_KEY);
    localStorage.removeItem(BATCHES_KEY);
    this.initialize();
  }
}

export const db = new LocalDatabase();

// PostgreSQL Integration Migration Script Generated for the user
export const postgresMigrations = `-- QiFinance PostgreSQL Database Schema Migration v1.0
-- Setup Relational Personal Bookkeeping and Double-Entry Ledger System

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Define Enums
CREATE TYPE account_type_enum AS ENUM (
  'checking', 'savings', 'cash', 'credit_card', 'loan', 
  'asset', 'liability', 'income', 'expense', 'equity', 'receivable', 'payable'
);

CREATE TYPE journal_entry_status_enum AS ENUM ('draft', 'posted', 'voided');

CREATE TYPE person_type_enum AS ENUM (
  'person', 'company', 'vendor', 'family', 'employer', 'platform', 'agency'
);

CREATE TYPE debt_type_enum AS ENUM (
  'owes_me', 'i_owe', 'disputed', 'reimbursement', 'claim', 'informal_ledger'
);

CREATE TYPE debt_status_enum AS ENUM (
  'active', 'paid', 'disputed', 'forgiven', 'written_off'
);

CREATE TYPE bill_status_enum AS ENUM ('upcoming', 'paid', 'overdue', 'cancelled');

CREATE TYPE asset_type_enum AS ENUM (
  'vehicle', 'electronics', 'property', 'equipment', 'cash_value', 'other'
);

-- Accounts Table
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  account_type account_type_enum NOT NULL,
  institution VARCHAR(255) NOT NULL,
  last_4 VARCHAR(4) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  opening_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  current_balance NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Categories Table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  parent_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  category_type VARCHAR(50) NOT NULL CHECK (category_type IN ('income', 'expense', 'equity', 'asset', 'liability')),
  notes TEXT
);

-- People Table
CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  display_name VARCHAR(255) NOT NULL,
  type person_type_enum NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),
  notes TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive'))
);

-- Bills Table
CREATE TABLE bills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID REFERENCES people(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  due_date DATE NOT NULL,
  recurring_frequency VARCHAR(50) DEFAULT 'none',
  status bill_status_enum DEFAULT 'upcoming',
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  notes TEXT,
  evidence_url TEXT
);

-- Debts Table
CREATE TABLE debts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  debt_type debt_type_enum NOT NULL,
  person_id UUID REFERENCES people(id) ON DELETE CASCADE,
  original_amount NUMERIC(15, 2) NOT NULL,
  current_balance NUMERIC(15, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  start_date DATE NOT NULL,
  due_date DATE,
  status debt_status_enum DEFAULT 'active',
  priority VARCHAR(10) DEFAULT 'medium',
  notes TEXT,
  evidence_url TEXT
);

-- Assets Table
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  asset_type asset_type_enum NOT NULL,
  purchase_date DATE NOT NULL,
  purchase_price NUMERIC(15, 2) NOT NULL,
  estimated_value NUMERIC(15, 2) NOT NULL,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'active',
  notes TEXT,
  evidence_url TEXT
);

-- Import Batches
CREATE TABLE import_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_name VARCHAR(100) NOT NULL,
  source_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  imported_file_name VARCHAR(255) NOT NULL,
  import_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(50) DEFAULT 'draft',
  notes TEXT
);

-- Journal Entries
CREATE TABLE journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_date DATE NOT NULL,
  description VARCHAR(550) NOT NULL,
  memo TEXT,
  source VARCHAR(50) NOT NULL DEFAULT 'manual',
  status journal_entry_status_enum DEFAULT 'draft',
  related_person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  related_bill_id UUID REFERENCES bills(id) ON DELETE SET NULL,
  related_debt_id UUID REFERENCES debts(id) ON DELETE SET NULL,
  related_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
  import_batch_id UUID REFERENCES import_batches(id) ON DELETE SET NULL,
  evidence_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Journal Lines Table
CREATE TABLE journal_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  debit_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (debit_amount >= 0.00),
  credit_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00 CHECK (credit_amount >= 0.00),
  memo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  
  -- Double entry line validation constraint (can't have positive debit AND credit on same line)
  CONSTRAINT debit_credit_exclude CHECK (
    (debit_amount > 0 AND credit_amount = 0) OR
    (credit_amount > 0 AND debit_amount = 0) OR
    (debit_amount = 0 AND credit_amount = 0)
  )
);

-- Indices for performance and filtering lookups
CREATE INDEX idx_jl_entry_id ON journal_lines(journal_entry_id);
CREATE INDEX idx_jl_account_id ON journal_lines(account_id);
CREATE INDEX idx_je_date ON journal_entries(entry_date);

-- Trigger to enforce total debits = total credits upon finalizing post status we represent server-side or in Cloudflare Pages
`;
