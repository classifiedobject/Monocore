'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiFetch, handleApiError } from '../../../lib/api';

export default function PlatformI18nPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [locale, setLocale] = useState('tr');
  const [namespace, setNamespace] = useState('common');
  const [key, setKey] = useState('welcome');
  const [value, setValue] = useState('Hos geldiniz');

  const load = () => apiFetch('/platform-api/i18n').then(setRows).catch(handleApiError);
  useEffect(() => void load(), []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    await apiFetch('/platform-api/i18n', {
      method: 'POST',
      body: JSON.stringify({ locale, namespace, key, value })
    });
    await load();
  }

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Language Packs</h1>
      <form className="grid gap-2 md:grid-cols-5" onSubmit={submit}>
        <input className="rounded border p-2" value={locale} onChange={(e) => setLocale(e.target.value)} />
        <input className="rounded border p-2" value={namespace} onChange={(e) => setNamespace(e.target.value)} />
        <input className="rounded border p-2" value={key} onChange={(e) => setKey(e.target.value)} />
        <input className="rounded border p-2" value={value} onChange={(e) => setValue(e.target.value)} />
        <button className="rounded bg-mono-500 px-4 text-white">Save</button>
      </form>
      <pre className="rounded bg-white p-4 text-sm">{JSON.stringify(rows, null, 2)}</pre>
    </section>
  );
}
