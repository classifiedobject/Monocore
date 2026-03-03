#!/usr/bin/env node

const API_URL = process.env.PAYROLL_SMOKE_API_URL ?? 'http://localhost:4000';
const EMAIL = (process.env.PAYROLL_SMOKE_EMAIL ?? process.env.SEED_PLATFORM_ADMIN_EMAIL ?? 'admin@themonocore.com').toLowerCase();
const PASSWORD = process.env.PAYROLL_SMOKE_PASSWORD ?? process.env.SEED_PLATFORM_ADMIN_PASSWORD ?? 'ChangeMe123!';
const COMPANY_ID = process.env.PAYROLL_SMOKE_COMPANY_ID ?? '00000000-0000-0000-0000-000000000001';

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
  const today = new Date().toISOString().slice(0, 10);

  const employeeA = await request('/app-api/payroll/employees', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Payroll',
      lastName: `Fixed ${nonce}`,
      hireDate: today,
      salaryType: 'fixed',
      baseSalary: 10000
    })
  }, auth);

  const employeeB = await request('/app-api/payroll/employees', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Payroll',
      lastName: `Hourly ${nonce}`,
      hireDate: today,
      salaryType: 'hourly',
      hourlyRate: 100
    })
  }, auth);

  await request('/app-api/payroll/worklogs', {
    method: 'POST',
    body: JSON.stringify({
      employeeId: employeeB.id,
      date: today,
      hoursWorked: 20
    })
  }, auth);

  const period = await request('/app-api/payroll/periods', {
    method: 'POST',
    body: JSON.stringify({
      startDate: today,
      endDate: today
    })
  }, auth);

  const calculated = await request(`/app-api/payroll/periods/${period.id}/calculate`, {
    method: 'POST',
    body: JSON.stringify({})
  }, auth);

  assert(calculated.status === 'CALCULATED', 'Payroll period should be CALCULATED', calculated);
  assert(Number(calculated.totalGross) === 12000, 'Expected totalGross=12000 (10000 fixed + 2000 hourly)', calculated);

  const posted = await request(`/app-api/payroll/periods/${period.id}/post`, {
    method: 'POST',
    body: JSON.stringify({})
  }, auth);

  assert(posted.status === 'POSTED', 'Payroll period should be POSTED', posted);

  const tipPool = await request('/app-api/payroll/tips', {
    method: 'POST',
    body: JSON.stringify({
      periodStart: today,
      periodEnd: today,
      totalTips: 5000,
      distributionMethod: 'equal'
    })
  }, auth);

  const distributed = (tipPool.distributions ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  assert(distributed === 5000, 'Tip distribution sum must equal 5000', tipPool.distributions);
  assert((tipPool.distributions ?? []).length >= 2, 'Expected at least 2 tip distribution rows', tipPool.distributions);

  const from = today;
  const to = today;
  const pnl = await request(`/app-api/finance/reports/pnl?from=${from}&to=${to}`, { method: 'GET' }, auth);
  assert(Number(pnl?.totals?.expense ?? 0) >= 10000, 'Expected payroll expense impact in P&L', pnl);

  console.log(
    JSON.stringify(
      {
        ok: true,
        payrollPeriodId: posted.id,
        totalGross: posted.totalGross,
        tipPoolId: tipPool.id,
        tipDistributed: distributed
      },
      null,
      2
    )
  );
}

main().catch((error) => fail('Payroll smoke script failed', String(error)));
