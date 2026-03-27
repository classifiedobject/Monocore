'use client';

import { useEffect, useState } from 'react';
import { EmptyState, PageHeader, SectionCard, StatusBadge } from '../../../components/readable-ui';
import { apiFetch, handleApiError } from '../../../lib/api';

type TenantRow = {
  id: string;
  name: string;
  plan?: string | null;
  locale?: string | null;
  createdAt?: string | null;
};

export default function PlatformTenantsPage() {
  const [companies, setCompanies] = useState<TenantRow[]>([]);

  useEffect(() => {
    apiFetch('/platform-api/tenants').then(setCompanies).catch(handleApiError);
  }, []);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Tenant Listesi"
        description="Monocore üzerinde aktif olan tüm şirketleri ve temel plan bilgilerini gösterir."
      />
      <SectionCard title="Şirketler" description="Platform tarafından yönetilen tüm tenant kayıtları.">
        {companies.length === 0 ? (
          <EmptyState title="Tenant bulunamadı" description="Henüz kayıtlı şirket görünmüyor." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {companies.map((company) => (
              <article key={company.id} className="rounded border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{company.name}</h2>
                    <p className="text-sm text-slate-600">{company.locale ? `Dil: ${company.locale}` : 'Dil bilgisi yok'}</p>
                    <p className="text-xs text-slate-500">{company.createdAt ?? 'Oluşturma tarihi yok'}</p>
                  </div>
                  <StatusBadge label={company.plan ?? 'Plan yok'} tone="slate" />
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionCard>
    </section>
  );
}
