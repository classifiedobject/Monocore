'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Shell, type ShellLink, type ShellModuleGroup } from '../../components/shell';
import { apiFetch, handleApiError } from '../../lib/api';
import type { Route } from 'next';

type InstalledModule = {
  moduleKey?: string;
  module?: {
    key?: string;
    name?: string | null;
  };
};

const coreLinks: ShellLink[] = [
  { href: '/app/home', label: 'Home' },
  { href: '/app/modules', label: 'Modules' },
  { href: '/app/settings', label: 'Settings' },
  { href: '/app/audit-logs', label: 'Audit Logs' }
];

const coreGroups: ShellModuleGroup[] = [
  {
    key: 'company-core',
    label: 'Company',
    items: [
      { href: '/app/company', label: 'Create & Selection', exact: true },
      { href: '/app/company/org', label: 'Departments & Titles', exact: true },
      { href: '/app/team', label: 'Team', exact: true },
      { href: '/app/roles', label: 'Roles & Permissions', exact: true }
    ]
  }
];

const moduleNavigationRegistry: Record<
  string,
  { label: string; items: Array<{ href: Route; label: string }> }
> = {
  'finance-core': {
    label: 'Finance Core',
    items: [{ href: '/app/finance', label: 'Overview' }]
  },
  'inventory-core': {
    label: 'Inventory Core',
    items: [
      { href: '/app/inventory', label: 'Overview' },
      { href: '/app/inventory/items', label: 'Items' },
      { href: '/app/inventory/suppliers', label: 'Suppliers' },
      { href: '/app/inventory/stock-counts', label: 'Stock Counts' }
    ]
  },
  'recipe-core': {
    label: 'Recipe Core',
    items: [{ href: '/app/recipes', label: 'Products & Recipes' }]
  },
  'sales-core': {
    label: 'Sales Core',
    items: [{ href: '/app/sales', label: 'Orders' }]
  },
  'task-core': {
    label: 'Task Core',
    items: [{ href: '/app/tasks', label: 'Workspace' }]
  },
  'reservation-core': {
    label: 'Reservation Core',
    items: [{ href: '/app/reservations', label: 'Reservations' }]
  },
  'executive-core': {
    label: 'Executive Core',
    items: [{ href: '/app/executive', label: 'Dashboard' }]
  },
  'payroll-core': {
    label: 'Payroll Core',
    items: [
      { href: '/app/payroll', label: 'Management' },
      { href: '/app/payroll/employees', label: 'Employees' },
      { href: '/app/payroll/employment', label: 'Employment Records' },
      { href: '/app/payroll/compensation', label: 'Compensation Profiles' },
      { href: '/app/payroll/worklogs', label: 'Worklogs' },
      { href: '/app/payroll/periods', label: 'Payroll Periods' }
    ]
  },
  'tip-core': {
    label: 'Tip Core',
    items: [{ href: '/app/tips', label: 'Overview' }]
  }
};

function buildModuleGroups(installedModules: InstalledModule[]): ShellModuleGroup[] {
  const groups: ShellModuleGroup[] = [];

  for (const row of installedModules) {
    const key = row.moduleKey ?? row.module?.key;
    if (!key) continue;

    const config = moduleNavigationRegistry[key];
    if (!config) continue;

    groups.push({
      key,
      label: row.module?.name?.trim() || config.label,
      items: config.items.map((item): ShellLink => ({ ...item, exact: true }))
    });
  }

  return groups;
}

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [installedModules, setInstalledModules] = useState<InstalledModule[]>([]);
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    apiFetch('/app-api/modules')
      .then((rows: unknown) => {
        const items = Array.isArray(rows) ? (rows as InstalledModule[]) : [];
        setInstalledModules(items);
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

  const appCoreLinks = useMemo(() => {
    if (onboardingCompleted === true) return coreLinks;
    return [
      ...coreLinks,
      { href: '/app/onboarding' as Route, label: 'Onboarding', exact: true } satisfies ShellLink
    ];
  }, [onboardingCompleted]);

  const moduleGroups = useMemo(() => buildModuleGroups(installedModules), [installedModules]);

  return (
    <Shell
      title="Customer Workspace"
      coreLinks={appCoreLinks}
      coreGroups={coreGroups}
      moduleGroups={moduleGroups}
    >
      {children}
    </Shell>
  );
}
