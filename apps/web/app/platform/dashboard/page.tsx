'use client';

import { useEffect, useState } from 'react';
import { EmptyState, PageHeader, SectionCard, StatCard } from '../../../components/readable-ui';
import { apiFetch, handleApiError } from '../../../lib/api';

export default function PlatformDashboardPage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    apiFetch('/platform-api/dashboard').then(setData).catch(handleApiError);
  }, []);

  const metrics = data && typeof data === 'object' && 'metrics' in data ? (data.metrics as Record<string, unknown>) : {};

  return (
    <section className="space-y-6">
      <PageHeader
        title="Platform Kontrol Paneli"
        description="Monocore platform tarafındaki genel metrikleri ve kontrol düzeyi özetlerini gösterir."
      />
      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Mesaj" value={String((data.message as string | undefined) ?? 'Hazır')} />
            <StatCard label="Metrik Alanı" value={Object.keys(metrics).length} />
            <StatCard label="Platform Durumu" value="Aktif" />
          </div>
          <SectionCard title="Metrik Özeti" description="Platform API’den gelen özet alanlar.">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Object.entries(metrics).map(([key, value]) => (
                <article key={key} className="rounded border border-slate-200 p-3">
                  <p className="text-sm text-slate-500">{key}</p>
                  <p className="mt-2 font-semibold text-slate-900">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </p>
                </article>
              ))}
            </div>
          </SectionCard>
        </>
      ) : (
        <EmptyState title="Dashboard yükleniyor" description="Platform metrikleri henüz gelmedi." />
      )}
    </section>
  );
}
