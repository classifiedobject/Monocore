import { Shell } from '../../components/shell';
import type { Route } from 'next';

const links: Array<{ href: Route; label: string }> = [
  { href: '/app/home', label: 'Home' },
  { href: '/app/company', label: 'Company' },
  { href: '/app/settings', label: 'Settings' },
  { href: '/app/team', label: 'Team' },
  { href: '/app/roles', label: 'Roles & Permissions' },
  { href: '/app/audit-logs', label: 'Audit Logs' },
  { href: '/app/modules', label: 'Modules' }
];

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <Shell title="Customer App" links={links}>{children}</Shell>;
}
