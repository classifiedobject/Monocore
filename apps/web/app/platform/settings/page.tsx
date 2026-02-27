'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiFetch, handleApiError } from '../../../lib/api';

export default function PlatformSettingsPage() {
  const [settings, setSettings] = useState<any[]>([]);
  const [key, setKey] = useState('support_email');
  const [value, setValue] = useState('support@themonocore.com');

  const load = () => apiFetch('/platform-api/settings').then(setSettings).catch(handleApiError);
  useEffect(() => void load(), []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    await apiFetch('/platform-api/settings', {
      method: 'POST',
      body: JSON.stringify({ key, value })
    });
    await load();
  }

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Settings</h1>
      <form className="flex gap-2" onSubmit={submit}>
        <input className="rounded border p-2" value={key} onChange={(e) => setKey(e.target.value)} />
        <input className="rounded border p-2" value={value} onChange={(e) => setValue(e.target.value)} />
        <button className="rounded bg-mono-500 px-4 text-white">Save</button>
      </form>
      <pre className="rounded bg-white p-4 text-sm">{JSON.stringify(settings, null, 2)}</pre>
    </section>
  );
}
