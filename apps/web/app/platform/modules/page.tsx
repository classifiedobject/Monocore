'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiFetch, handleApiError } from '../../../lib/api';

export default function PlatformModulesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [key, setKey] = useState('people');
  const [name, setName] = useState('People');

  const load = () => apiFetch('/platform-api/modules').then(setRows).catch(handleApiError);
  useEffect(() => void load(), []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    await apiFetch('/platform-api/modules', {
      method: 'POST',
      body: JSON.stringify({
        key,
        name,
        version: '0.1.0',
        status: 'DRAFT',
        description: 'Placeholder module',
        dependencies: {},
        pricingMeta: {}
      })
    });
    await load();
  }

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Module Registry</h1>
      <form className="flex gap-2" onSubmit={submit}>
        <input className="rounded border p-2" value={key} onChange={(e) => setKey(e.target.value)} />
        <input className="rounded border p-2" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="rounded bg-mono-500 px-4 text-white">Save</button>
      </form>
      <pre className="rounded bg-white p-4 text-sm">{JSON.stringify(rows, null, 2)}</pre>
    </section>
  );
}
