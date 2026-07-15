/**
 * QiFinance API Cloudflare Worker
 * Dedicated financial-data gateway between the App UI and Supabase.
 */

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  QIFI_API_TOKEN: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  QIFI_STORAGE_BUCKET?: string;
}

type JsonRecord = Record<string, any>;
type AssistantActionStatus = "created" | "skipped" | "error";

interface AssistantActionResult {
  type: string;
  status: AssistantActionStatus;
  message: string;
  record?: JsonRecord;
}

interface AssistantContext {
  financialAccounts: JsonRecord[];
  ledgerAccounts: JsonRecord[];
  categories: JsonRecord[];
  counterparties: JsonRecord[];
  rules: JsonRecord[];
}

const ALLOWED_ORIGINS = [
  "https://fi.qially.com",
  "https://www.fi.qially.com",
  "https://62-qifi.pages.dev"
];

const DOMAIN_ROUTES: Record<string, {
  table: string;
  order: string;
  mapInput?: (body: JsonRecord, isUpdate?: boolean) => JsonRecord;
}> = {
  rules: {
    table: "classification_rules",
    order: "created_at.desc",
    mapInput: mapRuleInput
  },
  attachments: {
    table: "attachments",
    order: "uploaded_at.desc",
    mapInput: mapAttachmentInput
  },
  statements: {
    table: "statements",
    order: "end_date.desc",
    mapInput: mapStatementInput
  },
  schedules: {
    table: "recurring_transactions",
    order: "next_due_date.asc",
    mapInput: mapScheduleInput
  },
  counterparties: {
    table: "counterparties",
    order: "name.asc",
    mapInput: mapCounterpartyInput
  },
  obligations: {
    table: "obligations",
    order: "created_at.desc",
    mapInput: mapObligationInput
  },
  "ledger-entries": {
    table: "journal_lines",
    order: "created_at.desc"
  },
  "import-batches": {
    table: "import_batches",
    order: "created_at.desc"
  },
  "raw-rows": {
    table: "import_rows_raw",
    order: "created_at.desc"
  },
  "financial-accounts": {
    table: "financial_accounts",
    order: "name.asc",
    mapInput: mapFinancialAccountInput
  },
  "ledger-accounts": {
    table: "ledger_accounts",
    order: "code.asc",
    mapInput: mapLedgerAccountInput
  },
  "tax-mappings": {
    table: "tax_mappings",
    order: "tax_form.asc",
    mapInput: mapTaxMappingInput
  },
  "journal-entries": {
    table: "journal_entries",
    order: "entry_date.desc"
  },
  "journal-lines": {
    table: "journal_lines",
    order: "created_at.desc"
  }
};

const ALLOWED_ACCOUNT_TYPES = new Set([
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
  "clearing",
  "suspense"
]);

const ALLOWED_ASSISTANT_ACTIONS = new Set([
  "create_account",
  "create_counterparty",
  "create_obligation",
  "create_schedule",
  "create_rule",
  "create_transaction"
]);

const ASSISTANT_SYSTEM_PROMPT = `
You are QiFi's private finance operations assistant. Convert the user's request into a small JSON action plan that QiFi can execute.

Return JSON only with this shape:
{
  "summary": "short user-facing summary",
  "warnings": ["optional warning"],
  "actions": [
    { "type": "create_account", "name": "...", "accountType": "asset", "accountKind": "checking", "institution": "...", "accountNumber": "...", "routingNumber": null, "description": "..." }
  ]
}

Allowed action types are create_account, create_counterparty, create_obligation, create_schedule, create_rule, and create_transaction.
Only create records. Treat create_account as a real-world financial account, not a chart-of-accounts ledger account. For requests that update, delete, reconcile, or are ambiguous, return no actions and explain what confirmation or detail is needed in summary.

Account rules:
- Checking and savings accounts are accountType "asset".
- Credit cards and loans are accountType "liability".
- Normalize Chase, JP Morgan, JPMorgan, and J.P. Morgan to institution "JPMorgan Chase".
- If the user gives only a last four identifier, put that exact identifier in accountNumber and include it in the account name.
- Use plain names such as "JPMorgan Chase Checking 9021" and "JPMorgan Chase Savings 1002".
- Use accountKind values checking, savings, credit_card, loan, wallet, cash, platform, or other.

Transaction rules:
- Amounts are positive for money entering the source account and negative for money leaving it.
- Dates must be YYYY-MM-DD.
- categoryAccountId is the chart-of-accounts category/posting account when known.

Never invent SQL, credentials, or unsupported fields. If you do not have enough information to safely create a record, return actions [].
`.trim();

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return injectCors(request, new Response(null, { status: 204 }));
    }

    try {
      let response: Response;

      if (url.pathname === "/health") {
        response = json({
          ok: true,
          service: "qifinance-api",
          time: new Date().toISOString()
        });
      } else if (!(await isAuthorized(request, env))) {
        response = unauthorized(env);
      } else if (url.pathname === "/debug/env" && request.method === "GET") {
        let host: string | null = null;
        try {
          if (env.SUPABASE_URL) {
            host = new URL(env.SUPABASE_URL).host;
          }
        } catch {}

        response = json({
          ok: true,
          hasSupabaseUrl: Boolean(env.SUPABASE_URL),
          hasServiceRoleKey: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
          hasOpenAiKey: Boolean(env.OPENAI_API_KEY),
          openAiModel: env.OPENAI_MODEL || "gpt-4.1-mini",
          supabaseUrlHost: host
        });
      } else {
        response = await router(request, env);
      }

      return injectCors(request, response);
    } catch (error: any) {
      console.error(JSON.stringify({
        level: "error",
        route: new URL(request.url).pathname,
        message: error?.message ?? "Unknown internal error"
      }));
      return injectCors(request, json({ error: error?.message ?? "Unknown internal error" }, 500));
    }
  },
};

function injectCors(request: Request, response: Response): Response {
  const origin = request.headers.get("Origin") || "";
  let allowedOrigin = "";

  if (ALLOWED_ORIGINS.includes(origin)) {
    allowedOrigin = origin;
  } else if (
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:") ||
    origin.endsWith(".pages.dev")
  ) {
    allowedOrigin = origin;
  }

  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", allowedOrigin || ALLOWED_ORIGINS[0]);
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Max-Age", "86400");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function unauthorized(env: Env): Response {
  const status = env.QIFI_API_TOKEN ? 401 : 503;
  return json({
    error: env.QIFI_API_TOKEN
      ? "Unauthorized"
      : "QIFI_API_TOKEN secret must be configured in the worker."
  }, status);
}

async function isAuthorized(request: Request, env: Env): Promise<boolean> {
  const authHeader = request.headers.get("Authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const providedToken = match?.[1]?.trim() || "";
  if (!providedToken) return false;

  // 1. Static API token fallback check
  if (env.QIFI_API_TOKEN && providedToken === env.QIFI_API_TOKEN) {
    return true;
  }

  // 2. Supabase JWT validation check
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
        headers: {
          "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
          "Authorization": `Bearer ${providedToken}`
        }
      });
      if (res.ok) {
        const user = await res.json() as any;
        if (user && user.id) {
          console.log(`[Auth] Authorized Supabase user: ${user.email} (${user.id})`);
          return true;
        }
      }
    } catch (err) {
      console.error("[Auth Error] Failed to validate token with Supabase:", err);
    }
  }

  return false;
}

async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [aHash, bHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a)),
    crypto.subtle.digest("SHA-256", encoder.encode(b))
  ]);

  const aBytes = new Uint8Array(aHash);
  const bBytes = new Uint8Array(bHash);
  let diff = a.length ^ b.length;

  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }

  return diff === 0;
}

async function router(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/finance/state" && request.method === "GET") {
    return await handleGetState(env);
  }

  if (path === "/api/finance/assistant" && request.method === "POST") {
    return await handleAssistant(request, env);
  }

  if (path === "/api/finance/accounts") {
    if (request.method === "GET") return await handleGetAccounts(env);
    if (request.method === "POST") return await handleCreateAccount(request, env);
  }

  const accountMatch = path.match(/^\/api\/finance\/accounts\/([^/]+)$/);
  if (accountMatch) {
    const id = decodeURIComponent(accountMatch[1]);
    if (request.method === "PATCH" || request.method === "PUT") return await handleUpdateAccount(id, request, env);
    if (request.method === "DELETE") return await handleDeleteAccount(id, env);
  }

  if (path === "/api/finance/categories") {
    if (request.method === "GET") return await handleGetCategories(env);
    if (request.method === "POST") return await handleCreateCategory(request, env);
  }

  if (path === "/api/finance/transactions") {
    if (request.method === "GET") return await handleGetTransactions(request, env);
    if (request.method === "POST") return await handleCreateTransaction(request, env);
  }

  const txMatch = path.match(/^\/api\/finance\/transactions\/([^/]+)$/);
  if (txMatch) {
    const id = decodeURIComponent(txMatch[1]);
    if (request.method === "GET") return await handleGetTransactionById(id, env);
    if (request.method === "PATCH" || request.method === "PUT") return await handleUpdateTransaction(id, request, env);
    if (request.method === "DELETE") return await handleDeleteTransaction(id, env);
  }

  if (path === "/api/finance/import/preview" && request.method === "POST") {
    return await handleImportPreview(request, env);
  }

  if (path === "/api/finance/import/commit" && request.method === "POST") {
    return await handleImportCommit(request, env);
  }

  if (path === "/api/finance/attachments" && request.method === "POST") {
    return await handleCreateAttachment(request, env);
  }

  const attachMatch = path.match(/^\/api\/finance\/attachments\/([^/]+)\/url$/);
  if (attachMatch && request.method === "GET") {
    const id = decodeURIComponent(attachMatch[1]);
    return await handleGetAttachmentUrl(id, env);
  }

  const domainMatch = path.match(/^\/api\/finance\/([^/]+)(?:\/([^/]+))?$/);
  if (domainMatch && DOMAIN_ROUTES[domainMatch[1]]) {
    const domain = domainMatch[1];
    const id = domainMatch[2] ? decodeURIComponent(domainMatch[2]) : undefined;
    return await handleDomainRoute(domain, id, request, env);
  }

  return json({ error: `Not found: ${request.method} ${path}` }, 404);
}

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function handleSupabaseError(res: Response, route: string): Promise<Response> {
  const errorText = await res.text();
  console.error(`[Supabase Error Response] Route: ${route} -> Status: ${res.status}, Details: ${errorText}`);
  const status = res.status >= 400 && res.status < 500 ? res.status : 500;
  return json({
    error: "Supabase request failed",
    status: res.status,
    details: errorText,
    route
  }, status);
}

