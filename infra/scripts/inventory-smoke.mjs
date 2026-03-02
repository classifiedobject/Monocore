#!/usr/bin/env node

const API_URL = process.env.INVENTORY_SMOKE_API_URL ?? 'http://localhost:4000';
const EMAIL = (process.env.INVENTORY_SMOKE_EMAIL ?? process.env.SEED_PLATFORM_ADMIN_EMAIL ?? 'admin@themonocore.com').toLowerCase();
const PASSWORD = process.env.INVENTORY_SMOKE_PASSWORD ?? process.env.SEED_PLATFORM_ADMIN_PASSWORD ?? 'ChangeMe123!';
const COMPANY_ID = process.env.INVENTORY_SMOKE_COMPANY_ID ?? '00000000-0000-0000-0000-000000000001';

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

function findStock(rows, itemId, warehouseId) {
  return rows.find((row) => row.itemId === itemId && row.warehouseId === warehouseId);
}

async function main() {
  const auth = await login();
  const nonce = Date.now().toString().slice(-8);

  const warehouseA = await request(
    '/app-api/inventory/warehouses',
    {
      method: 'POST',
      body: JSON.stringify({ name: `Smoke WH A ${nonce}`, location: 'A', isActive: true })
    },
    auth
  );

  const warehouseB = await request(
    '/app-api/inventory/warehouses',
    {
      method: 'POST',
      body: JSON.stringify({ name: `Smoke WH B ${nonce}`, location: 'B', isActive: true })
    },
    auth
  );

  const item = await request(
    '/app-api/inventory/items',
    {
      method: 'POST',
      body: JSON.stringify({ name: `Smoke Item ${nonce}`, sku: `SMK-${nonce}`, unit: 'piece', isActive: true })
    },
    auth
  );

  await request(
    '/app-api/inventory/movements',
    {
      method: 'POST',
      body: JSON.stringify({
        itemId: item.id,
        warehouseId: warehouseA.id,
        type: 'IN',
        quantity: 100,
        reference: `SMOKE-IN-${nonce}`
      })
    },
    auth
  );

  await request(
    '/app-api/inventory/transfer',
    {
      method: 'POST',
      body: JSON.stringify({
        itemId: item.id,
        fromWarehouseId: warehouseA.id,
        toWarehouseId: warehouseB.id,
        quantity: 40,
        reference: `SMOKE-TR-${nonce}`
      })
    },
    auth
  );

  const stock = await request(`/app-api/inventory/stock-balance?itemId=${item.id}`, { method: 'GET' }, auth);
  assert(Array.isArray(stock), 'Stock balance payload is invalid');

  const stockA = findStock(stock, item.id, warehouseA.id);
  const stockB = findStock(stock, item.id, warehouseB.id);

  assert(Boolean(stockA), 'Warehouse A stock row missing');
  assert(Boolean(stockB), 'Warehouse B stock row missing');
  assert(Math.abs(Number(stockA.quantity) - 60) < 0.0001, 'Warehouse A quantity should be 60', stockA);
  assert(Math.abs(Number(stockB.quantity) - 40) < 0.0001, 'Warehouse B quantity should be 40', stockB);

  console.log(
    JSON.stringify(
      {
        ok: true,
        created: {
          warehouseAId: warehouseA.id,
          warehouseBId: warehouseB.id,
          itemId: item.id
        },
        balances: {
          warehouseA: Number(stockA.quantity),
          warehouseB: Number(stockB.quantity)
        }
      },
      null,
      2
    )
  );
}

main().catch((error) => fail('Unexpected inventory smoke failure', { message: error?.message, stack: error?.stack }));
