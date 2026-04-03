'use client';

import { useEffect, useState } from 'react';
import { EmptyState, PageHeader, SectionCard, StatusBadge } from '../../../components/readable-ui';
import { apiFetch, handleApiError } from '../../../lib/api';

type CatalogModule = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  version: string;
  status: 'DRAFT' | 'PUBLISHED' | 'DEPRECATED';
  installed: boolean;
};

type InstalledModule = {
  id: string;
  moduleKey?: string;
  installedAt?: string;
  module?: {
    key?: string;
    name?: string;
  };
};

export default function ModulesPage() {
  const [catalog, setCatalog] = useState<CatalogModule[]>([]);
  const [installed, setInstalled] = useState<InstalledModule[]>([]);

  async function load() {
    try {
      const [catalogRows, installedRows] = await Promise.all([
        apiFetch('/app-api/modules/catalog') as Promise<CatalogModule[]>,
        apiFetch('/app-api/modules') as Promise<InstalledModule[]>
      ]);
      setCatalog(catalogRows);
      setInstalled(installedRows);
    } catch (error) {
      handleApiError(error);
    }
  }

  useEffect(() => {
    load().catch(handleApiError);
  }, []);

  async function installModule(moduleKey: string) {
    try {
      await apiFetch('/app-api/modules/install', {
        method: 'POST',
        body: JSON.stringify({ moduleKey, config: {} })
      });
      await load();
    } catch (error) {
      handleApiError(error);
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Modül Pazaryeri"
        description="Aktif şirket için kullanılabilir modülleri inceleyebilir ve yayınlanmış olanları kurabilirsin."
      />

      <SectionCard title="Katalog" description="Kurulabilir modüller ve yayın durumları.">
        {catalog.length === 0 ? (
          <EmptyState title="Modül bulunamadı" description="Pazaryerinde gösterilecek modül yok." />
        ) : (
          <div className="grid gap-3">
            {catalog.map((module) => (
              <article key={module.id} className="rounded border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-slate-900">{module.name}</h2>
                      <StatusBadge
                        label={module.status === 'PUBLISHED' ? 'Yayında' : module.status === 'DEPRECATED' ? 'Kullanımdan Kalkıyor' : 'Taslak'}
                        tone={module.status === 'PUBLISHED' ? 'green' : module.status === 'DEPRECATED' ? 'amber' : 'slate'}
                      />
                    </div>
                    <p className="text-sm text-slate-600">
                      {module.key} · v{module.version}
                    </p>
                    {module.description ? <p className="text-sm text-slate-500">{module.description}</p> : null}
                  </div>
                  <button
                    className="rounded bg-mono-500 px-3 py-2 text-sm text-white disabled:cursor-default disabled:bg-slate-400"
                    disabled={module.installed}
                    onClick={() => installModule(module.key)}
                  >
                    {module.installed ? 'Kurulu' : 'Kur'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Kurulu Modüller" description="Bu şirkette aktif olarak kullanılan modüller.">
        {installed.length === 0 ? (
          <EmptyState title="Kurulu modül yok" description="Henüz şirkete kurulmuş modül bulunmuyor." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {installed.map((row) => (
              <article key={row.id} className="rounded border border-slate-200 p-3">
                <p className="font-medium text-slate-900">{row.module?.name ?? row.moduleKey ?? 'Modül'}</p>
                <p className="mt-1 text-sm text-slate-600">{row.module?.key ?? row.moduleKey ?? '-'}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {row.installedAt ? `Kurulum: ${row.installedAt}` : 'Kurulum tarihi kaydı yok'}
                </p>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </section>
  );
}
