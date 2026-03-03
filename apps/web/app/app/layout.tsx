'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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
  const pathname = usePathname();
  const router = useRouter();
  const [installedModuleKeys, setInstalledModuleKeys] = useState<string[]>([]);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

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

  useEffect(() => {
    apiFetch('/app-api/companies')
      .then((rows: unknown) => {
        const items = Array.isArray(rows) ? rows : [];
        const stored = window.localStorage.getItem('activeCompanyId') ?? '';
        const selected = items.find((row) => {
          if (!row || typeof row !== 'object') return false;
          const entry = row as { company?: { id?: string } };
          return entry.company?.id === stored;
        }) as { company?: { onboardingCompleted?: boolean } } | undefined;
        if (selected?.company && typeof selected.company.onboardingCompleted === 'boolean') {
          setOnboardingCompleted(selected.company.onboardingCompleted);
        } else {
          setOnboardingCompleted(null);
        }
      })
      .catch(handleApiError);
  }, []);

  useEffect(() => {
    if (onboardingCompleted === null) return;
    if (!pathname.startsWith('/app/')) return;
    if (pathname.startsWith('/app/company')) return;

    if (!onboardingCompleted && !pathname.startsWith('/app/onboarding')) {
      router.push('/app/onboarding');
      return;
    }

    if (onboardingCompleted && pathname.startsWith('/app/onboarding')) {
      router.push('/app/home');
    }
  }, [onboardingCompleted, pathname, router]);

  const links = useMemo(() => {
    const list = [...baseLinks];
    if (onboardingCompleted !== true) {
      list.push({ href: '/app/onboarding', label: 'Onboarding' });
    }
    if (installedModuleKeys.length > 0) {
      list.push({ href: '/app/modules', label: 'Modules' });
    }
    if (installedModuleKeys.includes('finance-core')) {
      list.push({ href: '/app/finance', label: 'Finance' });
    }
    if (installedModuleKeys.includes('inventory-core')) {
      list.push({ href: '/app/inventory', label: 'Inventory' });
    }
    if (installedModuleKeys.includes('recipe-core')) {
      list.push({ href: '/app/recipes', label: 'Recipes' });
    }
    if (installedModuleKeys.includes('sales-core')) {
      list.push({ href: '/app/sales', label: 'Sales' });
    }
    if (installedModuleKeys.includes('task-core')) {
      list.push({ href: '/app/tasks', label: 'Tasks' });
    }
    if (installedModuleKeys.includes('reservation-core')) {
      list.push({ href: '/app/reservations', label: 'Reservations' });
    }
    if (installedModuleKeys.includes('executive-core')) {
      list.push({ href: '/app/executive', label: 'Executive' });
    }
    if (installedModuleKeys.includes('payroll-core')) {
      list.push({ href: '/app/payroll', label: 'Payroll' });
    }
    return list;
  }, [installedModuleKeys, onboardingCompleted]);

  return <Shell title="Customer App" links={links}>{children}</Shell>;
}
