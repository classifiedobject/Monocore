'use client';

import { useEffect, useState } from 'react';
import { apiFetch, handleApiError } from '../../../lib/api';

export default function ModulesPage() {
  const [modules, setModules] = useState<any[]>([]);

  useEffect(() => {
    apiFetch('/app-api/modules').then(setModules).catch(handleApiError);
  }, []);

  return (
    <section>
      <h1 className="mb-4 text-3xl font-bold">Installed Modules</h1>
      <pre className="rounded bg-white p-4 text-sm">{JSON.stringify(modules, null, 2)}</pre>
    </section>
  );
}
