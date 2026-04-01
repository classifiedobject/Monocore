'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Route } from 'next';

export type ShellLink = {
  href: Route;
  label: string;
  exact?: boolean;
};

export type ShellModuleGroup = {
  key: string;
  label: string;
  items: ShellLink[];
};

const CUSTOMER_APP_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif';
const OPEN_MODULES_STORAGE_KEY = 'customer-app-open-modules';

function isLinkActive(pathname: string, link: ShellLink) {
  if (link.exact !== false) {
    return pathname === link.href;
  }
  return pathname === link.href || pathname.startsWith(`${link.href}/`);
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${open ? 'rotate-90' : ''}`}
    >
      <path d="M7 4.5L12.5 10L7 15.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NavIcon({ kind }: { kind: 'home' | 'company' | 'modules' | 'settings' | 'audit' | 'module' }) {
  const baseClass = 'h-5 w-5 text-slate-400';

  if (kind === 'home') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={baseClass}>
        <path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (kind === 'company') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={baseClass}>
        <path d="M4 20V6a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v14M14 10h5a1 1 0 0 1 1 1v9M8 9h2M8 13h2M8 17h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (kind === 'modules') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={baseClass}>
        <path d="M12 3l7 4v10l-7 4-7-4V7l7-4Zm0 0v18M5 7l7 4 7-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (kind === 'settings') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={baseClass}>
        <path d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.6Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (kind === 'audit') {
    return (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={baseClass}>
        <path d="M7 4h10l3 3v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 10h6M9 14h6M9 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={baseClass}>
      <path d="M4 7a2 2 0 0 1 2-2h3l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function topLevelRowClass(active: boolean) {
  return active
    ? 'flex w-full items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3 text-left text-[18px] font-semibold tracking-[-0.01em] text-slate-900 outline-none transition focus:outline-none focus-visible:outline-none'
    : 'flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[18px] font-semibold tracking-[-0.01em] text-slate-700 outline-none transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:outline-none';
}

function childLinkClass(active: boolean) {
  return active
    ? 'rounded-xl bg-slate-100 px-4 py-2.5 text-[17px] font-medium text-slate-900 outline-none transition focus:outline-none focus-visible:outline-none'
    : 'rounded-xl px-4 py-2.5 text-[17px] font-medium text-slate-600 outline-none transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus-visible:outline-none';
}

function iconKindForLink(link: ShellLink): 'home' | 'company' | 'modules' | 'settings' | 'audit' | 'module' {
  if (link.href === '/app/home') return 'home';
  if (link.href === '/app/modules') return 'modules';
  if (link.href === '/app/settings') return 'settings';
  if (link.href === '/app/audit-logs') return 'audit';
  return 'module';
}

export function Shell({
  title,
  coreLinks,
  coreGroups,
  moduleGroups,
  children
}: {
  title: string;
  coreLinks: ShellLink[];
  coreGroups?: ShellModuleGroup[];
  moduleGroups: ShellModuleGroup[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const allGroups = useMemo(() => [...(coreGroups ?? []), ...moduleGroups], [coreGroups, moduleGroups]);

  const activeGroupKeys = useMemo(
    () =>
      allGroups
        .filter((group) => group.items.some((item) => isLinkActive(pathname, item)))
        .map((group) => group.key),
    [allGroups, pathname]
  );

  useEffect(() => {
    const saved =
      typeof window === 'undefined' ? null : window.localStorage.getItem(OPEN_MODULES_STORAGE_KEY);

    setOpenGroups(() => {
      let parsed: Record<string, boolean> = {};
      if (saved) {
        try {
          const json = JSON.parse(saved) as Record<string, boolean>;
          parsed = typeof json === 'object' && json !== null ? json : {};
        } catch {
          parsed = {};
        }
      }

      const next: Record<string, boolean> = {};
      for (const group of allGroups) {
        next[group.key] = parsed[group.key] ?? activeGroupKeys.includes(group.key);
      }
      return next;
    });
  }, [activeGroupKeys, allGroups]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(OPEN_MODULES_STORAGE_KEY, JSON.stringify(openGroups));
  }, [openGroups]);

  useEffect(() => {
    if (activeGroupKeys.length === 0) return;
    setOpenGroups((current) => {
      const primaryKey = activeGroupKeys[0];
      const next: Record<string, boolean> = {};
      let changed = false;

      for (const group of allGroups) {
        const shouldBeOpen = group.key === primaryKey;
        next[group.key] = shouldBeOpen;
        if ((current[group.key] ?? false) !== shouldBeOpen) {
          changed = true;
        }
      }

      return changed ? next : current;
    });
  }, [activeGroupKeys, allGroups]);

  return (
    <div
      style={{ fontFamily: CUSTOMER_APP_FONT_STACK }}
      className="min-h-screen bg-[#f7f8fb] text-slate-900 antialiased"
    >
      <div className="grid min-h-screen grid-cols-1 md:grid-cols-[308px_1fr]">
        <aside className="border-r border-slate-200 bg-white px-5 py-7 md:px-6 md:py-8">
          <div className="space-y-8">
            <header className="px-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Customer App</p>
              <h1 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-slate-950">{title}</h1>
            </header>

            <div className="space-y-7">
              <section className="space-y-2">
                <nav className="flex flex-col gap-1">
                  {coreLinks.map((link) => {
                    const active = isLinkActive(pathname, link);
                    return (
                      <Link key={link.href} href={link.href} className={topLevelRowClass(active)}>
                        <NavIcon kind={iconKindForLink(link)} />
                        <span>{link.label}</span>
                      </Link>
                    );
                  })}

                  {(coreGroups ?? []).map((group) => {
                    const active = activeGroupKeys.includes(group.key);
                    const open = openGroups[group.key] ?? active;

                    return (
                      <div key={group.key} className="space-y-1">
                        <button
                          type="button"
                          className={`${topLevelRowClass(active)} justify-between`}
                          onClick={() =>
                            setOpenGroups((current) => {
                              const nextOpen = !(current[group.key] ?? false);
                              const next: Record<string, boolean> = {};

                              for (const candidate of allGroups) {
                                next[candidate.key] = candidate.key === group.key ? nextOpen : false;
                              }

                              return next;
                            })
                          }
                        >
                          <span className="flex items-center gap-3">
                            <NavIcon kind="company" />
                            <span>{group.label}</span>
                          </span>
                          <ChevronIcon open={open} />
                        </button>

                        <div
                          className={`grid overflow-hidden transition-all duration-200 ease-out ${
                            open ? 'mt-1 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                          }`}
                        >
                          <div className="overflow-hidden">
                            <div className="ml-4 flex flex-col gap-1 border-l border-slate-200 pl-5">
                              {group.items.map((item) => {
                                const itemActive = isLinkActive(pathname, item);
                                return (
                                  <Link key={item.href} href={item.href} className={childLinkClass(itemActive)}>
                                    {item.label}
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </nav>
              </section>

              {moduleGroups.length > 0 ? (
                <section className="space-y-2">
                  <div className="px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Installed Modules
                  </div>
                  <nav className="flex flex-col gap-1">
                    {moduleGroups.map((group) => {
                      const active = activeGroupKeys.includes(group.key);
                      const open = openGroups[group.key] ?? active;

                      return (
                        <div key={group.key} className="space-y-1">
                          <button
                            type="button"
                            className={`${topLevelRowClass(active)} justify-between`}
                            onClick={() =>
                              setOpenGroups((current) => {
                                const nextOpen = !(current[group.key] ?? false);
                                const next: Record<string, boolean> = {};

                                for (const candidate of allGroups) {
                                  next[candidate.key] = candidate.key === group.key ? nextOpen : false;
                                }

                                return next;
                              })
                            }
                          >
                            <span className="flex items-center gap-3">
                              <NavIcon kind="module" />
                              <span>{group.label}</span>
                            </span>
                            <ChevronIcon open={open} />
                          </button>

                          <div
                            className={`grid overflow-hidden transition-all duration-200 ease-out ${
                              open ? 'mt-1 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                            }`}
                          >
                            <div className="overflow-hidden">
                              <div className="ml-4 flex flex-col gap-1 border-l border-slate-200 pl-5">
                                {group.items.map((item) => {
                                  const itemActive = isLinkActive(pathname, item);
                                  return (
                                    <Link key={item.href} href={item.href} className={childLinkClass(itemActive)}>
                                      {item.label}
                                    </Link>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </nav>
                </section>
              ) : null}
            </div>
          </div>
        </aside>

        <main className="min-w-0 px-6 py-8 md:px-10 md:py-10">
          <div className="mx-auto max-w-7xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
