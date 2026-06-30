/**
 * QiFinance API Cloudflare Worker
 * Dedicated financial-data gateway between the App UI and Supabase
 */

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

const ALLOWED_ORIGINS = [
  "https://fi.qially.com",
  "https://www.fi.qially.com",
  "https://62-qifi.pages.dev"
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return injectCors(request, new Response(null, { status: 204 }));
    }

    try {
      let response: Response;

      // Health check endpoint
      if (url.pathname === "/health") {
        response = new Response(JSON.stringify({
          ok: true,
          service: "qifinance-api",
          time: new Date().toISOString()
        }), {
          headers: { "Content-Type": "application/json" }
        });
      } else {
        // Dispatch to API routes
        response = await router(request, env);
      }

      // Inject strict CORS headers before returning
      return injectCors(request, response);
    } catch (error: any) {
      console.error(error);
      const errResponse = json({ error: error.message ?? "Unknown internal error" }, 500);
      return injectCors(request, errResponse);
    }
  },
};

// CORS Injector Helper
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

  // Clone response headers and append CORS keys
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

// Router dispatcher
async function router(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // 1. GET /api/finance/accounts
  if (path === "/api/finance/accounts" && request.method === "GET") {
    return await handleGetAccounts(env);
  }

  // 2. GET /api/finance/categories
  if (path === "/api/finance/categories" && request.method === "GET") {
    return await handleGetCategories(env);
  }

  // 3. GET /api/finance/transactions
  if (path === "/api/finance/transactions" && request.method === "GET") {
    return await handleGetTransactions(request, env);
  }

  // 4. GET /api/finance/transactions/:id
  // 5. PATCH/PUT /api/finance/transactions/:id
  // 6. DELETE /api/finance/transactions/:id
  const txMatch = path.match(/^\/api\/finance\/transactions\/([^/]+)$/);
  if (txMatch) {
    const id = txMatch[1];
    if (request.method === "GET") {
      return await handleGetTransactionById(id, env);
    }
    if (request.method === "PATCH" || request.method === "PUT") {
      return await handleUpdateTransaction(id, request, env);
    }
    if (request.method === "DELETE") {
      return await handleDeleteTransaction(id, env);
    }
  }

  // 7. POST /api/finance/import/preview
  if (path === "/api/finance/import/preview" && request.method === "POST") {
    return await handleImportPreview(request, env);
  }

  // 8. POST /api/finance/import/commit
  if (path === "/api/finance/import/commit" && request.method === "POST") {
    return await handleImportCommit(request, env);
  }

  return json({ error: `Not found: ${request.method} ${path}` }, 404);
}

// Response Helpers
function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    },
  });
}

// Supabase HTTP Inbound Helper
async function supabaseFetch(env: Env, path: string, init: RequestInit = {}) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY secrets must be configured in the worker.");
  }
  
  const url = `${env.SUPABASE_URL}/rest/v1${path}`;
  const headers: Record<string, string> = {
    "apikey": env.SUPABASE_SERVICE_ROLE_KEY,
    "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> || {}),
  };

  return fetch(url, {
    ...init,
    headers,
  });
}

// 1. GET /api/finance/accounts
async function handleGetAccounts(env: Env) {
  const res = await supabaseFetch(env, "/finance_accounts?select=*&order=code.asc");
  if (!res.ok) {
    return json({ error: await res.text() }, res.status);
  }
  const data = await res.json() as any;
  return json(data);
}

// 2. GET /api/finance/categories
async function handleGetCategories(env: Env) {
  const res = await supabaseFetch(env, "/finance_categories?select=*&order=code.asc");
  if (!res.ok) {
    return json({ error: await res.text() }, res.status);
  }
  const data = await res.json() as any;
  return json(data);
}

// 3. GET /api/finance/transactions
async function handleGetTransactions(request: Request, env: Env) {
  const url = new URL(request.url);
  const limit = url.searchParams.get("limit") || "100";
  const offset = url.searchParams.get("offset") || "0";
  
  const res = await supabaseFetch(
    env,
    `/finance_master_transactions?select=*&order=date.desc&limit=${limit}&offset=${offset}`
  );
  if (!res.ok) {
    return json({ error: await res.text() }, res.status);
  }
  const data = await res.json() as any;
  return json(data);
}

