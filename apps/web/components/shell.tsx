'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { Route } from 'next';

export type ShellLink = {
  type: 'link';
  href: Route;
  label: string;
};

export type ShellGroup = {
  type: 'group';
  id: string;
  label: string;
  items: Array<{ href: Route; label: string }>;
};

export type ShellSection = {
  label?: string;
  items: Array<ShellLink | ShellGroup>;
};

function matchesPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Shell({
  title,
  subtitle,
  sections,
  children
}: {
  title: string;
  subtitle?: string;
  sections: ShellSection[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const autoOpenGroupId = useMemo(() => {
    for (const section of sections) {
      for (const item of section.items) {
        if (item.type === 'group' && item.items.some((child) => matchesPath(pathname, child.href))) {
          return item.id;
        }
      }
    }
    return null;
  }, [pathname, sections]);

  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem('customer-shell-open-group');
    if (autoOpenGroupId) {
      setOpenGroupId(autoOpenGroupId);
      window.localStorage.setItem('customer-shell-open-group', autoOpenGroupId);
      return;
    }
    if (stored) {
      setOpenGroupId(stored);
    }
  }, [autoOpenGroupId]);

  function toggleGroup(groupId: string) {
    setOpenGroupId((current) => {
      const next = current === groupId ? null : groupId;
      if (next) {
        window.localStorage.setItem('customer-shell-open-group', next);
      } else {
        window.localStorage.removeItem('customer-shell-open-group');
      }
      return next;
    });
  }

  return (
    <div
      className="min-h-screen bg-[#f6f5f2] text-slate-900"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif' }}
    >
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[292px_minmax(0,1fr)]">
        <aside className="border-r border-slate-200/80 bg-white/88 backdrop-blur md:sticky md:top-0 md:h-screen">
          <div className="flex h-full flex-col px-5 py-6">
            <div className="mb-8 space-y-2 px-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Monocore</div>
              <div className="text-[30px] font-semibold tracking-tight text-slate-900">{title}</div>
              {subtitle ? <p className="max-w-[18rem] text-sm leading-6 text-slate-500">{subtitle}</p> : null}
            </div>

            <nav className="flex-1 space-y-7 overflow-y-auto pr-1">
              {sections.map((section) => (
                <div key={section.label ?? 'section'} className="space-y-2">
                  {section.label ? (
                    <div className="px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{section.label}</div>
                  ) : null}

                  <div className="space-y-1.5">
                    {section.items.map((item) => {
                      if (item.type === 'link') {
                        const active = matchesPath(pathname, item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={`block rounded-2xl px-4 py-3 text-[15px] font-medium transition focus:outline-none focus-visible:outline-none focus:ring-0 ${
                              active
                                ? 'bg-slate-100 text-slate-950 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.15)]'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                          >
                            {item.label}
                          </Link>
                        );
                      }

                      const groupActive = item.items.some((child) => matchesPath(pathname, child.href));
                      const open = openGroupId === item.id;
                      return (
                        <div key={item.id} className="rounded-[24px] border border-slate-200/80 bg-white px-2 py-2 shadow-[0_1px_0_rgba(15,23,42,0.02)]">
                          <button
                            type="button"
                            onClick={() => toggleGroup(item.id)}
                            className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-[15px] font-semibold transition focus:outline-none focus-visible:outline-none focus:ring-0 ${
                              groupActive ? 'bg-slate-100 text-slate-950' : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span>{item.label}</span>
                            <span className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>⌄</span>
                          </button>

                          <div
                            className={`overflow-hidden transition-all duration-200 ease-out ${open ? 'max-h-[480px] opacity-100' : 'max-h-0 opacity-0'}`}
                          >
                            <div className="flex flex-col gap-1 px-3 pb-2 pt-2">
                              {item.items.map((child) => {
                                const active = matchesPath(pathname, child.href);
                                return (
                                  <Link
                                    key={child.href}
                                    href={child.href}
                                    className={`block rounded-xl px-4 py-2.5 text-sm transition focus:outline-none focus-visible:outline-none focus:ring-0 ${
                                      active
                                        ? 'bg-slate-100 text-slate-950'
                                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                                    }`}
                                  >
                                    {child.label}
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </nav>
          </div>
        </aside>

        <main className="min-w-0">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
