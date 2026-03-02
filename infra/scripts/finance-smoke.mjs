#!/usr/bin/env node

const API_URL = process.env.FINANCE_SMOKE_API_URL ?? 'http://localhost:4000';
const EMAIL = (process.env.FINANCE_SMOKE_EMAIL ?? process.env.SEED_PLATFORM_ADMIN_EMAIL ?? 'admin@themonocore.com').toLowerCase();
const PASSWORD = process.env.FINANCE_SMOKE_PASSWORD ?? process.env.SEED_PLATFORM_ADMIN_PASSWORD ?? 'ChangeMe123!';
const COMPANY_ID = process.env.FINANCE_SMOKE_COMPANY_ID ?? '00000000-0000-0000-0000-000000000001';

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

  assert(Boolean(sessionToken), 'Missing session_token from login cookies');
  assert(Boolean(csrfToken), 'Missing csrf_token from login cookies');

  return { sessionToken, csrfToken };
}

async function main() {
  const auth = await login();
  const nonce = Date.now().toString().slice(-8);

  const category = await request('/app-api/finance/categories', {
    method: 'POST',
    body: JSON.stringify({ name: `Smoke Category ${nonce}`, type: 'EXPENSE' })
  }, auth);

  const counterparty = await request('/app-api/finance/counterparties', {
    method: 'POST',
    body: JSON.stringify({ type: 'VENDOR', name: `Smoke Vendor ${nonce}` })
  }, auth);

  const account = await request('/app-api/finance/accounts', {
    method: 'POST',
    body: JSON.stringify({ type: 'BANK', name: `Smoke Account ${nonce}`, currency: 'TRY' })
  }, auth);

  const entry = await request('/app-api/finance/entries', {
    method: 'POST',
    body: JSON.stringify({
      categoryId: category.id,
      amount: 1500,
      date: new Date().toISOString().slice(0, 10),
      description: 'Finance smoke entry',
      counterpartyId: counterparty.id,
      accountId: account.id,
      reference: `SMK-${nonce}`
    })
  }, auth);

  const recurring = await request('/app-api/finance/recurring', {
    method: 'POST',
    body: JSON.stringify({
      name: `Smoke Recurring ${nonce}`,
      direction: 'EXPENSE',
      categoryId: category.id,
      amount: 500,
      startDate: new Date().toISOString().slice(0, 10),
      frequency: 'MONTHLY',
      dayOfMonth: 1,
      nextRunAt: new Date().toISOString().slice(0, 10),
      counterpartyId: counterparty.id,
      accountId: account.id,
      isActive: true
    })
  }, auth);

  const runNow = await request(`/app-api/finance/recurring/${recurring.id}/run-now`, { method: 'POST', body: JSON.stringify({}) }, auth);

  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);

  const pnl = await request(`/app-api/finance/reports/pnl?from=${from}&to=${to}`, { method: 'GET' }, auth);
  assert(typeof pnl?.totals?.expense === 'number', 'P&L totals missing');

  const cashflow = await request(`/app-api/finance/reports/cashflow?from=${from}&to=${to}&accountId=${account.id}`, { method: 'GET' }, auth);
  assert(Array.isArray(cashflow?.groupedByAccount), 'Cashflow result missing');

  console.log(
    JSON.stringify(
      {
        ok: true,
        created: {
          categoryId: category.id,
          counterpartyId: counterparty.id,
          accountId: account.id,
          entryId: entry.id,
          recurringId: recurring.id,
          recurringGeneratedEntryId: runNow?.entry?.id
        },
        totals: pnl.totals
      },
      null,
      2
    )
  );
}

main().catch((error) => fail('Smoke script crashed', String(error)));