// 4. GET /api/finance/transactions/:id
async function handleGetTransactionById(id: string, env: Env) {
  const res = await supabaseFetch(env, `/finance_master_transactions?id=eq.${id}&select=*`);
  if (!res.ok) {
    return json({ error: await res.text() }, res.status);
  }
  const data = await res.json() as any;
  if (Array.isArray(data) && data.length === 0) {
    return json({ error: "Transaction not found" }, 404);
  }
  return json(data[0]);
}

// 5. PATCH/PUT /api/finance/transactions/:id
async function handleUpdateTransaction(id: string, request: Request, env: Env) {
  const updates = await request.json() as any;
  
  const res = await supabaseFetch(env, `/finance_master_transactions?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify(updates),
    headers: {
      "Prefer": "return=representation"
    }
  });

  if (!res.ok) {
    return json({ error: await res.text() }, res.status);
  }
  const data = await res.json() as any;
  if (Array.isArray(data) && data.length === 0) {
    return json({ error: "Transaction not found to update" }, 404);
  }
  return json(data[0]);
}

// 6. DELETE /api/finance/transactions/:id
async function handleDeleteTransaction(id: string, env: Env) {
  const res = await supabaseFetch(env, `/finance_master_transactions?id=eq.${id}`, {
    method: "DELETE",
    headers: {
      "Prefer": "return=representation"
    }
  });

  if (!res.ok) {
    return json({ error: await res.text() }, res.status);
  }
  const data = await res.json() as any;
  if (Array.isArray(data) && data.length === 0) {
    return json({ error: "Transaction not found to delete" }, 404);
  }
  return json({ message: "Transaction deleted successfully", deleted: data[0] });
}

// CSV Parser Helper
function parseCSV(rawText: string): string[][] {
  return rawText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    });
}

// Merchant normalizer helper
function normalizeMerchantName(rawDesc: string): string {
  let clean = rawDesc.toUpperCase().trim();
  
  // Remove common processing codes and metadata
  clean = clean.replace(/TST\*\s*/g, '');
  clean = clean.replace(/SQ\s*\*\s*/g, '');
  clean = clean.replace(/\d{4,}/g, ''); // Long digit sequences
  clean = clean.replace(/\b(INC|LLC|CORP|CO|LTD)\b/g, '');
  clean = clean.replace(/\s+/g, ' ');
  clean = clean.trim();

  if (clean.includes('GOOGLE')) return 'Google Cloud';
  if (clean.includes('GITHUB')) return 'GitHub';
  if (clean.includes('UBER')) return 'Uber';
  if (clean.includes('LYFT')) return 'Lyft';
  if (clean.includes('WHOLE FOODS') || clean.includes('WHOLEFOODS')) return 'Whole Foods';
  if (clean.includes('FIGMA')) return 'Figma';
  if (clean.includes('NETFLIX')) return 'Netflix';
  if (clean.includes('AMAZON')) return 'Amazon';
  if (clean.includes('VENMO')) return 'Venmo';
  
  // Title Case Fallback
  return clean
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// AI/Rule classification engine
function runCategorizationHeuristics(rawDesc: string, rules: any[]): { accountId: string; tags: string[]; counterparty: string; confidence: number } {
  const cleanDesc = rawDesc.toLowerCase();

  // 1. Run through database rules
  for (const rule of rules) {
    if (cleanDesc.includes(rule.pattern.toLowerCase())) {
      return {
        accountId: rule.suggested_account_id,
        tags: rule.suggested_tags || [],
        counterparty: rule.suggested_counterparty || '',
        confidence: 0.95
      };
    }
  }

  // 2. Local fallback heuristics
  if (cleanDesc.includes('gas') || cleanDesc.includes('chevron') || cleanDesc.includes('shell')) {
    return { accountId: 'expenses-travel', tags: ['travel', 'vehicle'], counterparty: 'Fuel Gas Station', confidence: 0.85 };
  }
  if (cleanDesc.includes('dining') || cleanDesc.includes('mcdonald') || cleanDesc.includes('starbucks') || cleanDesc.includes('cafe')) {
    return { accountId: 'expenses-dining', tags: ['dining', 'meals'], counterparty: 'Restaurant/Cafe', confidence: 0.80 };
  }
  if (cleanDesc.includes('lyft') || cleanDesc.includes('uber')) {
    return { accountId: 'expenses-travel', tags: ['travel', 'business'], counterparty: 'Rideshare', confidence: 0.90 };
  }
  if (cleanDesc.includes('transfer') || cleanDesc.includes('payment') || cleanDesc.includes('venmo')) {
    return { accountId: 'clearing-cc-payment', tags: ['transfer'], counterparty: 'Cleared Fund Transfer', confidence: 0.70 };
  }

  // 3. Fallback Suspense
  return {
    accountId: 'suspense-uncategorized',
    tags: ['uncategorized'],
    counterparty: normalizeMerchantName(rawDesc),
    confidence: 0.40
  };
}

// 7. POST /api/finance/import/preview
async function handleImportPreview(request: Request, env: Env) {
  const body = await request.json() as any;
  const { csvText, fileName, sourceAccountId, columnMappings, hasHeaders } = body;

  if (!csvText) {
    return json({ error: "Missing csvText in request body" }, 400);
  }

  const parsedLines = parseCSV(csvText);
  if (parsedLines.length === 0) {
    return json({ error: "Empty or invalid CSV file" }, 400);
  }

  // Fetch rules & accounts to match
  const rulesRes = await supabaseFetch(env, "/finance_transaction_rules?select=*");
  const rules = rulesRes.ok ? await rulesRes.json() as any[] : [];

  const accountsRes = await supabaseFetch(env, "/finance_accounts?select=id,name,code");
  const accounts = accountsRes.ok ? await accountsRes.json() as any[] : [];
  const accountIds = new Set(accounts.map((a: any) => a.id));

  // Fetch existing transactions to verify duplicates
  // Grab last 1000 transactions to match against in-memory
  const txRes = await supabaseFetch(env, "/finance_master_transactions?select=date,amount,description&order=date.desc&limit=1000");
  const existingTransactions = txRes.ok ? await txRes.json() as any[] : [];

  const dataLines = hasHeaders ? parsedLines.slice(1) : parsedLines;

  // Process rows
  const previewRows = dataLines.map((line, lineIndex) => {
    const rowData = {
      date: '',
      description: '',
      amount: 0,
      counterparty: '',
      accountId: '',
      tags: [] as string[],
      memo: ''
    };

    let parsedOutflow = 0;
    let parsedInflow = 0;
    let hasOutflowCol = false;
    let hasInflowCol = false;

    // Apply column mappings
    for (let i = 0; i < line.length; i++) {
      const val = (line[i] || '').trim();
      const targets = columnMappings[i] || [];
      
      targets.forEach((t: string) => {
        if (t === 'date') {
          rowData.date = val;
        } else if (t === 'description') {
          rowData.description = rowData.description ? `${rowData.description} ${val}` : val;
        } else if (t === 'amount') {
          hasOutflowCol = true;
          const cleanVal = val.replace(/[$,\s]/g, '');
          const num = Number(cleanVal);
          if (!isNaN(num)) parsedOutflow = num;
        } else if (t === 'inflow_amount') {
          hasInflowCol = true;
          const cleanVal = val.replace(/[$,\s]/g, '');
          const num = Number(cleanVal);
          if (!isNaN(num)) parsedInflow = num;
        } else if (t === 'counterparty') {
          rowData.counterparty = rowData.counterparty ? `${rowData.counterparty} ${val}` : val;
        } else if (t === 'accountId') {
          rowData.accountId = val;
        } else if (t === 'tags') {
          const parsedTags = val.split(/[,;|]/).map(x => x.trim()).filter(Boolean);
          rowData.tags = [...rowData.tags, ...parsedTags];
        } else if (t === 'memo') {
          rowData.memo = rowData.memo ? `${rowData.memo} ${val}` : val;
        }
      });
    }

    // Resolve outflow vs inflow
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

    // Normalize Date format
    let dateStr = rowData.date;
    try {
      const parsedDate = new Date(rowData.date);
      if (!isNaN(parsedDate.getTime())) {
        dateStr = parsedDate.toISOString().split('T')[0];
      }
    } catch (e) {}

    // Determine category / rules suggestions
    const suggestion = runCategorizationHeuristics(rowData.description, rules);
    
    // Check if suggested category exists in db accounts
    const targetAccountId = rowData.accountId || suggestion.accountId;
    const finalAccountId = accountIds.has(targetAccountId) ? targetAccountId : 'suspense-uncategorized';

    // Deduplication algorithm: check within 3 days, matching absolute amount
    const rowAbsAmount = Math.abs(rowData.amount);
    const rowTime = new Date(dateStr).getTime();
    
    const duplicates = existingTransactions.filter((tx: any) => {
      const txAbsAmount = Math.abs(tx.amount);
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
  }).filter(r => r.date !== '' && r.description !== '');

  // Extract missing counterparties and categories
  const missingCategories = Array.from(new Set(
    previewRows.map(r => r.suggestedAccountId).filter(id => !accountIds.has(id))
  ));

  return json({
    fileName,
    rawCount: previewRows.length,
    rows: previewRows,
    missingCategories,
    missingCounterparties: [] // For now populated in client review if needed
  });
}

// 8. POST /api/finance/import/commit
async function handleImportCommit(request: Request, env: Env) {
  const body = await request.json() as any;
  const { fileName, sourceAccountId, rows } = body;

  if (!rows || !Array.isArray(rows)) {
    return json({ error: "Missing rows array in request body" }, 400);
  }

  // 1. Create the import batch
  const batchRes = await supabaseFetch(env, "/finance_import_batches", {
    method: "POST",
    body: JSON.stringify({
      file_name: fileName,
      raw_count: rows.length,
      source_account_id: sourceAccountId,
      status: "committed"
    }),
    headers: {
      "Prefer": "return=representation"
    }
  });

  if (!batchRes.ok) {
    return json({ error: `Failed to create batch: ${await batchRes.text()}` }, batchRes.status);
  }

  const batchData = await batchRes.json() as any;
  const batchId = batchData[0].id;

  // 2. Insert into raw rows staging for history
  const rawRowsToInsert = rows.map((row: any) => ({
    import_batch_id: batchId,
    date: row.date,
    description: row.description,
    amount: row.amount,
    status: row.isDuplicate ? "ignored" : "processed",
    suggested_account_id: row.suggestedAccountId || "suspense-uncategorized",
    suggested_counterparty: row.suggestedCounterparty || "",
    suggested_tags: row.suggestedTags || [],
    memo: row.memo || ""
  }));

  const rawRowsRes = await supabaseFetch(env, "/finance_import_raw_rows", {
    method: "POST",
    body: JSON.stringify(rawRowsToInsert)
  });

  if (!rawRowsRes.ok) {
    return json({ error: `Failed to insert raw rows: ${await rawRowsRes.text()}` }, rawRowsRes.status);
  }

  // 3. Filter out duplicates & insert actual master transactions
  const nonDuplicateRows = rows.filter((row: any) => !row.isDuplicate);
  let createdCount = 0;
  let txData: any[] = [];

  if (nonDuplicateRows.length > 0) {
    const transactionsToInsert = nonDuplicateRows.map((row: any) => ({
      date: row.date,
      description: row.description,
      raw_description: row.description,
      amount: row.amount,
      source_account_id: sourceAccountId,
      tags: row.suggestedTags || [],
      counterparty: row.suggestedCounterparty || "",
      import_batch_id: batchId,
      import_status: "imported",
      classification_status: row.suggestedAccountId ? "classified" : "unclassified",
      ledger_status: "not_posted",
      source_metadata: {
        raw_row_index: row.index,
        import_confidence: row.confidence
      }
    }));

    const txRes = await supabaseFetch(env, "/finance_master_transactions", {
      method: "POST",
      body: JSON.stringify(transactionsToInsert),
      headers: {
        "Prefer": "return=representation"
      }
    });

    if (!txRes.ok) {
      return json({ error: `Failed to create master transactions: ${await txRes.text()}` }, txRes.status);
    }
    txData = await txRes.json() as any[];
    createdCount = txData.length;
  }

  return json({
    message: "CSV statement imported successfully",
    batchId,
    totalRows: rows.length,
    createdCount,
    transactions: txData
  });
}
