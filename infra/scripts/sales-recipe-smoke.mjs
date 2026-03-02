#!/usr/bin/env node

const API_URL = process.env.SALES_SMOKE_API_URL ?? 'http://localhost:4000';
const EMAIL = (process.env.SALES_SMOKE_EMAIL ?? process.env.SEED_PLATFORM_ADMIN_EMAIL ?? 'admin@themonocore.com').toLowerCase();
const PASSWORD = process.env.SALES_SMOKE_PASSWORD ?? process.env.SEED_PLATFORM_ADMIN_PASSWORD ?? 'ChangeMe123!';
const COMPANY_ID = process.env.SALES_SMOKE_COMPANY_ID ?? '00000000-0000-0000-0000-000000000001';

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

  const warehouse = await request(
    '/app-api/inventory/warehouses',
    {
      method: 'POST',
      body: JSON.stringify({ name: `Sales Smoke WH ${nonce}`, location: 'Sales', isActive: true })
    },
    auth
  );

  const item = await request(
    '/app-api/inventory/items',
    {
      method: 'POST',
      body: JSON.stringify({
        name: `Sales Smoke Item ${nonce}`,
        sku: `SSI-${nonce}`,
        unit: 'piece',
        isActive: true,
        lastPurchaseUnitCost: 10
      })
    },
    auth
  );

  await request(
    `/app-api/inventory/items/${item.id}/cost`,
    {
      method: 'PATCH',
      body: JSON.stringify({ lastPurchaseUnitCost: 10 })
    },
    auth
  );

  await request(
    '/app-api/inventory/movements',
    {
      method: 'POST',
      body: JSON.stringify({
        itemId: item.id,
        warehouseId: warehouse.id,
        type: 'IN',
        quantity: 100,
        reference: `SALE-SMOKE-IN-${nonce}`
      })
    },
    auth
  );

  const product = await request(
    '/app-api/recipes/products',
    {
      method: 'POST',
      body: JSON.stringify({
        name: `Sales Smoke Product ${nonce}`,
        sku: `SSP-${nonce}`,
        salesPrice: 50,
        isActive: true
      })
    },
    auth
  );

  await request(
    '/app-api/recipes/recipes',
    {
      method: 'POST',
      body: JSON.stringify({
        productId: product.id,
        name: `Recipe ${nonce}`,
        yieldQuantity: 1,
        lines: [{ itemId: item.id, quantity: 2, unit: 'piece' }]
      })
    },
    auth
  );

  const order = await request(
    '/app-api/sales/orders',
    {
      method: 'POST',
      body: JSON.stringify({
        orderNo: `SO-${nonce}`,
        orderDate: new Date().toISOString().slice(0, 10),
        warehouseId: warehouse.id,
        lines: [{ productId: product.id, quantity: 3, unitPrice: 50 }]
      })
    },
    auth
  );

  const postResult = await request(`/app-api/sales/orders/${order.id}/post`, { method: 'POST', body: JSON.stringify({}) }, auth);

  const postedOrder = await request(`/app-api/sales/orders/${order.id}`, { method: 'GET' }, auth);
  assert(postedOrder.status === 'POSTED', 'Order should be posted', postedOrder);
  assert(Number(postedOrder.totalRevenue) === 150, 'Revenue should be 150', postedOrder);
  assert(Number(postedOrder.totalCogs) === 60, 'COGS should be 60', postedOrder);

  const stock = await request(`/app-api/inventory/stock-balance?itemId=${item.id}&warehouseId=${warehouse.id}`, { method: 'GET' }, auth);
  const stockRow = findStock(stock, item.id, warehouse.id);
  assert(Boolean(stockRow), 'Stock row missing after posting');
  assert(Math.abs(Number(stockRow.quantity) - 94) < 0.0001, 'Stock should be reduced to 94', stockRow);

  const financeEntries = await request('/app-api/finance/entries', { method: 'GET' }, auth);
  const saleEntries = financeEntries.filter(
    (row) => row.relatedDocumentType === 'sale' && row.relatedDocumentId === order.id
  );

  assert(saleEntries.length >= 2, 'Expected at least 2 finance sale entries', saleEntries);
  const revenue = saleEntries.find((row) => row.category?.type === 'INCOME');
  const cogs = saleEntries.find((row) => row.category?.type === 'EXPENSE');
  assert(Boolean(revenue), 'Revenue entry missing', saleEntries);
  assert(Boolean(cogs), 'COGS entry missing', saleEntries);
  assert(Number(revenue.amount) === 150, 'Revenue entry amount must be 150', revenue);
  assert(Number(cogs.amount) === 60, 'COGS entry amount must be 60', cogs);

  console.log(
    JSON.stringify(
      {
        ok: true,
        created: {
          warehouseId: warehouse.id,
          itemId: item.id,
          productId: product.id,
          orderId: order.id
        },
        postResult
      },
      null,
      2
    )
  );
}

main().catch((error) => fail('Unexpected sales/recipe smoke failure', { message: error?.message, stack: error?.stack }));

