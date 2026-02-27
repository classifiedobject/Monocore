'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiFetch, handleApiError } from '../../../lib/api';

export default function PlatformModulesPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [key, setKey] = useState('people');
  const [name, setName] = useState('People');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED' | 'DEPRECATED'>('DRAFT');

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
        status,
        description: 'Placeholder module',
        dependencies: {},
        pricingMeta: {}
      })
    });
    await load();
  }

  async function publishModule(moduleKey: string) {
    try {
      await apiFetch(`/platform-api/modules/${moduleKey}/publish`, { method: 'POST', body: JSON.stringify({}) });
      await load();
    } catch (error) {
      handleApiError(error);
    }
  }

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Module Registry</h1>
      <form className="flex gap-2" onSubmit={submit}>
        <input className="rounded border p-2" value={key} onChange={(e) => setKey(e.target.value)} />
        <input className="rounded border p-2" value={name} onChange={(e) => setName(e.target.value)} />
        <select className="rounded border p-2" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="DEPRECATED">Deprecated</option>
        </select>
        <button className="rounded bg-mono-500 px-4 text-white">Save</button>
      </form>
      <div className="space-y-3">
        {rows.map((row) => (
          <article key={row.id} className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{row.name}</h2>
                <p className="text-sm text-slate-600">
                  Key: {row.key} | Version: {row.version} | Status: {row.status}
                </p>
              </div>
              <button
                className="rounded bg-mono-500 px-3 py-2 text-sm text-white disabled:cursor-default disabled:bg-slate-400"
                disabled={row.status === 'PUBLISHED'}
                onClick={() => publishModule(row.key)}
              >
                {row.status === 'PUBLISHED' ? 'Published' : 'Publish'}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