async function assertSupabaseOk(res: Response, message: string): Promise<void> {
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[Supabase Assertion Failed] Message: ${message}, Details: ${errorText}`);
    throw new Error(`${message}: ${errorText}`);
  }
}

async function supabaseFetch(env: Env, path: string, init: RequestInit = {}): Promise<Response> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY secrets must be configured in the worker.");
  }

  const startTime = performance.now();
  const method = init.method || "GET";
  const bodyLog = init.body ? `, Body: ${truncate(String(init.body), 300)}` : "";
  console.log(`[Supabase Request] ${method} ${path}${bodyLog}`);

  const headers: Record<string, string> = {
    "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> || {}),
  };

  try {
    const prefix = path.startsWith("/storage/v1") ? "" : "/rest/v1";
    const res = await fetch(`${env.SUPABASE_URL}${prefix}${path}`, {
      ...init,
      headers,
    });
    const duration = (performance.now() - startTime).toFixed(1);
    console.log(`[Supabase Response] ${method} ${path} -> Status: ${res.status} (${duration}ms)`);
    
    if (!res.ok) {
      const clone = res.clone();
      const errText = await clone.text();
      console.error(`[Supabase Error Details] ${method} ${path} -> Status: ${res.status}, Error: ${errText}`);
    }
    return res;
  } catch (err: any) {
    const duration = (performance.now() - startTime).toFixed(1);
    console.error(`[Supabase Fetch Exception] ${method} ${path} -> Error: ${err?.message || err} (${duration}ms)`);
    throw err;
  }
}

function filterValue(value: string): string {
  return encodeURIComponent(value);
}

// NOTE: Counterparty auto-normalization was intentionally removed.
// The `transactions.counterparty` column is TEXT with no FK to `counterparties`.
// Aggressively normalizing and auto-creating counterparty records during transaction
// writes is unsafe: it strips meaningful store/location numbers, merges distinct
// merchants, and has no ON CONFLICT idempotency guard.
// Counterparties should be created explicitly by the user or assistant, not silently
// during every transaction write. The raw payee string from the CSV or user input
// is stored verbatim in `counterparty`.


function compact(record: JsonRecord): JsonRecord {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined)
  );
}

async function selectAll(env: Env, table: string, order: string): Promise<any[]> {
  const res = await supabaseFetch(env, `/${table}?select=*&order=${order}`);
  await assertSupabaseOk(res, `Failed to select ${table}`);
  return await res.json() as any[];
}

async function handleGetState(env: Env): Promise<Response> {
  const [
    financialAccounts,
    ledgerAccounts,
    categories,
    transactions,
    journalEntries,
    journalLines,
    importBatches,
    rawRows,
    rules,
    attachments,
    statements,
    schedules,
    counterparties,
    obligations
  ] = await Promise.all([
    selectAll(env, "financial_accounts", "name.asc"),
    selectAll(env, "ledger_accounts", "code.asc"),
    selectAll(env, "categories", "name.asc"),
    selectAll(env, "transactions", "transaction_date.desc"),
    selectAll(env, "journal_entries", "entry_date.desc"),
    selectAll(env, "journal_lines", "created_at.desc"),
    selectAll(env, "import_batches", "created_at.desc"),
    selectAll(env, "import_rows_raw", "created_at.desc"),
    selectAll(env, "classification_rules", "created_at.desc"),
    selectAll(env, "attachments", "uploaded_at.desc"),
    selectAll(env, "statements", "end_date.desc"),
    selectAll(env, "recurring_transactions", "next_due_date.asc"),
    selectAll(env, "counterparties", "name.asc"),
    selectAll(env, "obligations", "created_at.desc")
  ]);

  return json({
    financialAccounts,
    ledgerAccounts,
    accounts: ledgerAccounts,
    categories,
    transactions,
    journalEntries,
    journalLines,
    ledgerEntries: journalLines.map(mapJournalLineForLegacyClient),
    importBatches,
    rawRows,
    rules,
    attachments,
    statements,
    schedules,
    counterparties,
    obligations
  });
}

async function handleAssistant(request: Request, env: Env): Promise<Response> {
  const userApiKey = request.headers.get("x-openai-api-key") || "";
  const apiKey = userApiKey || env.OPENAI_API_KEY;

  if (!apiKey) {
    return json({ error: "OPENAI_API_KEY secret must be configured in the worker, or set in settings." }, 503);
  }

  const body = await request.json().catch(() => ({})) as JsonRecord;
  const message = normalizeText(body.message ?? body.prompt);
  if (!message) return json({ error: "Assistant message is required." }, 400);

  const context = await buildAssistantContext(env);
  const plan = await planAssistantActions(env, message, context, apiKey);
  const warnings = toStringArray(plan.warnings);
  const plannedActions = Array.isArray(plan.actions) ? plan.actions.slice(0, 10) : [];
  const results: AssistantActionResult[] = [];

  for (const action of plannedActions) {
    const type = normalizeText(action?.type);

    if (!ALLOWED_ASSISTANT_ACTIONS.has(type)) {
      results.push({
        type: type || "unknown",
        status: "skipped",
        message: type ? `Unsupported assistant action: ${type}` : "Assistant returned an action without a type."
      });
      continue;
    }

    try {
      results.push(await executeAssistantAction(action, env, context));
    } catch (error: any) {
      results.push({
        type,
        status: "error",
        message: error?.message ?? `Failed to execute ${type}`
      });
    }
  }

  const createdCount = results.filter((result) => result.status === "created").length;
  const errorCount = results.filter((result) => result.status === "error").length;
  const summary = normalizeText(plan.summary ?? plan.message);
  const resultMessage = summary || (
    createdCount > 0
      ? `Created ${createdCount} record${createdCount === 1 ? "" : "s"}.`
      : "No records were created."
  );

  return json({
    ok: errorCount === 0,
    message: resultMessage,
    createdCount,
    errorCount,
    warnings,
    actions: results,
    model: env.OPENAI_MODEL || "gpt-4.1-mini"
  }, errorCount > 0 && createdCount === 0 ? 422 : 200);
}

async function buildAssistantContext(env: Env): Promise<AssistantContext> {
  const [financialAccounts, ledgerAccounts, categories, counterparties, rules] = await Promise.all([
    selectAll(env, "financial_accounts", "name.asc"),
    selectAll(env, "ledger_accounts", "code.asc"),
    selectAll(env, "categories", "name.asc"),
    selectAll(env, "counterparties", "name.asc"),
    selectAll(env, "classification_rules", "created_at.desc")
  ]);

  return {
    financialAccounts: financialAccounts.map((account) => ({
      id: account.id,
      name: account.name,
      institution: account.institution,
      account_mask: account.account_mask,
      account_kind: account.account_kind,
      default_ledger_account_id: account.default_ledger_account_id
    })),
    ledgerAccounts: ledgerAccounts.map((account) => ({
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      normal_balance: account.normal_balance,
      parent_ledger_account_id: account.parent_ledger_account_id
    })),
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      default_ledger_account_id: category.default_ledger_account_id
    })),
    counterparties: counterparties.map((counterparty) => ({
      id: counterparty.id,
      name: counterparty.name,
      relationship_type: counterparty.relationship_type,
      tags: counterparty.tags || []
    })),
    rules: rules.map((rule) => ({
      id: rule.id,
      pattern: rule.pattern,
      suggested_category_id: rule.suggested_category_id,
      suggested_ledger_account_id: rule.suggested_ledger_account_id,
      suggested_counterparty: rule.suggested_counterparty
    }))
  };
}

async function planAssistantActions(env: Env, message: string, context: AssistantContext, apiKey: string): Promise<JsonRecord> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: ASSISTANT_SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            request: message,
            today: new Date().toISOString().slice(0, 10),
            existingData: context
          })
        }
      ]
    })
  });

  if (!res.ok) {
    throw new Error(`OpenAI request failed (${res.status}): ${redactSecret(await res.text())}`);
  }

  const data = await res.json() as JsonRecord;
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OpenAI returned an empty assistant plan.");
  }

  try {
    return JSON.parse(content) as JsonRecord;
  } catch {
    throw new Error("OpenAI returned an assistant plan that was not valid JSON.");
  }
}

async function executeAssistantAction(action: JsonRecord, env: Env, context: AssistantContext): Promise<AssistantActionResult> {
  const type = normalizeText(action.type);

  if (type === "create_account") return await createAssistantAccount(action, env, context);
  if (type === "create_counterparty") return await createAssistantCounterparty(action, env, context);
  if (type === "create_obligation") return await createAssistantObligation(action, env, context);
  if (type === "create_schedule") return await createAssistantSchedule(action, env, context);
  if (type === "create_rule") return await createAssistantRule(action, env, context);
  if (type === "create_transaction") return await createAssistantTransaction(action, env, context);

  return {
    type,
    status: "skipped",
    message: `Unsupported assistant action: ${type}`
  };
}

async function createAssistantAccount(action: JsonRecord, env: Env, context: AssistantContext): Promise<AssistantActionResult> {
  const rawName = normalizeText(action.name);
  const accountNumber = normalizeAccountNumber(action.accountNumber ?? action.account_number ?? action.last4);
  const accountKind = normalizeAccountKind(action.accountKind ?? action.account_kind ?? rawName);
  const institution = normalizeInstitution(action.institution, `${rawName} ${accountKind}`);
  const accountType = normalizeAccountType(action.accountType ?? action.account_type ?? inferAccountType(rawName, accountKind));
  const name = rawName || buildAccountName(institution, accountKind, accountNumber);

  if (!ALLOWED_ACCOUNT_TYPES.has(accountType)) {
    return {
      type: "create_account",
      status: "error",
      message: `Unsupported account type: ${accountType || "blank"}`
    };
  }

  if (!name) {
    return {
      type: "create_account",
      status: "error",
      message: "Account name is required."
    };
  }

  const duplicate = context.financialAccounts.find((account) => {
    const sameName = normalizeText(account.name).toLowerCase() === name.toLowerCase();
    const sameNumber = accountNumber &&
      normalizeText(account.institution).toLowerCase() === institution.toLowerCase() &&
      normalizeText(account.account_mask ?? account.accountNumber) === accountNumber;
    return sameName || sameNumber;
  });

  if (duplicate) {
    return {
      type: "create_account",
      status: "skipped",
      message: `Account already exists: ${duplicate.name}`,
      record: duplicate
    };
  }

  const defaultLedgerAccountId = pickDefaultLedgerAccount(context, accountKind, accountType);
  const record = {
    id: uniqueId(
      normalizeId(action.id) || buildAccountId("fa", institution, accountKind, accountNumber, name),
      context.financialAccounts.map((account) => account.id)
    ),
    name,
    accountKind: normalizeFinancialAccountKind(accountKind),
    accountMask: accountNumber,
    institution,
    sourceProvider: "assistant",
    currentBalance: Number(action.currentBalance ?? action.current_balance ?? 0),
    currency: normalizeText(action.currency) || "USD",
    defaultLedgerAccountId,
    isActive: true
  };

  const created = await insertAssistantRecord(env, "financial_accounts", mapFinancialAccountInput(record, false), "/api/finance/financial-accounts");
  context.financialAccounts.push({
    id: created.id,
    name: created.name,
    institution: created.institution,
    account_mask: created.account_mask,
    account_kind: created.account_kind,
    default_ledger_account_id: created.default_ledger_account_id
  });

  return {
    type: "create_account",
    status: "created",
    message: `Created account: ${created.name}`,
    record: created
  };
}

async function createAssistantCounterparty(action: JsonRecord, env: Env, context: AssistantContext): Promise<AssistantActionResult> {
  const name = normalizeText(action.name);
  if (!name) return assistantError("create_counterparty", "Counterparty name is required.");

  const duplicate = context.counterparties.find((counterparty) => normalizeText(counterparty.name).toLowerCase() === name.toLowerCase());
  if (duplicate) {
    return {
      type: "create_counterparty",
      status: "skipped",
      message: `Counterparty already exists: ${duplicate.name}`,
      record: duplicate
    };
  }

  const created = await insertAssistantRecord(env, "counterparties", mapCounterpartyInput({
    ...action,
    id: normalizeId(action.id) || `cp-${slugify(name)}`,
    name
  }, false), "/api/finance/counterparties");

  context.counterparties.push({
    id: created.id,
    name: created.name,
    relationship_type: created.relationship_type,
    tags: created.tags || []
  });

  return {
    type: "create_counterparty",
    status: "created",
    message: `Created counterparty: ${created.name}`,
    record: created
  };
}

async function createAssistantObligation(action: JsonRecord, env: Env, context: AssistantContext): Promise<AssistantActionResult> {
  const counterpartyId = normalizeText(action.counterpartyId ?? action.counterparty_id);
  const amount = Number(action.amount);
  const obligationType = normalizeText(action.obligationType ?? action.obligation_type ?? action.kind);
  const description = normalizeText(action.description);

  const missing = missingFields([
    ["counterpartyId", counterpartyId],
    ["amount", Number.isFinite(amount) ? amount : ""],
    ["obligationType", obligationType],
    ["description", description]
  ]);
  if (missing.length > 0) return assistantError("create_obligation", `Missing obligation fields: ${missing.join(", ")}`);
  if (!context.counterparties.some((counterparty) => counterparty.id === counterpartyId)) {
    return assistantError("create_obligation", `Counterparty not found: ${counterpartyId}`);
  }

  const created = await insertAssistantRecord(env, "obligations", mapObligationInput({
    ...action,
    counterpartyId,
    amount,
    type: obligationType,
    description
  }, false), "/api/finance/obligations");

  return {
    type: "create_obligation",
    status: "created",
    message: `Created obligation: ${created.description}`,
    record: created
  };
}

async function createAssistantSchedule(action: JsonRecord, env: Env, context: AssistantContext): Promise<AssistantActionResult> {
  const name = normalizeText(action.name);
  const amount = Number(action.amount);
  const accountId = normalizeText(action.ledgerAccountId ?? action.ledger_account_id ?? action.accountId ?? action.account_id ?? action.categoryAccountId ?? action.category_account_id);
  const sourceAccountId = normalizeText(action.financialAccountId ?? action.financial_account_id ?? action.sourceAccountId ?? action.source_account_id);
  const frequency = normalizeText(action.frequency);
  const nextDueDate = normalizeText(action.nextDueDate ?? action.next_due_date);

  const missing = missingFields([
    ["name", name],
    ["amount", Number.isFinite(amount) ? amount : ""],
    ["accountId", accountId],
    ["sourceAccountId", sourceAccountId],
    ["frequency", frequency],
    ["nextDueDate", nextDueDate]
  ]);
  if (missing.length > 0) return assistantError("create_schedule", `Missing schedule fields: ${missing.join(", ")}`);
  if (!ledgerAccountExists(context, accountId)) return assistantError("create_schedule", `Ledger account not found: ${accountId}`);
  if (!financialAccountExists(context, sourceAccountId)) return assistantError("create_schedule", `Financial account not found: ${sourceAccountId}`);

  const created = await insertAssistantRecord(env, "recurring_transactions", mapScheduleInput({
    ...action,
    name,
    amount,
    accountId,
    sourceAccountId,
    frequency,
    nextDueDate
  }, false), "/api/finance/schedules");

  return {
    type: "create_schedule",
    status: "created",
    message: `Created schedule: ${created.name}`,
    record: created
  };
}

async function createAssistantRule(action: JsonRecord, env: Env, context: AssistantContext): Promise<AssistantActionResult> {
  const pattern = normalizeText(action.pattern);
  const suggestedAccountId = normalizeText(action.suggestedLedgerAccountId ?? action.suggested_ledger_account_id ?? action.suggestedAccountId ?? action.suggested_account_id);
  const missing = missingFields([
    ["pattern", pattern],
    ["suggestedAccountId", suggestedAccountId]
  ]);
  if (missing.length > 0) return assistantError("create_rule", `Missing rule fields: ${missing.join(", ")}`);
  if (!ledgerAccountExists(context, suggestedAccountId)) return assistantError("create_rule", `Suggested ledger account not found: ${suggestedAccountId}`);

  const duplicate = context.rules.find((rule) => normalizeText(rule.pattern).toLowerCase() === pattern.toLowerCase());
  if (duplicate) {
    return {
      type: "create_rule",
      status: "skipped",
      message: `Rule already exists for pattern: ${duplicate.pattern}`,
      record: duplicate
    };
  }

  const created = await insertAssistantRecord(env, "classification_rules", mapRuleInput({
    ...action,
    pattern,
    suggestedAccountId
  }, false), "/api/finance/rules");

  context.rules.push({
    id: created.id,
    pattern: created.pattern,
    suggested_ledger_account_id: created.suggested_ledger_account_id,
    suggested_counterparty: created.suggested_counterparty
  });

  return {
    type: "create_rule",
    status: "created",
    message: `Created rule: ${created.pattern}`,
    record: created
  };
}

async function createAssistantTransaction(action: JsonRecord, env: Env, context: AssistantContext): Promise<AssistantActionResult> {
  const date = normalizeText(action.date);
  const description = normalizeText(action.description);
  const amount = Number(action.amount);
  const sourceAccountId = normalizeText(action.financialAccountId ?? action.financial_account_id ?? action.sourceAccountId ?? action.source_account_id);
  const categoryAccountId = normalizeText(action.ledgerAccountId ?? action.ledger_account_id ?? action.categoryAccountId ?? action.category_account_id ?? action.accountId ?? action.account_id);

  const missing = missingFields([
    ["date", date],
    ["description", description],
    ["amount", Number.isFinite(amount) ? amount : ""],
    ["sourceAccountId", sourceAccountId]
  ]);
  if (missing.length > 0) return assistantError("create_transaction", `Missing transaction fields: ${missing.join(", ")}`);
  if (!financialAccountExists(context, sourceAccountId)) return assistantError("create_transaction", `Financial account not found: ${sourceAccountId}`);
  if (categoryAccountId && !ledgerAccountExists(context, categoryAccountId)) {
    return assistantError("create_transaction", `Ledger account not found: ${categoryAccountId}`);
  }

  const txToInsert = mapTransactionInput({
    ...action,
    id: normalizeId(action.id) || `tx-${crypto.randomUUID()}`,
    date,
    description,
    amount,
    financialAccountId: sourceAccountId,
    journalStatus: categoryAccountId ? "draft" : "not_posted"
  }, false);

  const created = await insertAssistantRecord(env, "transactions", txToInsert, "/api/finance/transactions");
  if (categoryAccountId) await replaceJournalEntries(env, created, categoryAccountId);

  return {
    type: "create_transaction",
    status: "created",
    message: `Created transaction: ${created.description}`,
    record: created
  };
}

async function insertAssistantRecord(env: Env, table: string, record: JsonRecord, route: string): Promise<JsonRecord> {
  const res = await supabaseFetch(env, `/${table}`, {
    method: "POST",
    body: JSON.stringify(record),
    headers: { "Prefer": "return=representation" }
  });

  if (!res.ok) throw new Error(await supabaseExecutionError(res, route));
  const data = await res.json() as JsonRecord[];
  return data[0];
}

async function supabaseExecutionError(res: Response, route: string): Promise<string> {
  const details = await res.text();
  return `Supabase request failed for ${route} (${res.status}): ${truncate(details, 600)}`;
}

function assistantError(type: string, message: string): AssistantActionResult {
  return { type, status: "error", message };
}

function financialAccountExists(context: AssistantContext, id: string): boolean {
  return context.financialAccounts.some((account) => account.id === id);
}

function ledgerAccountExists(context: AssistantContext, id: string): boolean {
  return context.ledgerAccounts.some((account) => account.id === id);
}

function pickDefaultLedgerAccount(context: AssistantContext, accountKind: string, accountType: string): string | null {
  const kind = normalizeFinancialAccountKind(accountKind);
  const preferredByKind: Record<string, string> = {
    cash: "ledger-cash-on-hand",
    checking: "ledger-bank-accounts",
    savings: "ledger-bank-accounts",
    wallet: "ledger-bank-accounts",
    platform: "ledger-bank-accounts",
    credit_card: "ledger-credit-cards-payable",
    loan: "ledger-loans-payable"
  };
  const preferred = preferredByKind[kind] || (accountType === "liability" ? "ledger-credit-cards-payable" : "ledger-bank-accounts");
  return ledgerAccountExists(context, preferred) ? preferred : null;
}

function missingFields(fields: [string, any][]): string[] {
  return fields
    .filter(([, value]) => value === undefined || value === null || value === "")
    .map(([name]) => name);
}

function normalizeAccountType(value: any): string {
  const type = normalizeText(value).toLowerCase();
  return ALLOWED_ACCOUNT_TYPES.has(type) ? type : "";
}

function inferAccountType(name: string, kind: string): string {
  const text = `${name} ${kind}`.toLowerCase();
  if (/(credit card|card|loan|mortgage|liability)/.test(text)) return "liability";
  if (/(income|revenue)/.test(text)) return "revenue";
  if (/(expense|cost)/.test(text)) return "expense";
  return "asset";
}

function normalizeAccountKind(value: any): string {
  const text = normalizeText(value).toLowerCase();
  if (text.includes("checking")) return "checking";
  if (text.includes("savings") || text.includes("saving")) return "savings";
  if (text.includes("credit")) return "credit card";
  if (text.includes("loan")) return "loan";
  if (text.includes("cash")) return "cash";
  return normalizeText(value);
}

function normalizeFinancialAccountKind(value: any): string {
  const text = normalizeText(value).toLowerCase().replace(/[\s-]+/g, "_");
  if (text.includes("checking")) return "checking";
  if (text.includes("saving")) return "savings";
  if (text.includes("credit")) return "credit_card";
  if (text.includes("loan")) return "loan";
  if (text.includes("wallet")) return "wallet";
  if (text.includes("cash")) return "cash";
  if (text.includes("platform")) return "platform";
  return ["checking", "savings", "credit_card", "loan", "wallet", "cash", "platform", "other"].includes(text) ? text : "other";
}

function normalizeInstitution(value: any, fallbackText = ""): string {
  const raw = normalizeText(value);
  const haystack = `${raw} ${fallbackText}`.toLowerCase();
  if (/(jp\s?morgan|j\.p\.\s?morgan|jpmorgan|chase)/i.test(haystack)) return "JPMorgan Chase";
  return raw;
}

function normalizeAccountNumber(value: any): string {
  const text = normalizeText(value);
  if (!text) return "";
  return text.replace(/\s+/g, "");
}

function buildAccountName(institution: string, accountKind: string, accountNumber: string): string {
  return [institution, titleCase(accountKind || "account"), accountNumber].filter(Boolean).join(" ").trim();
}

function buildAccountId(accountType: string, institution: string, accountKind: string, accountNumber: string, name: string): string {
  const parts = [accountType, institution, accountKind, accountNumber || name]
    .map(slugify)
    .filter(Boolean);
  return parts.length > 0 ? parts.join("-") : `account-${crypto.randomUUID()}`;
}

function nextAccountCode(accounts: JsonRecord[], accountType: string): string {
  const baseByType: Record<string, number> = {
    asset: 1000,
    liability: 2000,
    equity: 3000,
    revenue: 4000,
    expense: 5000,
    clearing: 8000,
    suspense: 9000
  };
  const usedCodes = new Set(accounts.map((account) => normalizeText(account.code)));
  let max = -1;
  let width = 4;

  for (const account of accounts) {
    if (normalizeText(account.type) !== accountType) continue;
    const code = normalizeText(account.code);
    if (!/^\d+$/.test(code)) continue;
    max = Math.max(max, Number.parseInt(code, 10));
    width = Math.max(width, code.length);
  }

  let next = max >= 0 ? max + 10 : baseByType[accountType] ?? 1000;
  let candidate = String(next).padStart(width, "0");
  while (usedCodes.has(candidate)) {
    next += 10;
    candidate = String(next).padStart(width, "0");
  }
  return candidate;
}

function uniqueId(base: string, existingIds: string[]): string {
  const used = new Set(existingIds);
  const cleanBase = normalizeId(base) || `record-${crypto.randomUUID()}`;
  let candidate = cleanBase;
  let index = 2;

  while (used.has(candidate)) {
    candidate = `${cleanBase}-${index}`;
    index += 1;
  }

  return candidate;
}

function normalizeId(value: any): string {
  return slugify(value).slice(0, 100).replace(/^-+|-+$/g, "");
}

function slugify(value: any): string {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function titleCase(value: string): string {
  return value.replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeText(value: any): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function inferNormalBalance(accountType: any): string {
  return ["asset", "expense", "clearing", "suspense"].includes(normalizeText(accountType)) ? "debit" : "credit";
}

function normalizeUuidOrNull(value: any): string | null {
  const text = normalizeText(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : null;
}

function mapJournalLineForLegacyClient(line: JsonRecord): JsonRecord {
  return {
    ...line,
    transaction_id: line.transaction_id ?? line.journal_entry_id,
    account_id: line.ledger_account_id,
    date: line.date ?? line.created_at
  };
}

function toStringArray(value: any): string[] {
  return Array.isArray(value) ? value.map(normalizeText).filter(Boolean) : [];
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function redactSecret(value: string): string {
  return truncate(value.replace(/sk-[A-Za-z0-9_-]+/g, "sk-...redacted"), 900);
}

async function handleDomainRoute(domain: string, id: string | undefined, request: Request, env: Env): Promise<Response> {
  const config = DOMAIN_ROUTES[domain];
  const route = `/api/finance/${domain}${id ? "/:id" : ""}`;

  if (!id && request.method === "GET") {
    const data = await selectAll(env, config.table, config.order);
    return json(data);
  }

  if (!id && request.method === "POST") {
    if (!config.mapInput) return json({ error: `${domain} cannot be created through this route` }, 405);
    const body = await request.json() as JsonRecord;
    const res = await supabaseFetch(env, `/${config.table}`, {
      method: "POST",
      body: JSON.stringify(config.mapInput(body, false)),
      headers: { "Prefer": "return=representation" }
    });
    if (!res.ok) return await handleSupabaseError(res, route);
    const data = await res.json() as any[];
    return json(data[0]);
  }

  if (id && (request.method === "PATCH" || request.method === "PUT")) {
    if (!config.mapInput) return json({ error: `${domain} cannot be updated through this route` }, 405);
    const body = await request.json() as JsonRecord;
    const res = await supabaseFetch(env, `/${config.table}?id=eq.${filterValue(id)}`, {
      method: "PATCH",
      body: JSON.stringify(config.mapInput(body, true)),
      headers: { "Prefer": "return=representation" }
    });
    if (!res.ok) return await handleSupabaseError(res, route);
    const data = await res.json() as any[];
    if (data.length === 0) return json({ error: `${domain} item not found` }, 404);
    return json(data[0]);
  }

  if (id && request.method === "DELETE") {
    const res = await supabaseFetch(env, `/${config.table}?id=eq.${filterValue(id)}`, {
      method: "DELETE",
      headers: { "Prefer": "return=representation" }
    });
    if (!res.ok) return await handleSupabaseError(res, route);
    const data = await res.json() as any[];
    if (data.length === 0) return json({ error: `${domain} item not found` }, 404);
    return json({ message: `${domain} item deleted`, deleted: data[0] });
  }

  return json({ error: `Method not allowed: ${request.method} ${route}` }, 405);
}

async function handleGetAccounts(env: Env): Promise<Response> {
  return json(await selectAll(env, "ledger_accounts", "code.asc"));
}

async function handleGetCategories(env: Env): Promise<Response> {
  return json(await selectAll(env, "categories", "name.asc"));
}

async function handleCreateAccount(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as JsonRecord;
  const res = await supabaseFetch(env, "/ledger_accounts", {
    method: "POST",
    body: JSON.stringify(mapLedgerAccountInput(body, false)),
    headers: { "Prefer": "return=representation" }
  });
  if (!res.ok) return await handleSupabaseError(res, "/api/finance/accounts");
  const data = await res.json() as any[];
  return json(data[0]);
}

async function handleUpdateAccount(id: string, request: Request, env: Env): Promise<Response> {
  const body = await request.json() as JsonRecord;
  const res = await supabaseFetch(env, `/ledger_accounts?id=eq.${filterValue(id)}`, {
    method: "PATCH",
    body: JSON.stringify(mapLedgerAccountInput(body, true)),
    headers: { "Prefer": "return=representation" }
  });
  if (!res.ok) return await handleSupabaseError(res, "/api/finance/accounts/:id");
  const data = await res.json() as any[];
  if (data.length === 0) return json({ error: "Account not found" }, 404);
  return json(data[0]);
}

async function handleDeleteAccount(id: string, env: Env): Promise<Response> {
  const res = await supabaseFetch(env, `/ledger_accounts?id=eq.${filterValue(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: false, updated_at: new Date().toISOString() }),
    headers: { "Prefer": "return=representation" }
  });
  if (!res.ok) return await handleSupabaseError(res, "/api/finance/accounts/:id");
  const data = await res.json() as any[];
  if (data.length === 0) return json({ error: "Account not found" }, 404);
  return json({ message: "Account disabled", account: data[0] });
}

