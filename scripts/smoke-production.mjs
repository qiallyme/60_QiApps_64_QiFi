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

console.log(JSON.stringify({
  ok: true,
  apiBase,
  authenticatedStateStatus: stateResult.response.status,
  unauthenticatedStateStatus: unauthenticated.response.status,
  counts: Object.fromEntries(arrayFields.map((field) => [field, state[field].length])),
}, null, 2));
