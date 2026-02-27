'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, handleApiError } from '../../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@themonocore.com');
  const [password, setPassword] = useState('ChangeMe123!');
  const [error, setError] = useState('');

  return (
    <main className="mx-auto mt-24 max-w-md rounded border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="mb-4 text-2xl font-semibold">Sign in</h1>
      <form
        className="space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          try {
            await apiFetch('/auth/login', {
              method: 'POST',
              body: JSON.stringify({ email, password })
            });
            router.push('/app/company');
          } catch (err) {
            handleApiError(err);
            setError(String(err));
          }
        }}
      >
        <input className="w-full rounded border p-2" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          className="w-full rounded border p-2"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <button className="w-full rounded bg-mono-500 p-2 text-white" type="submit">
          Login
        </button>
      </form>
    </main>
  );
}
