'use client';

import { useEffect, useState } from 'react';
import { apiFetch, handleApiError } from '../../../lib/api';

export default function PlatformDashboardPage() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    apiFetch('/platform-api/dashboard').then(setData).catch(handleApiError);
  }, []);

  return (
    <section>
      <h1 className="mb-4 text-3xl font-bold">Platform Dashboard</h1>
      <pre className="rounded bg-white p-4 text-sm">{JSON.stringify(data, null, 2)}</pre>
    </section>
  );
}
