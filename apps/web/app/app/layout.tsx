'use client';

import { useEffect, useMemo, useState } from 'react';
import { Shell } from '../../components/shell';
import { apiFetch, handleApiError } from '../../lib/api';
import type { Route } from 'next';

const baseLinks: Array<{ href: Route; label: string }> = [
  { href: '/app/home', label: 'Home' },
  { href: '/app/company', label: 'Company' },
  { href: '/app/settings', label: 'Settings' },
  { href: '/app/team', label: 'Team' },
  { href: '/app/roles', label: 'Roles & Permissions' },
  { href: '/app/audit-logs', label: 'Audit Logs' }
];

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const [installedCount, setInstalledCount] = useState(0);

  useEffect(() => {
    apiFetch('/app-api/modules')
      .then((rows: unknown) => {
        const items = Array.isArray(rows) ? rows : [];
        setInstalledCount(items.length);
      })
      .catch(handleApiError);
  }, []);

  const links = useMemo(() => {
    const list = [...baseLinks];
    if (installedCount > 0) {
      list.push({ href: '/app/modules', label: 'Modules' });
    }
    return list;
  }, [installedCount]);

  return <Shell title="Customer App" links={links}>{children}</Shell>;
}
