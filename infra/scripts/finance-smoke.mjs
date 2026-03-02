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

  const profitCenter = await request('/app-api/finance/profit-centers', {
    method: 'POST',
    body: JSON.stringify({ name: `Smoke Center ${nonce}`, type: 'SERVICE', code: `SC${nonce}` })
  }, auth);

  const secondProfitCenter = await request('/app-api/finance/profit-centers', {
    method: 'POST',
    body: JSON.stringify({ name: `Smoke Center B ${nonce}`, type: 'DEPARTMENT', code: `SCB${nonce}` })
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
      profitCenterId: profitCenter.id,
      reference: `SMK-${nonce}`
    })
  }, auth);

  await request('/app-api/finance/entries', {
    method: 'POST',
    body: JSON.stringify({
      categoryId: category.id,
      amount: 250,
      date: new Date().toISOString().slice(0, 10),
      description: 'Finance smoke unassigned entry',
      counterpartyId: counterparty.id,
      accountId: account.id,
      reference: `SMK-U-${nonce}`
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

  const allocationSourceEntry = await request('/app-api/finance/entries', {
    method: 'POST',
    body: JSON.stringify({
      categoryId: category.id,
      amount: 1000,
      date: new Date().toISOString().slice(0, 10),
      description: 'Allocation source entry',
      accountId: account.id,
      reference: `ALLOC-${nonce}`
    })
  }, auth);

  const allocationRule = await request('/app-api/finance/allocation-rules', {
    method: 'POST',
    body: JSON.stringify({
      name: `Smoke Allocation ${nonce}`,
      sourceCategoryId: category.id,
      allocationMethod: 'PERCENTAGE',
      targets: [
        { profitCenterId: profitCenter.id, percentage: 50 },
        { profitCenterId: secondProfitCenter.id, percentage: 50 }
      ]
    })
  }, auth);

  const allocationResult = await request(`/app-api/finance/allocation-rules/${allocationRule.id}/apply`, {
    method: 'POST',
    body: JSON.stringify({ sourceEntryId: allocationSourceEntry.id })
  }, auth);

  assert(Array.isArray(allocationResult?.generatedEntries), 'Allocation did not generate entries');
  assert(allocationResult.generatedEntries.length === 2, 'Allocation must create 2 generated entries');
  const sortedAllocated = [...allocationResult.generatedEntries].sort((a, b) => Number(a.amount) - Number(b.amount));
  assert(Number(sortedAllocated[0].amount) === 500, 'First allocated amount should be 500');
  assert(Number(sortedAllocated[1].amount) === 500, 'Second allocated amount should be 500');

  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);

  const pnl = await request(`/app-api/finance/reports/pnl?from=${from}&to=${to}`, { method: 'GET' }, auth);
  assert(typeof pnl?.totals?.expense === 'number', 'P&L totals missing');

  const cashflow = await request(`/app-api/finance/reports/cashflow?from=${from}&to=${to}&accountId=${account.id}`, { method: 'GET' }, auth);
  assert(Array.isArray(cashflow?.groupedByAccount), 'Cashflow result missing');

  const pnlByProfitCenter = await request(`/app-api/finance/reports/pnl-by-profit-center?from=${from}&to=${to}`, { method: 'GET' }, auth);
  assert(Array.isArray(pnlByProfitCenter?.items), 'Profit center summary missing');
  assert(pnlByProfitCenter.items.some((item) => item.profitCenterId === null), 'Unassigned bucket missing');

  const profitCenterDetail = await request(
    `/app-api/finance/reports/pnl-by-profit-center?from=${from}&to=${to}&profitCenterId=${profitCenter.id}`,
    { method: 'GET' },
    auth
  );
  assert(profitCenterDetail?.profitCenter?.id === profitCenter.id, 'Profit center detail missing');

  const allocationBatches = await request('/app-api/finance/allocation-batches', { method: 'GET' }, auth);
  assert(Array.isArray(allocationBatches), 'Allocation batches response is invalid');
  assert(allocationBatches.some((item) => item.sourceEntryId === allocationSourceEntry.id), 'Allocation batch not found');

  const receivableInvoice = await request('/app-api/finance/invoices', {
    method: 'POST',
    body: JSON.stringify({
      direction: 'RECEIVABLE',
      counterpartyId: counterparty.id,
      invoiceNo: `INV-${nonce}`,
      issueDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date().toISOString().slice(0, 10),
      lines: [{ description: 'Smoke invoice line', quantity: 1, unitPrice: 1000, taxRate: 0 }]
    })
  }, auth);

  const incomingPayment = await request('/app-api/finance/payments', {
    method: 'POST',
    body: JSON.stringify({
      direction: 'INCOMING',
      counterpartyId: counterparty.id,
      accountId: account.id,
      paymentDate: new Date().toISOString().slice(0, 10),
      amount: 600,
      reference: `PAY-${nonce}`
    })
  }, auth);

  await request(`/app-api/finance/payments/${incomingPayment.id}/allocate`, {
    method: 'POST',
    body: JSON.stringify({ allocations: [{ invoiceId: receivableInvoice.id, amount: 600 }] })
  }, auth);

  const invoiceAfterAllocation = await request(`/app-api/finance/invoices/${receivableInvoice.id}`, { method: 'GET' }, auth);
  assert(invoiceAfterAllocation.status === 'PARTIALLY_PAID', 'Invoice should be partially paid');

  const invoiceAllocated = invoiceAfterAllocation.paymentAllocations.reduce((sum, row) => sum + Number(row.amount), 0);
  const invoiceRemaining = Number(invoiceAfterAllocation.total) - invoiceAllocated;
  assert(invoiceRemaining === 400, 'Invoice remaining should be 400');

  const aging = await request(
    `/app-api/finance/reports/aging?direction=RECEIVABLE&asOf=${new Date().toISOString().slice(0, 10)}`,
    { method: 'GET' },
    auth
  );
  assert(aging?.totals?.total >= 400, 'Aging totals should include remaining receivable');

  const currentYear = new Date().getUTCFullYear();
  const budget = await request('/app-api/finance/budgets', {
    method: 'POST',
    body: JSON.stringify({
      name: `Smoke Budget ${currentYear} ${nonce}`,
      year: currentYear,
      currency: 'TRY'
    })
  }, auth);

  const month = new Date().getUTCMonth() + 1;
  await request(`/app-api/finance/budgets/${budget.id}/lines`, {
    method: 'POST',
    body: JSON.stringify({
      lines: [
        { month, direction: 'INCOME', amount: 2000 },
        { month, direction: 'EXPENSE', amount: 500 }
      ]
    })
  }, auth);

  const budgetFrom = new Date(Date.UTC(currentYear, 0, 1)).toISOString().slice(0, 10);
  const budgetTo = new Date(Date.UTC(currentYear, 11, 31)).toISOString().slice(0, 10);
  const budgetVsActual = await request(
    `/app-api/finance/reports/budget-vs-actual?budgetId=${budget.id}&from=${budgetFrom}&to=${budgetTo}`,
    { method: 'GET' },
    auth
  );
  assert(typeof budgetVsActual?.totals?.variance === 'number', 'Budget vs actual variance missing');

  const forecastDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await request('/app-api/finance/cashflow-forecast-items', {
    method: 'POST',
    body: JSON.stringify({
      direction: 'INFLOW',
      date: forecastDate,
      amount: 300,
      currency: 'TRY',
      description: `Smoke manual forecast ${nonce}`
    })
  }, auth);

  const projectionTo = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const projection = await request(
    `/app-api/finance/reports/cashflow-projection?from=${new Date().toISOString().slice(0, 10)}&to=${projectionTo}`,
    { method: 'GET' },
    auth
  );
  assert(Array.isArray(projection?.buckets), 'Cashflow projection buckets missing');
  assert(projection.buckets.some((bucket) => bucket.sources?.manual > 0), 'Cashflow projection should include manual forecast source');

  console.log(
    JSON.stringify(
      {
        ok: true,
        created: {
          categoryId: category.id,
          counterpartyId: counterparty.id,
          accountId: account.id,
          profitCenterId: profitCenter.id,
          secondProfitCenterId: secondProfitCenter.id,
          entryId: entry.id,
          recurringId: recurring.id,
          recurringGeneratedEntryId: runNow?.entry?.id,
          allocationRuleId: allocationRule.id,
          allocationSourceEntryId: allocationSourceEntry.id,
          allocationGeneratedEntryIds: allocationResult.generatedEntries.map((item) => item.id),
          receivableInvoiceId: receivableInvoice.id,
          incomingPaymentId: incomingPayment.id,
          budgetId: budget.id
        },
        totals: pnl.totals,
        profitCenterNet: profitCenterDetail?.totals?.net ?? null,
        budgetVariance: budgetVsActual.totals.variance,
        cashflowProjectionBuckets: projection.buckets.length
      },
      null,
      2
    )
  );
}

main().catch((error) => fail('Smoke script crashed', String(error)));
