'use client';

import { Suspense, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ApiError, apiFetch } from '../../../lib/api';

function AcceptInviteContent() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const scope = params.get('scope') === 'platform' ? 'platform' : 'company';
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const endpoint = useMemo(() => {
    return scope === 'platform' ? '/platform-api/invites/accept' : '/app-api/invites/accept';
  }, [scope]);

  async function accept() {
    if (!token) {
      setError('Missing invite token.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = (await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ token })
      })) as { companyId?: string };

      if (scope === 'company' && result.companyId) {
        window.localStorage.setItem('activeCompanyId', result.companyId);
        router.push('/app/home');
        return;
      }

      if (scope === 'platform') {
        router.push('/platform/dashboard');
        return;
      }

      router.push('/app/company');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        const next = encodeURIComponent(`/auth/accept-invite?scope=${scope}&token=${token}`);
        router.push(`/auth/login?next=${next}`);
        return;
      }
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="mx-auto mt-24 max-w-lg rounded border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="mb-2 text-2xl font-semibold">Accept Invite</h1>
      <p className="mb-4 text-sm text-slate-600">Scope: {scope}</p>
      <button
        className="rounded bg-mono-500 px-4 py-2 text-white disabled:opacity-60"
        onClick={accept}
        disabled={isLoading}
      >
        {isLoading ? 'Accepting...' : 'Accept Invite'}
      </button>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </main>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<main className="mx-auto mt-24 max-w-lg rounded border border-slate-200 bg-white p-6 shadow-sm">Loading invite...</main>}>
      <AcceptInviteContent />
    </Suspense>
  );
}
