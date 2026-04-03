'use client';

import { useEffect, useState } from 'react';
import { EmptyState, PageHeader, SectionCard, StatCard } from '../../../components/readable-ui';
import { apiFetch, handleApiError } from '../../../lib/api';

export default function HomePage() {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/app-api/dashboard')
      .then((result) => {
        setData(result);
        setErrorMessage(null);
      })
      .catch((error) => {
        setErrorMessage(error instanceof Error ? error.message : 'Dashboard verisi yüklenemedi.');
        handleApiError(error);
      });
  }, []);

  const metrics = data && typeof data === 'object' && 'metrics' in data ? (data.metrics as Record<string, unknown>) : {};

  return (
    <section className="space-y-6">
      <PageHeader
        title="Şirket Ana Sayfası"
        description="Aktif şirket için temel operasyon özetini tek ekranda gösterir."
      />

      {data ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              label="Toplam Metrik Alanı"
              value={Object.keys(metrics).length}
              helper="Dashboard cevabındaki özet alan sayısı"
            />
            <StatCard label="Durum Mesajı" value={String((data.message as string | undefined) ?? 'Hazır')} />
            <StatCard label="Şirket Görünümü" value="Aktif" helper="Bu ekran aktif şirket bağlamında çalışıyor" />
          </div>

          <SectionCard title="Operasyon Özeti" description="Backend’den gelen özet metriklerin okunabilir görünümü.">
            {Object.keys(metrics).length === 0 ? (
              <EmptyState title="Özet veri yok" description="Gösterilecek dashboard metriği bulunamadı." />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {Object.entries(metrics).map(([key, value]) => (
                  <article key={key} className="rounded border border-slate-200 p-3">
                    <p className="text-sm text-slate-500">{key}</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </SectionCard>
        </>
      ) : errorMessage ? (
        <EmptyState
          title="Dashboard verisi alınamadı"
          description={`${errorMessage} Uygulama kabuğu çalışıyor, ancak API bağlantısı hazır değil.`}
        />
      ) : (
        <EmptyState title="Veri yükleniyor" description="Dashboard bilgisi henüz gelmedi." />
      )}
    </section>
  );
}
