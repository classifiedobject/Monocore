'use client';

import { useEffect, useState } from 'react';
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

export default function ModulesPage() {
  const [catalog, setCatalog] = useState<CatalogModule[]>([]);
  const [installed, setInstalled] = useState<any[]>([]);

  async function load() {
    try {
      const [catalogRows, installedRows] = await Promise.all([
        apiFetch('/app-api/modules/catalog') as Promise<CatalogModule[]>,
        apiFetch('/app-api/modules') as Promise<any[]>
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
      <div>
        <h1 className="mb-2 text-3xl font-bold">Module Marketplace</h1>
        <p className="text-sm text-slate-600">Published modules can be installed into the active company.</p>
      </div>

      <div className="grid gap-3">
        {catalog.map((module) => (
          <article key={module.id} className="rounded border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{module.name}</h2>
                <p className="text-sm text-slate-600">
                  {module.key} | v{module.version}
                </p>
                {module.description ? <p className="mt-1 text-sm text-slate-500">{module.description}</p> : null}
              </div>
              <button
                className="rounded bg-mono-500 px-3 py-2 text-sm text-white disabled:cursor-default disabled:bg-slate-400"
                disabled={module.installed}
                onClick={() => installModule(module.key)}
              >
                {module.installed ? 'Installed' : 'Install'}
              </button>
            </div>
          </article>
        ))}
      </div>

      <div>
        <h2 className="mb-3 text-xl font-semibold">Installed Modules</h2>
        <pre className="rounded bg-white p-4 text-sm">{JSON.stringify(installed, null, 2)}</pre>
      </div>
    </section>
  );
}
