#!/usr/bin/env node

const API_URL = process.env.RESERVATIONS_SMOKE_API_URL ?? 'http://localhost:4000';
const EMAIL = (process.env.RESERVATIONS_SMOKE_EMAIL ?? process.env.SEED_PLATFORM_ADMIN_EMAIL ?? 'admin@themonocore.com').toLowerCase();
const PASSWORD = process.env.RESERVATIONS_SMOKE_PASSWORD ?? process.env.SEED_PLATFORM_ADMIN_PASSWORD ?? 'ChangeMe123!';
const COMPANY_ID = process.env.RESERVATIONS_SMOKE_COMPANY_ID ?? '00000000-0000-0000-0000-000000000001';

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

function ymd(date) {
  return date.toISOString().slice(0, 10);
}

async function main() {
  const auth = await login();
  const nonce = Date.now().toString().slice(-8);

  const customer = await request(
    '/app-api/reservations/customers',
    {
      method: 'POST',
      body: JSON.stringify({
        firstName: `Smoke${nonce}`,
        lastName: 'Customer',
        phone: `+90${nonce}`,
        email: `smoke-${nonce}@example.com`
      })
    },
    auth
  );

  const reservation = await request(
    '/app-api/reservations/reservations',
    {
      method: 'POST',
      body: JSON.stringify({
        customerId: customer.id,
        name: `${customer.firstName} ${customer.lastName}`,
        phone: customer.phone,
        reservationDate: ymd(new Date()),
        reservationTime: '19:00',
        guestCount: 2
      })
    },
    auth
  );

  const completed = await request(
    `/app-api/reservations/reservations/${reservation.id}/status`,
    {
      method: 'POST',
      body: JSON.stringify({ newStatus: 'COMPLETED' })
    },
    auth
  );
  assert(completed.status === 'COMPLETED', 'Reservation should be completed');

  const customerAfter = await request(`/app-api/reservations/customers/${customer.id}`, { method: 'GET' }, auth);
  assert(Number(customerAfter.visitCount) === Number(customer.visitCount) + 1, 'visitCount should increment by 1', customerAfter);

  console.log(
    JSON.stringify(
      {
        ok: true,
        customerId: customer.id,
        reservationId: reservation.id,
        visitCountBefore: customer.visitCount,
        visitCountAfter: customerAfter.visitCount
      },
      null,
      2
    )
  );
}

main().catch((error) => fail('Unexpected reservations smoke failure', { message: error?.message, stack: error?.stack }));
