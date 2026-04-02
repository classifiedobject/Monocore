import { Shell, type ShellLink } from '../../components/shell';
import type { Route } from 'next';

const links: ShellLink[] = [
  { href: '/platform/dashboard', label: 'Dashboard' },
  { href: '/platform/team', label: 'Platform Team' },
  { href: '/platform/roles', label: 'Roles & Permissions' },
  { href: '/platform/tenants', label: 'Tenants' },
  { href: '/platform/org-chart' as Route, label: 'Org Chart' },
  { href: '/platform/logs-center' as Route, label: 'Logs Center' },
  { href: '/platform/modules', label: 'Module Registry' },
  { href: '/platform/settings', label: 'Settings' },
  { href: '/platform/i18n', label: 'Language Packs' }
];

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell title="Monocore Platform" coreLinks={links} moduleGroups={[]}>
      {children}
    </Shell>
  );
}
