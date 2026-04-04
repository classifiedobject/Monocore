import { Shell, type ShellSection } from '../../components/shell';
import type { Route } from 'next';

const sections: ShellSection[] = [
  {
    label: 'Platform',
    items: [
      { type: 'link', href: '/platform/dashboard', label: 'Dashboard' },
      { type: 'link', href: '/platform/team', label: 'Platform Team' },
      { type: 'link', href: '/platform/roles', label: 'Roles & Permissions' },
      { type: 'link', href: '/platform/tenants', label: 'Tenants' },
      { type: 'link', href: '/platform/org-chart' as Route, label: 'Org Chart' },
      { type: 'link', href: '/platform/logs-center' as Route, label: 'Logs Center' },
      { type: 'link', href: '/platform/modules', label: 'Module Registry' },
      { type: 'link', href: '/platform/settings', label: 'Settings' },
      { type: 'link', href: '/platform/i18n', label: 'Language Packs' }
    ]
  }
];

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell title="Monocore Platform" subtitle="Platform operasyonları ve sistem yönetimi." sections={sections}>
      {children}
    </Shell>
  );
}
