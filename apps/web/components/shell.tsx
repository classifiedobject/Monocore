import Link from 'next/link';
import type { Route } from 'next';

export function Shell({
  title,
  links,
  children
}: {
  title: string;
  links: Array<{ href: Route; label: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[240px_1fr]">
      <aside className="border-r border-slate-200 bg-white/90 p-4">
        <h1 className="mb-5 text-xl font-bold">{title}</h1>
        <nav className="flex flex-col gap-2">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="rounded px-3 py-2 hover:bg-slate-100">
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="p-6">{children}</main>
    </div>
  );
}
