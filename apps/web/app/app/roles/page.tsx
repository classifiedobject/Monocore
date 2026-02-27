'use client';

import { useEffect, useState } from 'react';
import { apiFetch, handleApiError } from '../../../lib/api';

export default function RolesPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);

  useEffect(() => {
    apiFetch('/app-api/roles').then(setRoles).catch(handleApiError);
    apiFetch('/app-api/permissions').then(setPermissions).catch(handleApiError);
  }, []);

  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Roles & Permissions</h1>
      <h2 className="text-xl font-semibold">Roles</h2>
      <pre className="rounded bg-white p-4 text-sm">{JSON.stringify(roles, null, 2)}</pre>
      <h2 className="text-xl font-semibold">Permissions</h2>
      <pre className="rounded bg-white p-4 text-sm">{JSON.stringify(permissions, null, 2)}</pre>
    </section>
  );
}
