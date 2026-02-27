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
  const [installedModuleKeys, setInstalledModuleKeys] = useState<string[]>([]);

  useEffect(() => {
    apiFetch('/app-api/modules')
      .then((rows: unknown) => {
        const items = Array.isArray(rows) ? rows : [];
        const keys = items
          .map((item) => {
            if (!item || typeof item !== 'object') return null;
            const row = item as { moduleKey?: string; module?: { key?: string } };
            return row.moduleKey ?? row.module?.key ?? null;
          })
          .filter((key): key is string => typeof key === 'string');
        setInstalledModuleKeys(keys);
      })
      .catch(handleApiError);
  }, []);

  const links = useMemo(() => {
    const list = [...baseLinks];
    if (installedModuleKeys.length > 0) {
      list.push({ href: '/app/modules', label: 'Modules' });
    }
    if (installedModuleKeys.includes('finance-core')) {
      list.push({ href: '/app/finance', label: 'Finance' });
    }
    return list;
  }, [installedModuleKeys]);

  return <Shell title="Customer App" links={links}>{children}</Shell>;
}
