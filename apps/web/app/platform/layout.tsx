import { Shell } from '../../components/shell';
import type { Route } from 'next';

const links: Array<{ href: Route; label: string }> = [
  { href: '/platform/dashboard', label: 'Dashboard' },
  { href: '/platform/team', label: 'Platform Team' },
  { href: '/platform/roles', label: 'Roles & Permissions' },
  { href: '/platform/tenants', label: 'Tenants' },
  { href: '/platform/modules', label: 'Module Registry' },
  { href: '/platform/settings', label: 'Settings' },
  { href: '/platform/i18n', label: 'Language Packs' }
];

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <Shell title="Monocore Platform" links={links}>{children}</Shell>;
}