async function handleCreateCategory(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as JsonRecord;
  const res = await supabaseFetch(env, "/categories", {
    method: "POST",
    body: JSON.stringify(mapCategoryInput(body, false)),
    headers: { "Prefer": "return=representation" }
  });
  if (!res.ok) return await handleSupabaseError(res, "/api/finance/categories");
  const data = await res.json() as any[];
  return json(data[0]);
}

async function handleGetTransactions(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const limit = clampInteger(url.searchParams.get("limit"), 100, 1, 1000);
  const offset = clampInteger(url.searchParams.get("offset"), 0, 0, 100000);

  const res = await supabaseFetch(
    env,
    `/transactions?select=*&order=transaction_date.desc&limit=${limit}&offset=${offset}`
  );
  if (!res.ok) return await handleSupabaseError(res, "/api/finance/transactions");
  return json(await res.json());
}

async function handleGetTransactionById(id: string, env: Env): Promise<Response> {
  const res = await supabaseFetch(env, `/transactions?id=eq.${filterValue(id)}&select=*`);
  if (!res.ok) return await handleSupabaseError(res, "/api/finance/transactions/:id");
  const data = await res.json() as any[];
  if (data.length === 0) return json({ error: "Transaction not found" }, 404);
  return json(data[0]);
}

async function handleCreateTransaction(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as JsonRecord;

  if (Array.isArray(body) || body.csvText || body.rows) {
    return json({
      error: "CSV import payloads must be posted to /api/finance/import/commit",
      route: "/api/finance/transactions",
      expectedRoute: "/api/finance/import/commit"
    }, 400);
  }

  const sourceAccountId = body.financialAccountId ?? body.financial_account_id ?? body.sourceAccountId ?? body.source_account_id;
  const missingFields = [
    ["date", body.date ?? body.transaction_date],
    ["description", body.description ?? body.description_clean],
    ["amount", body.amount],
    ["financialAccountId", sourceAccountId]
  ].filter(([, value]) => value === undefined || value === null || value === "");

  if (missingFields.length > 0) {
    return json({
      error: "Missing required transaction fields",
      route: "/api/finance/transactions",
      missingFields: missingFields.map(([field]) => field)
    }, 400);
  }

  const categoryAccountId = body.ledgerAccountId ?? body.ledger_account_id ?? body.categoryAccountId ?? body.category_account_id;

  const txToInsert = mapTransactionInput(body, false);
  txToInsert.journal_status = categoryAccountId ? "draft" : txToInsert.journal_status;

  const res = await supabaseFetch(env, "/transactions", {
    method: "POST",
    body: JSON.stringify(txToInsert),
    headers: { "Prefer": "return=representation" }
  });
  if (!res.ok) return await handleSupabaseError(res, "/api/finance/transactions");
  const data = await res.json() as any[];
  const created = data[0];

  if (categoryAccountId) {
    await replaceJournalEntries(env, created, categoryAccountId);
  }

  return json(created);
}

