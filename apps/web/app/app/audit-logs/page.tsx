'use client';

import { useEffect, useState } from 'react';
import { EmptyState, PageHeader, SectionCard, formatDate } from '../../../components/readable-ui';
import { apiFetch, handleApiError } from '../../../lib/api';

type AuditRow = {
  id: string;
  action?: string | null;
  actorUserId?: string | null;
  createdAt?: string | null;
  metadata?: unknown;
};

export default function AuditLogsPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);

  useEffect(() => {
    apiFetch('/app-api/audit-logs').then(setRows).catch(handleApiError);
  }, []);

  return (
    <section className="space-y-6">
      <PageHeader
        title="İşlem Kayıtları"
        description="Kimin, ne zaman, hangi işlemi yaptığını bu ekrandan takip edebilirsin."
      />
      <SectionCard title="Kayıt Listesi" description="Son kullanıcı ve sistem işlemleri kronolojik sırada listelenir.">
        {rows.length === 0 ? (
          <EmptyState title="Kayıt bulunamadı" description="Gösterilecek audit log verisi yok." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Zaman</th>
                  <th className="px-3 py-2">İşlem</th>
                  <th className="px-3 py-2">Aktör</th>
                  <th className="px-3 py-2">Detay</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="px-3 py-3 text-slate-600">{formatDate(row.createdAt)}</td>
                    <td className="px-3 py-3 font-medium text-slate-900">{row.action ?? '-'}</td>
                    <td className="px-3 py-3 text-slate-600">{row.actorUserId ?? 'Sistem'}</td>
                    <td className="px-3 py-3 text-slate-600">
                      {row.metadata ? <span className="line-clamp-2">{JSON.stringify(row.metadata)}</span> : 'Ek detay yok'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </section>
  );
}
