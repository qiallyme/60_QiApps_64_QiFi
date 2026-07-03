/**
 * QiFinance API Cloudflare Worker
 * Dedicated financial-data gateway between the App UI and Supabase.
 */

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

type JsonRecord = Record<string, any>;

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
    table: "finance_transaction_rules",
    order: "created_at.desc",
    mapInput: mapRuleInput
  },
  attachments: {
    table: "finance_attachments",
    order: "uploaded_at.desc",
    mapInput: mapAttachmentInput
  },
  statements: {
    table: "finance_statements",
    order: "end_date.desc",
    mapInput: mapStatementInput
  },
  schedules: {
    table: "finance_recurring_schedules",
    order: "next_due_date.asc",
    mapInput: mapScheduleInput
  },
  counterparties: {
    table: "finance_counterparties",
    order: "name.asc",
    mapInput: mapCounterpartyInput
  },
  obligations: {
    table: "finance_obligations",
    order: "created_at.desc",
    mapInput: mapObligationInput
  },
  "ledger-entries": {
    table: "finance_ledger_entries",
    order: "date.desc"
  },
  "import-batches": {
    table: "finance_import_batches",
    order: "created_at.desc"
  },
  "raw-rows": {
    table: "finance_import_raw_rows",
    order: "created_at.desc"
  }
};

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

async function router(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === "/api/finance/state" && request.method === "GET") {
    return await handleGetState(env);
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
  return json({
    error: "Supabase request failed",
    status: res.status,
    details: errorText,
    route
  }, res.status === 404 ? 404 : 500);
}

async function assertSupabaseOk(res: Response, message: string): Promise<void> {
  if (!res.ok) {
    throw new Error(`${message}: ${await res.text()}`);
  }
}

async function supabaseFetch(env: Env, path: string, init: RequestInit = {}): Promise<Response> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY secrets must be configured in the worker.");
  }

  const headers: Record<string, string> = {
    "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> || {}),
  };

  return fetch(`${env.SUPABASE_URL}/rest/v1${path}`, {
    ...init,
    headers,
  });
}

