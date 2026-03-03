#!/usr/bin/env node

const API_URL = process.env.EXEC_SMOKE_API_URL ?? 'http://localhost:4000';
const EMAIL = (process.env.EXEC_SMOKE_EMAIL ?? process.env.SEED_PLATFORM_ADMIN_EMAIL ?? 'admin@themonocore.com').toLowerCase();
const PASSWORD = process.env.EXEC_SMOKE_PASSWORD ?? process.env.SEED_PLATFORM_ADMIN_PASSWORD ?? 'ChangeMe123!';
const COMPANY_ID = process.env.EXEC_SMOKE_COMPANY_ID ?? '00000000-0000-0000-0000-000000000001';

function fail(message, detail) {
  console.error(JSON.stringify({ ok: false, message, detail }, null, 2));
  process.exit(1);
}

function assert(condition, message, detail) {
  if (!condition) fail(message, detail);
}

function parseCookies(setCookieHeaders) {
  const cookies = {};
  for (const item of setCookieHeaders) {
    const [pair] = item.split(';');
    const [name, value] = pair.split('=');
    if (name && value) cookies[name.trim()] = value.trim();
  }
  return cookies;
}

async function request(path, options = {}, auth = null) {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (auth) {
    headers.set('x-company-id', COMPANY_ID);
    headers.set('x-csrf-token', auth.csrfToken);
    headers.set('Cookie', `session_token=${auth.sessionToken}; csrf_token=${auth.csrfToken}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const body = await response.text();
    fail(`Request failed: ${path}`, { status: response.status, body });
  }

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function login() {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD })
  });

  if (!res.ok) {
    fail('Login failed', { status: res.status, body: await res.text() });
  }

  const setCookie = res.headers.getSetCookie?.() ?? [];
  const parsed = parseCookies(setCookie);
  const sessionToken = parsed.session_token;
  const csrfToken = parsed.csrf_token;

  assert(Boolean(sessionToken), 'Missing session token');
  assert(Boolean(csrfToken), 'Missing csrf token');

  return { sessionToken, csrfToken };
}

async function main() {
  const auth = await login();
  const nonce = Date.now().toString().slice(-8);

  const incomeCategory = await request('/app-api/finance/categories', {
    method: 'POST',
    body: JSON.stringify({ name: `Exec Income ${nonce}`, type: 'INCOME' })
  }, auth);

  const expenseCategory = await request('/app-api/finance/categories', {
    method: 'POST',
    body: JSON.stringify({ name: `COGS Exec ${nonce}`, type: 'EXPENSE' })
  }, auth);

  await request('/app-api/finance/entries', {
    method: 'POST',
    body: JSON.stringify({
      categoryId: incomeCategory.id,
      amount: 1000,
      date: new Date().toISOString().slice(0, 10),
      relatedDocumentType: 'sale',
      description: 'Exec smoke revenue'
    })
  }, auth);

  await request('/app-api/finance/entries', {
    method: 'POST',
    body: JSON.stringify({
      categoryId: expenseCategory.id,
      amount: 450,
      date: new Date().toISOString().slice(0, 10),
      relatedDocumentType: 'sale',
      description: 'Exec smoke cogs'
    })
  }, auth);

  await request('/app-api/reservations/customers', {
    method: 'POST',
    body: JSON.stringify({ firstName: 'Exec', lastName: `Customer ${nonce}`, phone: `+90${nonce}` })
  }, auth);

  const counterparty = await request('/app-api/finance/counterparties', {
    method: 'POST',
    body: JSON.stringify({ type: 'CUSTOMER', name: `Exec Counterparty ${nonce}` })
  }, auth);

  await request('/app-api/finance/invoices', {
    method: 'POST',
    body: JSON.stringify({
      direction: 'RECEIVABLE',
      counterpartyId: counterparty.id,
      invoiceNo: `EXEC-INV-${nonce}`,
      issueDate: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10),
      dueDate: new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10),
      lines: [{ description: 'Exec invoice', quantity: 1, unitPrice: 300, taxRate: 0 }]
    })
  }, auth);

  const warehouse = await request('/app-api/inventory/warehouses', {
    method: 'POST',
    body: JSON.stringify({ name: `Exec WH ${nonce}` })
  }, auth);

  const item = await request('/app-api/inventory/items', {
    method: 'POST',
    body: JSON.stringify({ name: `Exec Item ${nonce}`, unit: 'piece', lastPurchaseUnitCost: 20 })
  }, auth);

  await request('/app-api/inventory/movements', {
    method: 'POST',
    body: JSON.stringify({ itemId: item.id, warehouseId: warehouse.id, type: 'IN', quantity: 5, relatedDocumentType: 'manual' })
  }, auth);

  const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);

  const dashboard = await request(`/app-api/executive/dashboard?from=${from}&to=${to}`, { method: 'GET' }, auth);

  assert(dashboard.summary.revenue > 0, 'Revenue should be greater than zero', dashboard.summary);
  assert(dashboard.summary.outstandingReceivables > 0, 'Receivables should be greater than zero', dashboard.summary);
  assert(Array.isArray(dashboard.alerts) && dashboard.alerts.length > 0, 'Expected at least one alert', dashboard.alerts);

  console.log(JSON.stringify({ ok: true, summary: dashboard.summary, alertCount: dashboard.alerts.length }, null, 2));
}

main().catch((error) => fail('Executive smoke script failed', String(error)));
