'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiFetch, handleApiError } from '../../../lib/api';

export default function PlatformI18nPage() {
  const [rows, setRows] = useState<any[]>([]);
  const [locale, setLocale] = useState('tr');
  const [namespace, setNamespace] = useState('common');
  const [key, setKey] = useState('welcome');
  const [value, setValue] = useState('Hos geldiniz');
  const [jsonData, setJsonData] = useState('{\n  \"common\": {\n    \"welcome\": \"Welcome\"\n  }\n}');

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

  async function exportJson() {
    const exported = await apiFetch(`/platform-api/i18n/export?locale=${encodeURIComponent(locale)}`);
    setJsonData(JSON.stringify(exported.data ?? {}, null, 2));
  }

  async function importJson() {
    const parsed = JSON.parse(jsonData) as Record<string, Record<string, string>>;
    await apiFetch('/platform-api/i18n/import', {
      method: 'POST',
      body: JSON.stringify({ locale, data: parsed })
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
      <div className="space-y-2 rounded border bg-white p-3">
        <h2 className="text-lg font-semibold">JSON Import / Export</h2>
        <textarea
          className="h-44 w-full rounded border p-2 font-mono text-sm"
          value={jsonData}
          onChange={(e) => setJsonData(e.target.value)}
        />
        <div className="flex gap-2">
          <button className="rounded border px-3 py-2" onClick={() => void exportJson()}>
            Export JSON
          </button>
          <button className="rounded bg-mono-500 px-3 py-2 text-white" onClick={() => void importJson()}>
            Import JSON
          </button>
        </div>
      </div>
      <pre className="rounded bg-white p-4 text-sm">{JSON.stringify(rows, null, 2)}</pre>
    </section>
  );
}