function filterValue(value: string): string {
  return encodeURIComponent(value);
}

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
    accounts,
    categories,
    transactions,
    ledgerEntries,
    importBatches,
    rawRows,
    rules,
    attachments,
    statements,
    schedules,
    counterparties,
    obligations
  ] = await Promise.all([
    selectAll(env, "finance_accounts", "code.asc"),
    selectAll(env, "finance_categories", "code.asc"),
    selectAll(env, "finance_master_transactions", "date.desc"),
    selectAll(env, "finance_ledger_entries", "date.desc"),
    selectAll(env, "finance_import_batches", "created_at.desc"),
    selectAll(env, "finance_import_raw_rows", "created_at.desc"),
    selectAll(env, "finance_transaction_rules", "created_at.desc"),
    selectAll(env, "finance_attachments", "uploaded_at.desc"),
    selectAll(env, "finance_statements", "end_date.desc"),
    selectAll(env, "finance_recurring_schedules", "next_due_date.asc"),
    selectAll(env, "finance_counterparties", "name.asc"),
    selectAll(env, "finance_obligations", "created_at.desc")
  ]);

  return json({
    accounts,
    categories,
    transactions,
    ledgerEntries,
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
  return json(await selectAll(env, "finance_accounts", "code.asc"));
}

async function handleGetCategories(env: Env): Promise<Response> {
  return json(await selectAll(env, "finance_categories", "code.asc"));
}

async function handleCreateAccount(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as JsonRecord;
  const res = await supabaseFetch(env, "/finance_accounts", {
    method: "POST",
    body: JSON.stringify(mapAccountInput(body, false)),
    headers: { "Prefer": "return=representation" }
  });
  if (!res.ok) return await handleSupabaseError(res, "/api/finance/accounts");
  const data = await res.json() as any[];
  return json(data[0]);
}

async function handleUpdateAccount(id: string, request: Request, env: Env): Promise<Response> {
  const body = await request.json() as JsonRecord;
  const res = await supabaseFetch(env, `/finance_accounts?id=eq.${filterValue(id)}`, {
    method: "PATCH",
    body: JSON.stringify(mapAccountInput(body, true)),
    headers: { "Prefer": "return=representation" }
  });
  if (!res.ok) return await handleSupabaseError(res, "/api/finance/accounts/:id");
  const data = await res.json() as any[];
  if (data.length === 0) return json({ error: "Account not found" }, 404);
  return json(data[0]);
}

async function handleDeleteAccount(id: string, env: Env): Promise<Response> {
  const res = await supabaseFetch(env, `/finance_accounts?id=eq.${filterValue(id)}`, {
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
  const res = await supabaseFetch(env, "/finance_categories", {
    method: "POST",
    body: JSON.stringify({
      id: body.id,
      code: body.code,
      name: body.name,
      description: body.description,
      is_active: body.isActive ?? body.is_active ?? true
    }),
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
    `/finance_master_transactions?select=*&order=date.desc&limit=${limit}&offset=${offset}`
  );
  if (!res.ok) return await handleSupabaseError(res, "/api/finance/transactions");
  return json(await res.json());
}

async function handleGetTransactionById(id: string, env: Env): Promise<Response> {
  const res = await supabaseFetch(env, `/finance_master_transactions?id=eq.${filterValue(id)}&select=*`);
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

  const sourceAccountId = body.sourceAccountId ?? body.source_account_id;
  const missingFields = [
    ["date", body.date ?? body.transaction_date],
    ["description", body.description ?? body.description_clean],
    ["amount", body.amount],
    ["sourceAccountId", sourceAccountId]
  ].filter(([, value]) => value === undefined || value === null || value === "");

  if (missingFields.length > 0) {
    return json({
      error: "Missing required transaction fields",
      route: "/api/finance/transactions",
      missingFields: missingFields.map(([field]) => field)
    }, 400);
  }

  const categoryAccountId = body.categoryAccountId ?? body.category_account_id;
  const txToInsert = mapTransactionInput(body, false);
  txToInsert.ledger_status = categoryAccountId ? "posted" : txToInsert.ledger_status;

  const res = await supabaseFetch(env, "/finance_master_transactions", {
    method: "POST",
    body: JSON.stringify(txToInsert),
    headers: { "Prefer": "return=representation" }
  });
  if (!res.ok) return await handleSupabaseError(res, "/api/finance/transactions");
  const data = await res.json() as any[];
  const created = data[0];

  if (categoryAccountId) {
    await replaceLedgerEntries(env, created, categoryAccountId);
  }

  return json(created);
}

async function handleUpdateTransaction(id: string, request: Request, env: Env): Promise<Response> {
  const body = await request.json() as JsonRecord;
  const categoryAccountId = body.categoryAccountId ?? body.category_account_id;
  const txUpdates = mapTransactionInput(body, true);

  const res = await supabaseFetch(env, `/finance_master_transactions?id=eq.${filterValue(id)}`, {
    method: "PATCH",
    body: JSON.stringify(txUpdates),
    headers: { "Prefer": "return=representation" }
  });

  if (!res.ok) return await handleSupabaseError(res, "/api/finance/transactions/:id");
  const data = await res.json() as any[];
  if (data.length === 0) return json({ error: "Transaction not found to update" }, 404);

  if (categoryAccountId) {
    await replaceLedgerEntries(env, data[0], categoryAccountId);
  }

  return json(data[0]);
}

async function handleDeleteTransaction(id: string, env: Env): Promise<Response> {
  const res = await supabaseFetch(env, `/finance_master_transactions?id=eq.${filterValue(id)}`, {
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

function runCategorizationHeuristics(rawDesc: string, rules: any[]): { accountId: string; tags: string[]; counterparty: string; confidence: number } {
  const cleanDesc = rawDesc.toLowerCase();

  for (const rule of rules) {
    if (cleanDesc.includes(rule.pattern.toLowerCase())) {
      return {
        accountId: rule.suggested_account_id,
        tags: rule.suggested_tags || [],
        counterparty: rule.suggested_counterparty || "",
        confidence: 0.95
      };
    }
  }

  if (cleanDesc.includes("gas") || cleanDesc.includes("chevron") || cleanDesc.includes("shell")) {
    return { accountId: "expenses-travel", tags: ["travel", "vehicle"], counterparty: "Fuel Gas Station", confidence: 0.85 };
  }
  if (cleanDesc.includes("dining") || cleanDesc.includes("mcdonald") || cleanDesc.includes("starbucks") || cleanDesc.includes("cafe")) {
    return { accountId: "expenses-dining", tags: ["dining", "meals"], counterparty: "Restaurant/Cafe", confidence: 0.80 };
  }
  if (cleanDesc.includes("lyft") || cleanDesc.includes("uber")) {
    return { accountId: "expenses-travel", tags: ["travel", "business"], counterparty: "Rideshare", confidence: 0.90 };
  }
  if (cleanDesc.includes("transfer") || cleanDesc.includes("payment") || cleanDesc.includes("venmo")) {
    return { accountId: "clearing-cc-payment", tags: ["transfer"], counterparty: "Cleared Fund Transfer", confidence: 0.70 };
  }

  return {
    accountId: "suspense-uncategorized",
    tags: ["uncategorized"],
    counterparty: normalizeMerchantName(rawDesc),
    confidence: 0.40
  };
}

async function handleImportPreview(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as JsonRecord;
  const { csvText, fileName, columnMappings, hasHeaders } = body;

  if (!csvText) return json({ error: "Missing csvText in request body" }, 400);

  const parsedLines = parseCSV(csvText);
  if (parsedLines.length === 0) return json({ error: "Empty or invalid CSV file" }, 400);

  const rules = await selectAll(env, "finance_transaction_rules", "created_at.desc");
  const accounts = await selectAll(env, "finance_accounts", "code.asc");
  const accountIds = new Set(accounts.map((a: any) => a.id));

  const txRes = await supabaseFetch(env, "/finance_master_transactions?select=date,amount,description&order=date.desc&limit=1000");
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

    if (hasOutflowCol && hasInflowCol) {
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
    const targetAccountId = rowData.accountId || suggestion.accountId;
    const finalAccountId = accountIds.has(targetAccountId) ? targetAccountId : "suspense-uncategorized";
    const rowAbsAmount = Math.abs(rowData.amount);
    const rowTime = new Date(dateStr).getTime();

    const duplicates = existingTransactions.filter((tx: any) => {
      const txAbsAmount = Math.abs(Number(tx.amount));
      const txTime = new Date(tx.date).getTime();
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
    missingCategories: Array.from(new Set(previewRows.map(r => r.suggestedAccountId).filter(id => !accountIds.has(id)))),
    missingCounterparties: []
  });
}

async function handleImportCommit(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as JsonRecord;
  const { fileName, sourceAccountId, rows } = body;

  if (!rows || !Array.isArray(rows)) {
    return json({ error: "Missing rows array in request body" }, 400);
  }

  const batchRes = await supabaseFetch(env, "/finance_import_batches", {
    method: "POST",
    body: JSON.stringify({
      file_name: fileName,
      original_filename: fileName,
      raw_count: rows.length,
      row_count: rows.length,
      source_account_id: sourceAccountId,
      status: "committed",
      imported_at: new Date().toISOString()
    }),
    headers: { "Prefer": "return=representation" }
  });

  if (!batchRes.ok) return await handleSupabaseError(batchRes, "/api/finance/import/commit");
  const batchData = await batchRes.json() as any[];
  const batchId = batchData[0].id;

  const rawRowsToInsert = rows.map((row: any, idx: number) => ({
    import_batch_id: batchId,
    batch_id: batchId,
    row_number: row.index ?? idx,
    raw_data: row,
    raw_hash: `${batchId}:${row.index ?? idx}:${row.date}:${row.amount}:${row.description}`,
    date: row.date,
    description: row.description,
    amount: row.amount,
    status: row.isDuplicate ? "ignored" : "processed",
    normalized_status: row.isDuplicate ? "ignored" : "processed",
    suggested_account_id: row.suggestedAccountId || "suspense-uncategorized",
    suggested_counterparty: row.suggestedCounterparty || "",
    suggested_tags: row.suggestedTags || [],
    memo: row.memo || ""
  }));

  const rawRowsRes = await supabaseFetch(env, "/finance_import_raw_rows", {
    method: "POST",
    body: JSON.stringify(rawRowsToInsert)
  });
  if (!rawRowsRes.ok) return await handleSupabaseError(rawRowsRes, "/api/finance/import/commit");

  const nonDuplicateRows = rows.filter((row: any) => !row.isDuplicate);
  let txData: any[] = [];

  if (nonDuplicateRows.length > 0) {
    const transactionsToInsert = nonDuplicateRows.map((row: any) => {
      const record = mapTransactionInput({
        date: row.date,
        description: row.description,
        rawDescription: row.rawDescription || row.description,
        amount: row.amount,
        sourceAccountId,
        tags: row.suggestedTags || [],
        counterparty: row.suggestedCounterparty || "",
        importBatchId: batchId,
        importStatus: "imported",
        classificationStatus: row.suggestedAccountId ? "classified" : "unclassified",
        ledgerStatus: "posted",
        sourceMetadata: {
          raw_row_index: row.index,
          import_confidence: row.confidence
        }
      }, false);
      return record;
    });

    const txRes = await supabaseFetch(env, "/finance_master_transactions", {
      method: "POST",
      body: JSON.stringify(transactionsToInsert),
      headers: { "Prefer": "return=representation" }
    });

    if (!txRes.ok) return await handleSupabaseError(txRes, "/api/finance/import/commit");
    txData = await txRes.json() as any[];

    for (let i = 0; i < txData.length; i++) {
      const row = nonDuplicateRows[i];
      await replaceLedgerEntries(env, txData[i], row.suggestedAccountId || "suspense-uncategorized");
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
  return compact({
    id: isUpdate ? undefined : body.id,
    code: body.code,
    name: body.name,
    type: body.type,
    description: body.description,
    account_number: body.accountNumber ?? body.account_number,
    routing_number: body.routingNumber ?? body.routing_number,
    institution: body.institution,
    parent_account_id: body.parentAccountId ?? body.parent_account_id ?? null,
    is_active: body.isActive ?? body.is_active,
    updated_at: new Date().toISOString()
  });
}

function mapRuleInput(body: JsonRecord, isUpdate = false): JsonRecord {
  return compact({
    id: isUpdate ? undefined : (body.id ?? `rule-${Date.now()}`),
    pattern: body.pattern,
    suggested_account_id: body.suggestedAccountId ?? body.suggested_account_id,
    suggested_tags: body.suggestedTags ?? body.suggested_tags ?? [],
    suggested_counterparty: body.suggestedCounterparty ?? body.suggested_counterparty ?? "",
    description: body.description ?? "",
    updated_at: new Date().toISOString()
  });
}

function mapAttachmentInput(body: JsonRecord, isUpdate = false): JsonRecord {
  return compact({
    id: isUpdate ? undefined : (body.id ?? `attach-${crypto.randomUUID()}`),
    transaction_id: body.transactionId ?? body.transaction_id ?? null,
    statement_id: body.statementId ?? body.statement_id ?? null,
    account_id: body.accountId ?? body.account_id ?? null,
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
    account_id: body.accountId ?? body.account_id,
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
    name: body.name,
    amount: body.amount,
    account_id: body.accountId ?? body.account_id,
    source_account_id: body.sourceAccountId ?? body.source_account_id,
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
    transaction_id: body.transactionId ?? body.transaction_id ?? null,
    due_date: body.dueDate ?? body.due_date ?? null,
    status: body.status ?? "active",
    updated_at: new Date().toISOString()
  });
}

function mapTransactionInput(body: JsonRecord, isUpdate = false): JsonRecord {
  const date = body.date ?? body.transaction_date;
  const description = body.description ?? body.description_clean;
  const rawDescription = body.rawDescription ?? body.raw_description ?? body.description_raw ?? description;
  const sourceAccountId = body.sourceAccountId ?? body.source_account_id;
  const counterparty = body.counterparty ?? body.merchant_name ?? "";
  const importBatchId = body.importBatchId ?? body.import_batch_id ?? null;

  return compact({
    date,
    transaction_date: date,
    description,
    description_clean: description,
    raw_description: rawDescription,
    description_raw: rawDescription,
    amount: body.amount,
    source_account_id: sourceAccountId,
    tags: body.tags ?? [],
    counterparty,
    merchant_name: counterparty,
    reconciliation_id: body.reconciliationId ?? body.reconciliation_id ?? null,
    import_batch_id: importBatchId,
    batch_id: importBatchId,
    import_status: body.importStatus ?? body.import_status ?? (isUpdate ? undefined : "manual"),
    classification_status: body.classificationStatus ?? body.classification_status ?? (isUpdate ? undefined : "classified"),
    ledger_status: body.ledgerStatus ?? body.ledger_status ?? (isUpdate ? undefined : "not_posted"),
    source_metadata: body.sourceMetadata ?? body.source_metadata ?? {},
    updated_at: new Date().toISOString()
  });
}

async function replaceLedgerEntries(env: Env, tx: JsonRecord, categoryAccountId: string): Promise<void> {
  const txId = tx.id;
  const sourceAccountId = tx.source_account_id;
  const date = tx.date ?? tx.transaction_date;
  const amount = Number(tx.amount);

  if (!txId || !sourceAccountId || !date || !categoryAccountId || isNaN(amount)) {
    return;
  }

  const deleteRes = await supabaseFetch(env, `/finance_ledger_entries?transaction_id=eq.${filterValue(txId)}`, {
    method: "DELETE"
  });
  await assertSupabaseOk(deleteRes, "Failed to replace existing ledger entries");

  const absoluteAmount = Math.abs(amount);
  const isOutflow = amount < 0;
  const entries = [
    {
      id: `led-${txId}-src`,
      transaction_id: txId,
      account_id: sourceAccountId,
      debit: isOutflow ? 0 : absoluteAmount,
      credit: isOutflow ? absoluteAmount : 0,
      date
    },
    {
      id: `led-${txId}-cat`,
      transaction_id: txId,
      account_id: categoryAccountId,
      debit: isOutflow ? absoluteAmount : 0,
      credit: isOutflow ? 0 : absoluteAmount,
      date
    }
  ];

  const insertRes = await supabaseFetch(env, "/finance_ledger_entries", {
    method: "POST",
    body: JSON.stringify(entries)
  });
  await assertSupabaseOk(insertRes, "Failed to insert ledger entries");
}

function clampInteger(raw: string | null, fallback: number, min: number, max: number): number {
  const parsed = raw === null ? NaN : Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}