async function handleUpdateTransaction(id: string, request: Request, env: Env): Promise<Response> {
  const body = await request.json() as JsonRecord;
  const categoryAccountId = body.ledgerAccountId ?? body.ledger_account_id ?? body.categoryAccountId ?? body.category_account_id;

  const txUpdates = mapTransactionInput(body, true);

  const res = await supabaseFetch(env, `/transactions?id=eq.${filterValue(id)}`, {
    method: "PATCH",
    body: JSON.stringify(txUpdates),
    headers: { "Prefer": "return=representation" }
  });

  if (!res.ok) return await handleSupabaseError(res, "/api/finance/transactions/:id");
  const data = await res.json() as any[];
  if (data.length === 0) return json({ error: "Transaction not found to update" }, 404);

  if (categoryAccountId) {
    await replaceJournalEntries(env, data[0], categoryAccountId);
  }

  return json(data[0]);
}

async function handleDeleteTransaction(id: string, env: Env): Promise<Response> {
  const res = await supabaseFetch(env, `/transactions?id=eq.${filterValue(id)}`, {
    method: "DELETE",
    headers: { "Prefer": "return=representation" }
  });

  if (!res.ok) return await handleSupabaseError(res, "/api/finance/transactions/:id");
  const data = await res.json() as any[];
  if (data.length === 0) return json({ error: "Transaction not found to delete" }, 404);
  return json({ message: "Transaction deleted successfully", deleted: data[0] });
}

