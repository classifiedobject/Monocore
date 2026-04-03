#!/usr/bin/env node

const API_URL = process.env.COMPANY_ORG_SMOKE_API_URL ?? 'http://localhost:4000';
const EMAIL = (process.env.COMPANY_ORG_SMOKE_EMAIL ?? process.env.SEED_PLATFORM_ADMIN_EMAIL ?? 'admin@themonocore.com').toLowerCase();
const PASSWORD = process.env.COMPANY_ORG_SMOKE_PASSWORD ?? process.env.SEED_PLATFORM_ADMIN_PASSWORD ?? 'ChangeMe123!';

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

async function request(path, options = {}, auth = null, companyId = null) {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (auth) {
    headers.set('x-csrf-token', auth.csrfToken);
    headers.set('Cookie', `session_token=${auth.sessionToken}; csrf_token=${auth.csrfToken}`);
    if (companyId) headers.set('x-company-id', companyId);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    fail(`Request failed: ${path}`, { status: response.status, body });
  }

  return body;
}

async function requestExpect(path, expectedStatus, options = {}, auth = null, companyId = null) {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (auth) {
    headers.set('x-csrf-token', auth.csrfToken);
    headers.set('Cookie', `session_token=${auth.sessionToken}; csrf_token=${auth.csrfToken}`);
    if (companyId) headers.set('x-company-id', companyId);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (response.status !== expectedStatus) {
    fail(`Expected ${expectedStatus} for ${path}`, { status: response.status, body });
  }
  return body;
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

  const companyA = await request('/app-api/companies', {
    method: 'POST',
    body: JSON.stringify({ name: `Org Smoke ${nonce} A` })
  }, auth);

  const companyB = await request('/app-api/companies', {
    method: 'POST',
    body: JSON.stringify({ name: `Org Smoke ${nonce} B` })
  }, auth);

  const kitchen = await request('/app-api/company/org/departments', {
    method: 'POST',
    body: JSON.stringify({ name: 'Kitchen' })
  }, auth, companyA.id);

  const service = await request('/app-api/company/org/departments', {
    method: 'POST',
    body: JSON.stringify({ name: 'Service' })
  }, auth, companyA.id);

  const chef = await request('/app-api/company/org/titles', {
    method: 'POST',
    body: JSON.stringify({ name: 'Chef', departmentId: kitchen.id })
  }, auth, companyA.id);

  const commis = await request('/app-api/company/org/titles', {
    method: 'POST',
    body: JSON.stringify({ name: 'Commis', departmentId: kitchen.id })
  }, auth, companyA.id);

  const waiter = await request('/app-api/company/org/titles', {
    method: 'POST',
    body: JSON.stringify({ name: 'Waiter', departmentId: service.id })
  }, auth, companyA.id);

  const treeA1 = await request('/app-api/company/org/tree', { method: 'GET' }, auth, companyA.id);
  assert(Array.isArray(treeA1) && treeA1.length === 2, 'Expected 2 departments in hierarchy', treeA1);
  assert(treeA1.some((department) => department.titles.some((title) => title.id === chef.id)), 'Chef should be nested under a department', treeA1);
  assert(treeA1.some((department) => department.titles.some((title) => title.id === waiter.id)), 'Waiter should be nested under a department', treeA1);

  const reorderedDepartments = await request('/app-api/company/org/departments/reorder', {
    method: 'POST',
    body: JSON.stringify({ ids: [service.id, kitchen.id] })
  }, auth, companyA.id);
  assert(reorderedDepartments[0]?.id === service.id, 'Department reorder should persist', reorderedDepartments);

  const reorderedTitles = await request('/app-api/company/org/titles/reorder', {
    method: 'POST',
    body: JSON.stringify({ departmentId: kitchen.id, ids: [commis.id, chef.id] })
  }, auth, companyA.id);
  const kitchenAfterReorder = reorderedTitles.find((department) => department.id === kitchen.id);
  assert(kitchenAfterReorder?.titles?.[0]?.id === commis.id, 'Title reorder should persist within department', kitchenAfterReorder);

  await request(`/app-api/company/org/titles/${waiter.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ departmentId: kitchen.id })
  }, auth, companyA.id);

  const treeA2 = await request('/app-api/company/org/tree', { method: 'GET' }, auth, companyA.id);
  const kitchenAfterMove = treeA2.find((department) => department.id === kitchen.id);
  assert(kitchenAfterMove?.titles?.some((title) => title.id === waiter.id), 'Title reassignment should move title to new department', kitchenAfterMove);

  await requestExpect(`/app-api/company/org/departments/${kitchen.id}`, 409, { method: 'DELETE' }, auth, companyA.id);

  const treeB = await request('/app-api/company/org/tree', { method: 'GET' }, auth, companyB.id);
  assert(Array.isArray(treeB) && treeB.length === 0, 'Tenant isolation should keep other company hierarchy empty', treeB);

  console.log(
    JSON.stringify(
      {
        ok: true,
        companyA: companyA.id,
        companyB: companyB.id,
        departmentOrder: reorderedDepartments.map((department) => department.name),
        kitchenTitles: kitchenAfterMove?.titles?.map((title) => title.name) ?? []
      },
      null,
      2
    )
  );
}

main().catch((error) => fail('Company Org smoke script failed', String(error)));
