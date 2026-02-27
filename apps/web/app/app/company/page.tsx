'use client';

import { FormEvent, useEffect, useState } from 'react';
import { apiFetch, handleApiError } from '../../../lib/api';

export default function CompanyPage() {
  const [memberships, setMemberships] = useState<any[]>([]);
  const [name, setName] = useState('New Company');

  const load = async () => {
    const rows = await apiFetch('/app-api/companies');
    setMemberships(rows);
    if (rows[0]?.company?.id) {
      window.localStorage.setItem('activeCompanyId', rows[0].company.id);
    }
  };

  useEffect(() => {
    load().catch(handleApiError);
  }, []);

  async function createCompany(e: FormEvent) {
    e.preventDefault();
    await apiFetch('/app-api/companies', {
      method: 'POST',
      body: JSON.stringify({ name })
    });
    await load();
  }

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Company Selection / Create</h1>
      <form className="flex gap-2" onSubmit={createCompany}>
        <input className="rounded border p-2" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="rounded bg-mono-500 px-4 text-white">Create</button>
      </form>
      <pre className="rounded bg-white p-4 text-sm">{JSON.stringify(memberships, null, 2)}</pre>
    </section>
  );
}