function parseCSV(rawText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < rawText.length; i++) {
    const char = rawText[i];
    const next = rawText[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(current.trim());
      current = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(current.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  row.push(current.trim());
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  return rows;
}

function normalizeMerchantName(rawDesc: string): string {
  let clean = rawDesc.toUpperCase().trim();

  clean = clean.replace(/TST\*\s*/g, "");
  clean = clean.replace(/SQ\s*\*\s*/g, "");
  clean = clean.replace(/\d{4,}/g, "");
  clean = clean.replace(/\b(INC|LLC|CORP|CO|LTD)\b/g, "");
  clean = clean.replace(/\s+/g, " ").trim();

  if (clean.includes("GOOGLE")) return "Google Cloud";
  if (clean.includes("GITHUB")) return "GitHub";
  if (clean.includes("UBER")) return "Uber";
  if (clean.includes("LYFT")) return "Lyft";
  if (clean.includes("WHOLE FOODS") || clean.includes("WHOLEFOODS")) return "Whole Foods";
  if (clean.includes("FIGMA")) return "Figma";
  if (clean.includes("NETFLIX")) return "Netflix";
  if (clean.includes("AMAZON")) return "Amazon";
  if (clean.includes("VENMO")) return "Venmo";

  return clean
    .toLowerCase()
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function runCategorizationHeuristics(rawDesc: string, rules: any[]): { ledgerAccountId: string; categoryId: string | null; tags: string[]; counterparty: string; confidence: number } {
  const cleanDesc = rawDesc.toLowerCase();

  for (const rule of rules) {
    if (cleanDesc.includes(rule.pattern.toLowerCase())) {
      return {
        ledgerAccountId: rule.suggested_ledger_account_id || "ledger-import-suspense",
        categoryId: rule.suggested_category_id || null,
        tags: rule.suggested_tags || [],
        counterparty: rule.suggested_counterparty || "",
        confidence: 0.95
      };
    }
  }

  if (cleanDesc.includes("gas") || cleanDesc.includes("chevron") || cleanDesc.includes("shell")) {
    return { ledgerAccountId: "ledger-fuel", categoryId: "cat-gas", tags: ["vehicle"], counterparty: "Fuel Gas Station", confidence: 0.85 };
  }
  if (cleanDesc.includes("dining") || cleanDesc.includes("mcdonald") || cleanDesc.includes("starbucks") || cleanDesc.includes("cafe")) {
    return { ledgerAccountId: "ledger-meals", categoryId: "cat-food", tags: ["meals"], counterparty: "Restaurant/Cafe", confidence: 0.80 };
  }
  if (cleanDesc.includes("lyft") || cleanDesc.includes("uber")) {
    return { ledgerAccountId: "ledger-auto-vehicle", categoryId: "cat-lyft-rental", tags: ["vehicle"], counterparty: "Rideshare", confidence: 0.90 };
  }
  if (cleanDesc.includes("transfer") || cleanDesc.includes("payment") || cleanDesc.includes("venmo")) {
    return { ledgerAccountId: "ledger-transfer-clearing", categoryId: null, tags: ["transfer"], counterparty: "Cleared Fund Transfer", confidence: 0.70 };
  }

  return {
    ledgerAccountId: "ledger-import-suspense",
    categoryId: "cat-uncategorized",
    tags: ["uncategorized"],
    counterparty: normalizeMerchantName(rawDesc),
    confidence: 0.40
  };
}

async function handleImportPreview(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as JsonRecord;
  const { csvText, fileName, columnMappings, hasHeaders, amountMode } = body;

  const mappedTargets = Object.values(columnMappings || {}).flat();
  const hasInflowMapped = mappedTargets.includes("inflow_amount");
  const hasOutflowMapped = mappedTargets.includes("amount");
  const effectiveAmountMode = amountMode || (hasInflowMapped && hasOutflowMapped ? "separate" : "single");

  if (!csvText) return json({ error: "Missing csvText in request body" }, 400);

  const parsedLines = parseCSV(csvText);
  if (parsedLines.length === 0) return json({ error: "Empty or invalid CSV file" }, 400);

  const rules = await selectAll(env, "classification_rules", "created_at.desc");
  const ledgerAccounts = await selectAll(env, "ledger_accounts", "code.asc");
  const ledgerAccountIds = new Set(ledgerAccounts.map((a: any) => a.id));

  const txRes = await supabaseFetch(env, "/transactions?select=transaction_date,amount,description_clean&order=transaction_date.desc&limit=1000");
  if (!txRes.ok) return await handleSupabaseError(txRes, "/api/finance/import/preview");
  const existingTransactions = await txRes.json() as any[];
  const dataLines = hasHeaders ? parsedLines.slice(1) : parsedLines;

  const previewRows = dataLines.map((line, lineIndex) => {
    const rowData = {
      date: "",
      description: "",
      amount: 0,
      counterparty: "",
      accountId: "",
      tags: [] as string[],
      memo: ""
    };

    let parsedOutflow = 0;
    let parsedInflow = 0;
    let hasOutflowCol = false;
    let hasInflowCol = false;

    for (let i = 0; i < line.length; i++) {
      const val = (line[i] || "").trim();
      const targets = columnMappings[i] || [];

      targets.forEach((target: string) => {
        if (target === "date") {
          rowData.date = val;
        } else if (target === "description") {
          rowData.description = rowData.description ? `${rowData.description} ${val}` : val;
        } else if (target === "amount") {
          hasOutflowCol = true;
          const num = Number(val.replace(/[$,\s]/g, ""));
          if (!isNaN(num)) parsedOutflow = num;
        } else if (target === "inflow_amount") {
          hasInflowCol = true;
          const num = Number(val.replace(/[$,\s]/g, ""));
          if (!isNaN(num)) parsedInflow = num;
        } else if (target === "counterparty") {
          rowData.counterparty = rowData.counterparty ? `${rowData.counterparty} ${val}` : val;
        } else if (target === "accountId") {
          rowData.accountId = val;
        } else if (target === "tags") {
          rowData.tags = [...rowData.tags, ...val.split(/[,;|]/).map(x => x.trim()).filter(Boolean)];
        } else if (target === "memo") {
          rowData.memo = rowData.memo ? `${rowData.memo} ${val}` : val;
        }
      });
    }

    if (effectiveAmountMode === "separate" && hasOutflowCol && hasInflowCol) {
      if (parsedOutflow !== 0 && parsedInflow === 0) {
        rowData.amount = parsedOutflow > 0 ? -parsedOutflow : parsedOutflow;
      } else if (parsedInflow !== 0 && parsedOutflow === 0) {
        rowData.amount = Math.abs(parsedInflow);
      } else {
        rowData.amount = parsedInflow - parsedOutflow;
      }
    } else if (hasOutflowCol) {
      rowData.amount = parsedOutflow;
    }

    let dateStr = rowData.date;
    try {
      const parsedDate = new Date(rowData.date);
      if (!isNaN(parsedDate.getTime())) dateStr = parsedDate.toISOString().split("T")[0];
    } catch {}

    const suggestion = runCategorizationHeuristics(rowData.description, rules);
    const targetAccountId = rowData.accountId || suggestion.ledgerAccountId;
    const finalAccountId = ledgerAccountIds.has(targetAccountId) ? targetAccountId : "ledger-import-suspense";
    const rowAbsAmount = Math.abs(rowData.amount);
    const rowTime = new Date(dateStr).getTime();

    const duplicates = existingTransactions.filter((tx: any) => {
      const txAbsAmount = Math.abs(Number(tx.amount));
      const txTime = new Date(tx.transaction_date).getTime();
      const diffDays = Math.abs(rowTime - txTime) / (1000 * 60 * 60 * 24);
      return diffDays <= 3 && Math.abs(rowAbsAmount - txAbsAmount) < 0.01;
    });

    return {
      index: lineIndex,
      date: dateStr,
      description: rowData.description,
      rawDescription: rowData.description,
      amount: rowData.amount,
      suggestedAccountId: finalAccountId,
      suggestedLedgerAccountId: finalAccountId,
      suggestedCategoryId: suggestion.categoryId,
      suggestedCounterparty: rowData.counterparty || suggestion.counterparty,
      suggestedTags: rowData.tags.length > 0 ? rowData.tags : suggestion.tags,
      confidence: suggestion.confidence,
      isDuplicate: duplicates.length > 0,
      duplicateMatch: duplicates.length > 0 ? duplicates[0] : null,
      memo: rowData.memo
    };
  }).filter(r => r.date !== "" && r.description !== "");

  return json({
    fileName,
    rawCount: previewRows.length,
    rows: previewRows,
    missingCategories: Array.from(new Set(previewRows.map(r => r.suggestedAccountId).filter(id => !ledgerAccountIds.has(id)))),
    missingCounterparties: []
  });
}

async function handleImportCommit(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as JsonRecord;
  const { fileName, rows } = body;
  const sourceAccountId = body.financialAccountId ?? body.financial_account_id ?? body.sourceAccountId ?? body.source_account_id;

  if (!rows || !Array.isArray(rows)) {
    return json({ error: "Missing rows array in request body" }, 400);
  }

  if (!sourceAccountId) {
    return json({ error: "Missing financialAccountId/sourceAccountId in request body" }, 400);
  }

  const batchRes = await supabaseFetch(env, "/import_batches", {
    method: "POST",
    body: JSON.stringify({
      workspace_id: "default",
      file_name: fileName,
      row_count: rows.length,
      financial_account_id: sourceAccountId,
      status: "committed"
    }),
    headers: { "Prefer": "return=representation" }
  });

  if (!batchRes.ok) return await handleSupabaseError(batchRes, "/api/finance/import/commit");
  const batchData = await batchRes.json() as any[];
  const batchId = batchData[0].id;

  const rawRowsToInsert = rows.map((row: any, idx: number) => ({
    workspace_id: "default",
    import_batch_id: batchId,
    row_number: row.index ?? idx,
    raw_data: row,
    raw_hash: `${batchId}:${row.index ?? idx}:${row.date}:${row.amount}:${row.description}`,
    normalized_status: row.isDuplicate ? "ignored" : "processed",
    suggested_category_id: row.suggestedCategoryId ?? null,
    suggested_ledger_account_id: row.suggestedLedgerAccountId || row.suggestedAccountId || "ledger-import-suspense",
    suggested_counterparty: row.suggestedCounterparty || "",
    memo: row.memo || ""
  }));

  const rawRowsRes = await supabaseFetch(env, "/import_rows_raw", {
    method: "POST",
    body: JSON.stringify(rawRowsToInsert),
    headers: { "Prefer": "return=representation" }
  });
  if (!rawRowsRes.ok) return await handleSupabaseError(rawRowsRes, "/api/finance/import/commit");
  const rawRowsData = await rawRowsRes.json() as any[];

  const nonDuplicateRows = rows.filter((row: any) => !row.isDuplicate);
  let txData: any[] = [];

  if (nonDuplicateRows.length > 0) {
    const transactionsToInsert = nonDuplicateRows.map((row: any) => {
      const originalIdx = row.index ?? rows.indexOf(row);
      const rawRow = rawRowsData.find((raw) => Number(raw.row_number) === Number(originalIdx));

      const record = mapTransactionInput({
        date: row.date,
        description: row.description,
        rawDescription: row.rawDescription || row.description,
        amount: row.amount,
        financialAccountId: sourceAccountId,
        categoryId: row.suggestedCategoryId ?? null,
        tags: row.suggestedTags || [],
        counterparty: row.suggestedCounterparty || "",
        importBatchId: batchId,
        rawRowId: rawRow?.id,
        importStatus: "imported",
        classificationStatus: row.suggestedAccountId ? "classified" : "unclassified",
        journalStatus: "draft",
        sourceMetadata: {
          raw_row_index: row.index,
          import_confidence: row.confidence
        }
      }, false);
      return record;
    });

    const txRes = await supabaseFetch(env, "/transactions", {
      method: "POST",
      body: JSON.stringify(transactionsToInsert),
      headers: { "Prefer": "return=representation" }
    });

    if (!txRes.ok) return await handleSupabaseError(txRes, "/api/finance/import/commit");
    txData = await txRes.json() as any[];

    for (let i = 0; i < txData.length; i++) {
      const row = nonDuplicateRows[i];
      await replaceJournalEntries(env, txData[i], row.suggestedLedgerAccountId || row.suggestedAccountId || "ledger-import-suspense");
    }
  }

  return json({
    message: "CSV statement imported successfully",
    batchId,
    totalRows: rows.length,
    createdCount: txData.length,
    transactions: txData
  });
}

function mapAccountInput(body: JsonRecord, isUpdate = false): JsonRecord {
  return mapLedgerAccountInput(body, isUpdate);
}

function mapLedgerAccountInput(body: JsonRecord, isUpdate = false): JsonRecord {
  const accountType = body.type ?? "expense";
  return compact({
    id: isUpdate ? undefined : (body.id ?? `ledger-${slugify(body.name ?? crypto.randomUUID())}`),
    workspace_id: body.workspaceId ?? body.workspace_id ?? "default",
    code: body.code,
    name: body.name,
    type: accountType,
    normal_balance: body.normalBalance ?? body.normal_balance ?? inferNormalBalance(accountType),
    parent_ledger_account_id: body.parentLedgerAccountId ?? body.parent_ledger_account_id ?? body.parentAccountId ?? body.parent_account_id ?? null,
    description: body.description ?? "",
    is_active: body.isActive ?? body.is_active,
    updated_at: new Date().toISOString()
  });
}

function mapFinancialAccountInput(body: JsonRecord, isUpdate = false): JsonRecord {
  return compact({
    id: isUpdate ? undefined : (body.id ?? `fa-${slugify(body.name ?? crypto.randomUUID())}`),
    workspace_id: body.workspaceId ?? body.workspace_id ?? "default",
    name: body.name,
    institution: body.institution ?? null,
    account_mask: body.accountMask ?? body.account_mask ?? body.accountNumber ?? body.account_number ?? null,
    account_kind: body.accountKind ?? body.account_kind ?? "other",
    source_provider: body.sourceProvider ?? body.source_provider ?? "manual",
    current_balance: body.currentBalance ?? body.current_balance ?? 0,
    currency: body.currency ?? "USD",
    default_ledger_account_id: body.defaultLedgerAccountId ?? body.default_ledger_account_id ?? null,
    is_active: body.isActive ?? body.is_active,
    updated_at: new Date().toISOString()
  });
}

function mapCategoryInput(body: JsonRecord, isUpdate = false): JsonRecord {
  return compact({
    id: isUpdate ? undefined : (body.id ?? `cat-${slugify(body.name ?? crypto.randomUUID())}`),
    workspace_id: body.workspaceId ?? body.workspace_id ?? "default",
    name: body.name,
    description: body.description ?? "",
    default_ledger_account_id: body.defaultLedgerAccountId ?? body.default_ledger_account_id ?? body.suggestedAccountId ?? body.suggested_account_id ?? null,
    is_active: body.isActive ?? body.is_active,
    updated_at: new Date().toISOString()
  });
}

function mapTaxMappingInput(body: JsonRecord, isUpdate = false): JsonRecord {
  return compact({
    id: isUpdate ? undefined : (body.id ?? `tax-${crypto.randomUUID()}`),
    workspace_id: body.workspaceId ?? body.workspace_id ?? "default",
    category_id: body.categoryId ?? body.category_id ?? null,
    ledger_account_id: body.ledgerAccountId ?? body.ledger_account_id ?? null,
    tax_form: body.taxForm ?? body.tax_form,
    tax_line: body.taxLine ?? body.tax_line,
    label: body.label,
    notes: body.notes ?? "",
    is_active: body.isActive ?? body.is_active,
    updated_at: new Date().toISOString()
  });
}

function mapRuleInput(body: JsonRecord, isUpdate = false): JsonRecord {
  return compact({
    id: isUpdate ? undefined : (body.id ?? `rule-${Date.now()}`),
    workspace_id: body.workspaceId ?? body.workspace_id ?? "default",
    pattern: body.pattern,
    match_field: body.matchField ?? body.match_field ?? "description",
    suggested_category_id: body.suggestedCategoryId ?? body.suggested_category_id ?? null,
    suggested_ledger_account_id: body.suggestedLedgerAccountId ?? body.suggested_ledger_account_id ?? body.suggestedAccountId ?? body.suggested_account_id,
    suggested_tags: body.suggestedTags ?? body.suggested_tags ?? [],
    suggested_counterparty: body.suggestedCounterparty ?? body.suggested_counterparty ?? "",
    description: body.description ?? "",
    is_active: body.isActive ?? body.is_active,
    updated_at: new Date().toISOString()
  });
}

function mapAttachmentInput(body: JsonRecord, isUpdate = false): JsonRecord {
  return compact({
    id: isUpdate ? undefined : (body.id ?? `attach-${crypto.randomUUID()}`),
    workspace_id: body.workspaceId ?? body.workspace_id ?? "default",
    transaction_id: normalizeUuidOrNull(body.transactionId ?? body.transaction_id),
    statement_id: body.statementId ?? body.statement_id ?? null,
    financial_account_id: body.financialAccountId ?? body.financial_account_id ?? body.accountId ?? body.account_id ?? null,
    counterparty_id: body.counterpartyId ?? body.counterparty_id ?? null,
    obligation_id: body.obligationId ?? body.obligation_id ?? null,
    schedule_id: body.scheduleId ?? body.schedule_id ?? null,
    file_name: body.fileName ?? body.file_name,
    file_type: body.fileType ?? body.file_type,
    data_url: body.dataUrl ?? body.data_url,
    uploaded_at: body.uploadedAt ?? body.uploaded_at ?? new Date().toISOString(),
    notes: body.notes ?? ""
  });
}

function mapStatementInput(body: JsonRecord, isUpdate = false): JsonRecord {
  return compact({
    id: isUpdate ? undefined : (body.id ?? `stmt-${crypto.randomUUID()}`),
    workspace_id: body.workspaceId ?? body.workspace_id ?? "default",
    financial_account_id: body.financialAccountId ?? body.financial_account_id ?? body.accountId ?? body.account_id,
    start_date: body.startDate ?? body.start_date,
    end_date: body.endDate ?? body.end_date,
    opening_balance: body.openingBalance ?? body.opening_balance,
    closing_balance: body.closingBalance ?? body.closing_balance,
    is_reconciled: body.isReconciled ?? body.is_reconciled,
    reconciled_at: body.reconciledAt ?? body.reconciled_at ?? null,
    updated_at: new Date().toISOString()
  });
}

function mapScheduleInput(body: JsonRecord, isUpdate = false): JsonRecord {
  return compact({
    id: isUpdate ? undefined : (body.id ?? `sched-${crypto.randomUUID()}`),
    workspace_id: body.workspaceId ?? body.workspace_id ?? "default",
    name: body.name,
    amount: body.amount,
    category_id: body.categoryId ?? body.category_id ?? null,
    ledger_account_id: body.ledgerAccountId ?? body.ledger_account_id ?? body.accountId ?? body.account_id,
    financial_account_id: body.financialAccountId ?? body.financial_account_id ?? body.sourceAccountId ?? body.source_account_id,
    frequency: body.frequency,
    next_due_date: body.nextDueDate ?? body.next_due_date,
    tags: body.tags ?? [],
    is_active: body.isActive ?? body.is_active,
    updated_at: new Date().toISOString()
  });
}

function mapCounterpartyInput(body: JsonRecord, isUpdate = false): JsonRecord {
  return compact({
    id: isUpdate ? undefined : (body.id ?? `cp-${crypto.randomUUID()}`),
    workspace_id: body.workspaceId ?? body.workspace_id ?? "default",
    name: body.name,
    description: body.description ?? "",
    tags: body.tags ?? [],
    is_business: body.isBusiness ?? body.is_business,
    relationship_type: body.relationshipType ?? body.relationship_type ?? null,
    updated_at: new Date().toISOString()
  });
}

function mapObligationInput(body: JsonRecord, isUpdate = false): JsonRecord {
  return compact({
    id: isUpdate ? undefined : (body.id ?? `obl-${crypto.randomUUID()}`),
    workspace_id: body.workspaceId ?? body.workspace_id ?? "default",
    counterparty_id: body.counterpartyId ?? body.counterparty_id,
    amount: body.amount,
    type: body.type,
    description: body.description,
    transaction_id: normalizeUuidOrNull(body.transactionId ?? body.transaction_id),
    due_date: body.dueDate ?? body.due_date ?? null,
    status: body.status ?? "active",
    updated_at: new Date().toISOString()
  });
}

function mapTransactionInput(body: JsonRecord, isUpdate = false): JsonRecord {
  const date = body.date ?? body.transaction_date;
  const description = body.description ?? body.description_clean;
  const rawDescription = body.rawDescription ?? body.raw_description ?? body.description_raw ?? description;
  const financialAccountId = body.financialAccountId ?? body.financial_account_id ?? body.sourceAccountId ?? body.source_account_id;
  const counterparty = body.counterparty ?? body.merchant_name ?? "";

  const idVal = normalizeUuidOrNull(body.id);
  const importBatchId = normalizeUuidOrNull(body.importBatchId ?? body.import_batch_id);
  const rawRowId = normalizeUuidOrNull(body.rawRowId ?? body.raw_row_id);

  return compact({
    id: isUpdate ? undefined : (idVal || undefined),
    workspace_id: body.workspaceId ?? body.workspace_id ?? "default",
    transaction_date: date,
    description_clean: description,
    description_raw: rawDescription,
    amount: body.amount,
    financial_account_id: financialAccountId,
    tags: body.tags ?? [],
    category_id: body.categoryId ?? body.category_id ?? null,
    counterparty,
    import_batch_id: importBatchId,
    raw_row_id: rawRowId,
    classification_status: body.classificationStatus ?? body.classification_status ?? (isUpdate ? undefined : "classified"),
    journal_status: body.journalStatus ?? body.journal_status ?? body.ledgerStatus ?? body.ledger_status ?? (isUpdate ? undefined : "not_posted"),
    source_metadata: body.sourceMetadata ?? body.source_metadata ?? {},
    updated_at: new Date().toISOString()
  });
}

async function replaceJournalEntries(env: Env, tx: JsonRecord, categoryAccountId: string): Promise<void> {
  const txId = tx.id;
  const sourceAccountId = tx.financial_account_id;
  const date = tx.transaction_date;
  const amount = Number(tx.amount);

  if (!txId || !sourceAccountId || !date || !categoryAccountId || isNaN(amount)) {
    return;
  }

  const existingEntries = await supabaseFetch(env, `/journal_entries?transaction_id=eq.${filterValue(txId)}&select=id`);
  await assertSupabaseOk(existingEntries, "Failed to select existing journal entries");
  const entries = await existingEntries.json() as JsonRecord[];
  const entryIds = entries.map((entry) => entry.id).filter(Boolean);

  for (const entryId of entryIds) {
    const deleteLinesRes = await supabaseFetch(env, `/journal_lines?journal_entry_id=eq.${filterValue(entryId)}`, {
      method: "DELETE"
    });
    await assertSupabaseOk(deleteLinesRes, "Failed to replace existing journal lines");
  }

  const deleteRes = await supabaseFetch(env, `/journal_entries?transaction_id=eq.${filterValue(txId)}`, {
    method: "DELETE"
  });
  await assertSupabaseOk(deleteRes, "Failed to replace existing journal entries");

  const sourceLedgerAccountId = await getFinancialAccountDefaultLedger(env, sourceAccountId);
  if (!sourceLedgerAccountId) {
    throw new Error(`Financial account ${sourceAccountId} does not have a default ledger account.`);
  }

  const entryRes = await supabaseFetch(env, "/journal_entries", {
    method: "POST",
    body: JSON.stringify({
      workspace_id: tx.workspace_id ?? "default",
      transaction_id: txId,
      entry_date: date,
      description: tx.description_clean ?? tx.description ?? "Transaction",
      status: "draft",
      source: tx.import_batch_id ? "import" : "manual"
    }),
    headers: { "Prefer": "return=representation" }
  });
  await assertSupabaseOk(entryRes, "Failed to insert journal entry");
  const entryData = await entryRes.json() as JsonRecord[];
  const journalEntryId = entryData[0].id;

  const absoluteAmount = Math.abs(amount);
  const isOutflow = amount < 0;
  const lines = [
    {
      workspace_id: tx.workspace_id ?? "default",
      journal_entry_id: journalEntryId,
      ledger_account_id: sourceLedgerAccountId,
      debit: isOutflow ? 0 : absoluteAmount,
      credit: isOutflow ? absoluteAmount : 0
    },
    {
      workspace_id: tx.workspace_id ?? "default",
      journal_entry_id: journalEntryId,
      ledger_account_id: categoryAccountId,
      debit: isOutflow ? absoluteAmount : 0,
      credit: isOutflow ? 0 : absoluteAmount
    }
  ];

  const insertRes = await supabaseFetch(env, "/journal_lines", {
    method: "POST",
    body: JSON.stringify(lines)
  });
  await assertSupabaseOk(insertRes, "Failed to insert journal lines");

  const txStatusRes = await supabaseFetch(env, `/transactions?id=eq.${filterValue(txId)}`, {
    method: "PATCH",
    body: JSON.stringify({ journal_status: "draft", updated_at: new Date().toISOString() })
  });
  await assertSupabaseOk(txStatusRes, "Failed to update transaction journal status");
}

async function getFinancialAccountDefaultLedger(env: Env, financialAccountId: string): Promise<string | null> {
  const res = await supabaseFetch(env, `/financial_accounts?id=eq.${filterValue(financialAccountId)}&select=default_ledger_account_id`);
  await assertSupabaseOk(res, `Failed to select financial account ${financialAccountId}`);
  const data = await res.json() as JsonRecord[];
  return data[0]?.default_ledger_account_id ?? null;
}

function clampInteger(raw: string | null, fallback: number, min: number, max: number): number {
  const parsed = raw === null ? NaN : Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function decodeBase64DataUrl(dataUrl: string): { buffer: ArrayBuffer, mimeType: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const mimeType = match[1];
  const b64 = match[2];
  const binaryString = atob(b64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return { buffer: bytes.buffer, mimeType };
}

async function handleCreateAttachment(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as JsonRecord;
  const bucketName = env.QIFI_STORAGE_BUCKET || "qifi-vault";
  
  const metadata = mapAttachmentInput(body, false);
  
  let objectPath: string | null = null;
  let fileSize: number | null = null;
  
  if (metadata.data_url) {
    const decoded = decodeBase64DataUrl(metadata.data_url);
    if (decoded) {
      console.log(`[Storage] Uploading attachment ${metadata.id} to ${bucketName}`);
      
      const date = new Date();
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const sanitizedFilename = (metadata.file_name || "upload").replace(/[^a-zA-Z0-9.-]/g, '_');
      objectPath = `workspaces/${metadata.workspace_id}/receipts/${year}/${month}/${metadata.id}/${sanitizedFilename}`;
      fileSize = decoded.buffer.byteLength;
      
      const uploadRes = await supabaseFetch(env, `/storage/v1/object/${bucketName}/${objectPath}`, {
        method: "POST",
        body: decoded.buffer,
        headers: { "Content-Type": decoded.mimeType }
      });
      
      if (!uploadRes.ok) {
        return await handleSupabaseError(uploadRes, "/api/finance/attachments (storage upload)");
      }
      
      console.log(`[Storage] Upload successful for ${objectPath}`);
    }
  }

  const dbRecord = {
    ...metadata,
    data_url: objectPath ? null : metadata.data_url,
    bucket_name: objectPath ? bucketName : null,
    object_path: objectPath,
    file_size: fileSize
  };

  const dbRes = await supabaseFetch(env, `/attachments`, {
    method: "POST",
    body: JSON.stringify(dbRecord),
    headers: { "Prefer": "return=representation" }
  });

  if (!dbRes.ok) {
    console.error(`[Storage Error] Database insert failed for attachment ${metadata.id}. Attempting cleanup...`);
    if (objectPath) {
      await supabaseFetch(env, `/storage/v1/object/${bucketName}/${objectPath}`, {
        method: "DELETE"
      });
    }
    return await handleSupabaseError(dbRes, "/api/finance/attachments (db insert)");
  }

  const dbData = await dbRes.json() as any[];
  return json(dbData[0]);
}

async function handleGetAttachmentUrl(id: string, env: Env): Promise<Response> {
  const bucketName = env.QIFI_STORAGE_BUCKET || "qifi-vault";
  
  const res = await supabaseFetch(env, `/attachments?id=eq.${filterValue(id)}&select=object_path,bucket_name,data_url`);
  if (!res.ok) return await handleSupabaseError(res, `/api/finance/attachments/${id}/url (fetch metadata)`);
  
  const data = await res.json() as any[];
  if (data.length === 0) return json({ error: "Attachment not found" }, 404);
  
  const attach = data[0];
  if (!attach.object_path) {
    if (attach.data_url) {
      return json({ url: attach.data_url, type: 'data_url' }); 
    }
    return json({ error: "Attachment has no object_path or data_url" }, 400);
  }

  const bName = attach.bucket_name || bucketName;
  const signRes = await supabaseFetch(env, `/storage/v1/object/sign/${bName}/${attach.object_path}`, {
    method: "POST",
    body: JSON.stringify({ expiresIn: 3600 })
  });

  if (!signRes.ok) return await handleSupabaseError(signRes, `/api/finance/attachments/${id}/url (sign)`);
  
  const signData = await signRes.json() as { signedURL: string };
  return json({ url: `${env.SUPABASE_URL}/storage/v1${signData.signedURL}`, type: 'signed_url' });
}
