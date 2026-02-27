'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiFetch, handleApiError } from '../../../lib/api';

export default function TeamPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [email, setEmail] = useState('member@example.com');

  const load = () => apiFetch('/app-api/team').then(setRows).catch(handleApiError);
  useEffect(() => void load(), []);

  async function invite(e: FormEvent) {
    e.preventDefault();
    await apiFetch('/app-api/team/invite', {
      method: 'POST',
      body: JSON.stringify({ email, roleIds: [] })
    });
    await load();
  }

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Team</h1>
      <form className="flex gap-2" onSubmit={invite}>
        <input className="rounded border p-2" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="rounded bg-mono-500 px-4 text-white">Invite</button>
      </form>
      <pre className="rounded bg-white p-4 text-sm">{JSON.stringify(rows, null, 2)}</pre>
    </section>
  );
}
