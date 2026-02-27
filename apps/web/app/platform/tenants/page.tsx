'use client';

import { useEffect, useState } from 'react';
import { apiFetch, handleApiError } from '../../../lib/api';

export default function PlatformTenantsPage() {
  const [companies, setCompanies] = useState<any[]>([]);

  useEffect(() => {
    apiFetch('/platform-api/tenants').then(setCompanies).catch(handleApiError);
  }, []);

  return (
    <section>
      <h1 className="mb-4 text-3xl font-bold">Tenants</h1>
      <pre className="rounded bg-white p-4 text-sm">{JSON.stringify(companies, null, 2)}</pre>
    </section>
  );
}
