const apiBase = process.env.QIFI_API_BASE_URL || 'https://api.qially.com';
const supabaseUrl = process.env.QIFI_SUPABASE_URL;
const publishableKey = process.env.QIFI_SUPABASE_PUBLISHABLE_KEY;
const email = process.env.QIFI_SMOKE_EMAIL;
const password = process.env.QIFI_SMOKE_PASSWORD;

const required = { QIFI_SUPABASE_URL: supabaseUrl, QIFI_SUPABASE_PUBLISHABLE_KEY: publishableKey, QIFI_SMOKE_EMAIL: email, QIFI_SMOKE_PASSWORD: password };
const missing = Object.entries(required).filter(([, value]) => !value).map(([name]) => name);
if (missing.length) throw new Error(`Missing required smoke-test environment variables: ${missing.join(', ')}`);

const request = async (url, init = {}) => {
  const response = await fetch(url, init);
  const body = await response.text();
  let payload;
  try { payload = body ? JSON.parse(body) : null; } catch { payload = body; }
  return { response, payload };
};

const auth = await request(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
if (!auth.response.ok || !auth.payload?.access_token) {
  throw new Error(`Supabase smoke identity login failed (${auth.response.status}).`);
}

const authorization = `Bearer ${auth.payload.access_token}`;
const apiRequest = (path, init = {}) => request(`${apiBase}${path}`, { ...init, headers: { Authorization: authorization, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers } });
const stateResult = await request(`${apiBase}/api/finance/state`, { headers: { Authorization: authorization } });
if (!stateResult.response.ok) throw new Error(`Authenticated finance state failed (${stateResult.response.status}).`);

const state = stateResult.payload?.ok === true ? stateResult.payload.data : stateResult.payload;
const arrayFields = ['financialAccounts', 'ledgerAccounts', 'accounts', 'categories', 'transactions', 'journalEntries', 'journalLines', 'ledgerEntries', 'importBatches', 'rawRows', 'rules', 'attachments', 'statements', 'schedules', 'counterparties', 'obligations'];
for (const field of arrayFields) {
  if (!Array.isArray(state?.[field])) throw new Error(`Finance state field ${field} is not an array.`);
}
for (const field of ['financialAccounts', 'ledgerAccounts', 'categories']) {
  if (state[field].length === 0) throw new Error(`Transaction dropdown source ${field} is empty.`);
}

const unauthenticated = await request(`${apiBase}/api/finance/state`);
if (unauthenticated.response.status !== 401) {
  throw new Error(`Unauthenticated finance state returned ${unauthenticated.response.status}, expected 401.`);
}

const smokeId = crypto.randomUUID();
const counterpartyId = `SMOKE_TEST_cp_${smokeId}`;
let transactionId = null;
let allocationVerified = false;
try {
  const financialAccount = state.financialAccounts[0];
  const category = state.categories.find((item) => item.default_ledger_account_id || item.defaultLedgerAccountId) || state.categories[0];
  const counterparty = await apiRequest('/api/finance/counterparties', { method: 'POST', body: JSON.stringify({ id: counterpartyId, name: `SMOKE_TEST_${smokeId}`, description: 'Automated production smoke fixture', tags: ['SMOKE_TEST'], isBusiness: false }) });
  if (!counterparty.response.ok) throw new Error(`Smoke counterparty creation failed (${counterparty.response.status}).`);

  const transaction = await apiRequest('/api/finance/transactions', { method: 'POST', body: JSON.stringify({
    date: new Date().toISOString().slice(0, 10), description: `SMOKE_TEST_split_${smokeId}`, rawDescription: `SMOKE_TEST_split_${smokeId}`,
    amount: -10, financialAccountId: financialAccount.id, sourceAccountId: financialAccount.id, categoryId: category.id,
    categoryAccountId: category.default_ledger_account_id || category.defaultLedgerAccountId, counterparty: `SMOKE_TEST_${smokeId}`, tags: ['SMOKE_TEST'],
  }) });
  if (!transaction.response.ok) throw new Error(`Smoke transaction creation failed (${transaction.response.status}).`);
  transactionId = (transaction.payload?.ok === true ? transaction.payload.data : transaction.payload)?.id;
  if (!transactionId) throw new Error('Smoke transaction response did not include an id.');

  const firstAllocation = await apiRequest(`/api/finance/transactions/${transactionId}/allocations`, { method: 'PUT', body: JSON.stringify({ allocations: [
    { counterpartyId, amount: 4, treatment: 'iou', note: 'SMOKE_TEST_IOU' },
    { counterpartyId, amount: 2, treatment: 'gift', note: 'SMOKE_TEST_GIFT' },
  ] }) });
  const firstRows = firstAllocation.payload?.ok === true ? firstAllocation.payload.data : firstAllocation.payload;
  if (!firstAllocation.response.ok || firstRows?.length !== 2 || !firstRows.some((row) => row.treatment === 'iou' && row.obligation_id) || !firstRows.some((row) => row.treatment === 'gift' && !row.obligation_id)) {
    throw new Error(`Smoke allocation creation failed (${firstAllocation.response.status}).`);
  }

  const replacement = await apiRequest(`/api/finance/transactions/${transactionId}/allocations`, { method: 'PUT', body: JSON.stringify({ allocations: [
    { counterpartyId, amount: 3, treatment: 'shared', note: 'SMOKE_TEST_SHARED' },
  ] }) });
  const replacementRows = replacement.payload?.ok === true ? replacement.payload.data : replacement.payload;
  if (!replacement.response.ok || replacementRows?.length !== 1 || replacementRows[0].treatment !== 'shared' || replacementRows[0].obligation_id) {
    throw new Error(`Smoke allocation replacement failed (${replacement.response.status}).`);
  }
  const obligationsAfter = await apiRequest('/api/finance/obligations');
  const obligationRows = obligationsAfter.payload?.ok === true ? obligationsAfter.payload.data : obligationsAfter.payload;
  if (obligationRows.some((item) => item.transaction_id === transactionId)) throw new Error('Replacing an IOU allocation left a stale obligation.');
  allocationVerified = true;
} finally {
  if (transactionId) await apiRequest(`/api/finance/transactions/${transactionId}`, { method: 'DELETE' });
  await apiRequest(`/api/finance/counterparties/${encodeURIComponent(counterpartyId)}`, { method: 'DELETE' });
}

console.log(JSON.stringify({
  ok: true,
  apiBase,
  authenticatedStateStatus: stateResult.response.status,
  unauthenticatedStateStatus: unauthenticated.response.status,
  counterpartyAllocationMutation: allocationVerified,
  counts: Object.fromEntries(arrayFields.map((field) => [field, state[field].length])),
}, null, 2));
