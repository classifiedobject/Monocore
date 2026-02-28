'use client';
import { getWebEnv } from './env';

const API_URL = getWebEnv().NEXT_PUBLIC_WEB_PUBLIC_API_URL;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function csrfToken() {
  if (typeof document === 'undefined') return '';
  return document.cookie
    .split(';')
    .map((p) => p.trim())
    .find((p) => p.startsWith('csrf_token='))
    ?.split('=')[1] ?? '';
}

function activeCompanyId() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem('activeCompanyId') ?? '';
}

function hasMissingTenantContext(message: string) {
  if (message.includes('Missing tenant context')) return true;
  try {
    const parsed = JSON.parse(message) as { error?: { message?: string }; detail?: { message?: string } };
    return parsed?.error?.message === 'Missing tenant context' || parsed?.detail?.message === 'Missing tenant context';
  } catch {
    return false;
  }
}

export async function apiFetch(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set('Content-Type', 'application/json');

  if (
    path.startsWith('/app-api') &&
    !path.startsWith('/app-api/companies') &&
    !path.startsWith('/app-api/invites/accept')
  ) {
    const companyId = activeCompanyId();
    if (!companyId) {
      if (typeof window !== 'undefined') {
        window.location.href = '/app/company';
      }
      throw new ApiError(403, 'Missing tenant context');
    }
    headers.set('x-company-id', companyId);
  }

  const method = init?.method?.toUpperCase() ?? 'GET';
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers.set('x-csrf-token', csrfToken());
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include'
  });

  if (!res.ok) {
    const message = (await res.text()) || `HTTP ${res.status}`;
    throw new ApiError(res.status, message);
  }

  return res.json();
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth/')) {
      window.location.href = '/auth/login';
    }
    return;
  }

  if (error instanceof ApiError && error.status === 403 && hasMissingTenantContext(error.message)) {
    if (typeof window !== 'undefined') {
      window.location.href = '/app/company';
    }
    return;
  }

  if (error instanceof Error) {
    console.error(error.message);
    return;
  }

  console.error(error);
}
