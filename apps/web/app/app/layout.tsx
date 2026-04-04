'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Shell, type ShellSection } from '../../components/shell';
import { apiFetch, handleApiError } from '../../lib/api';
import type { Route } from 'next';

type ModuleItem = { href: Route; label: string };

const coreSection: ShellSection = {
  label: 'Core Pages',
  items: [
    { type: 'link', href: '/app/home', label: 'Home' },
    {
      type: 'group',
      id: 'company',
      label: 'Company',
      items: [
        { href: '/app/company', label: 'Create & Selection' },
        { href: '/app/company/org', label: 'Departments & Titles' },
        { href: '/app/team', label: 'Team' },
        { href: '/app/roles', label: 'Roles & Permissions' }
      ]
    },
    { type: 'link', href: '/app/modules', label: 'Modules' },
    { type: 'link', href: '/app/settings', label: 'Settings' },
    { type: 'link', href: '/app/audit-logs', label: 'Audit Logs' }
  ]
};

const moduleRegistry: Record<string, { id: string; label: string; items: ModuleItem[] }> = {
  'finance-core': {
    id: 'finance-core',
    label: 'Finance Core',
    items: [{ href: '/app/finance', label: 'Overview' }]
  },
  'inventory-core': {
    id: 'inventory-core',
    label: 'Inventory Core',
    items: [
      { href: '/app/inventory', label: 'Overview' },
      { href: '/app/inventory/items', label: 'Items' },
      { href: '/app/inventory/suppliers', label: 'Suppliers' },
      { href: '/app/inventory/stock-counts', label: 'Stock Counts' }
    ]
  },
  'recipe-core': {
    id: 'recipe-core',
    label: 'Recipe Core',
    items: [{ href: '/app/recipes', label: 'Recipes' }]
  },
  'sales-core': {
    id: 'sales-core',
    label: 'Sales Core',
    items: [{ href: '/app/sales', label: 'Orders' }]
  },
  'task-core': {
    id: 'task-core',
    label: 'Task Core',
    items: [{ href: '/app/tasks', label: 'Tasks' }]
  },
  'reservation-core': {
    id: 'reservation-core',
    label: 'Reservation Core',
    items: [{ href: '/app/reservations', label: 'Reservations' }]
  },
  'executive-core': {
    id: 'executive-core',
    label: 'Executive Core',
    items: [{ href: '/app/executive', label: 'Dashboard' }]
  },
  'payroll-core': {
    id: 'payroll-core',
    label: 'Payroll Core',
    items: [
      { href: '/app/payroll', label: 'Management' },
      { href: '/app/payroll/employees', label: 'Employees' },
      { href: '/app/payroll/employment', label: 'Employment Records' },
      { href: '/app/payroll/compensation', label: 'Compensation Profiles' },
      { href: '/app/payroll/matrix', label: 'Compensation Matrix' },
      { href: '/app/payroll/periods', label: 'Payroll Periods' }
    ]
  },
  'tip-core': {
    id: 'tip-core',
    label: 'Tip Core',
    items: [
      { href: '/app/tips', label: 'Overview' },
      { href: '/app/tips/rules', label: 'Tip Rules' }
    ]
  }
};

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

  const sections = useMemo(() => {
    const nextSections: ShellSection[] = [coreSection];

    if (onboardingCompleted !== true) {
      nextSections[0] = {
        ...coreSection,
        items: [...coreSection.items, { type: 'link', href: '/app/onboarding', label: 'Onboarding' }]
      };
    }

    const installedGroups = installedModuleKeys
      .map((key) => moduleRegistry[key])
      .filter((group): group is (typeof moduleRegistry)[keyof typeof moduleRegistry] => Boolean(group))
      .map((group) => ({
        type: 'group' as const,
        id: group.id,
        label: group.label,
        items: group.items
      }));

    if (installedGroups.length > 0) {
      nextSections.push({
        label: 'Installed Modules',
        items: installedGroups
      });
    }

    return nextSections;
  }, [installedModuleKeys, onboardingCompleted]);

  return (
    <Shell
      title="Customer App"
      subtitle="Organizasyonu, operasyonu ve modülleri tek bir akış içinde yönetin."
      sections={sections}
    >
      {children}
    </Shell>
  );
}
