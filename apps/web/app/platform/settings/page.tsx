'use client';

import { FormEvent, useEffect, useState } from 'react';
import { EmptyState, PageHeader, SectionCard } from '../../../components/readable-ui';
import { apiFetch, handleApiError } from '../../../lib/api';

type SettingRow = {
  id?: string;
  key: string;
  value: string;
  createdAt?: string;
  updatedAt?: string;
};

export default function PlatformSettingsPage() {
  const [settings, setSettings] = useState<SettingRow[]>([]);
  const [key, setKey] = useState('support_email');
  const [value, setValue] = useState('support@themonocore.com');

  const load = () => apiFetch('/platform-api/settings').then(setSettings).catch(handleApiError);
  useEffect(() => void load(), []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    await apiFetch('/platform-api/settings', {
      method: 'POST',
      body: JSON.stringify({ key, value })
    });
    await load();
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Platform Ayarları"
        description="Tüm platformu etkileyen genel anahtar-değer ayarlarını bu ekrandan yönetebilirsin."
      />
      <SectionCard title="Yeni Ayar Kaydı" description="Basit anahtar-değer çiftleri ile sistem ayarı ekler veya güncellersin.">
        <form className="grid gap-2 md:grid-cols-[1fr_2fr_auto]" onSubmit={submit}>
          <input className="rounded border p-2" placeholder="Ayar anahtarı" value={key} onChange={(e) => setKey(e.target.value)} />
          <input className="rounded border p-2" placeholder="Ayar değeri" value={value} onChange={(e) => setValue(e.target.value)} />
          <button className="rounded bg-mono-500 px-4 text-white">Kaydet</button>
        </form>
      </SectionCard>
      <SectionCard title="Mevcut Ayarlar" description="Sistemde kayıtlı platform ayarları.">
        {settings.length === 0 ? (
          <EmptyState title="Ayar bulunamadı" description="Henüz kayıtlı platform ayarı yok." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Anahtar</th>
                  <th className="px-3 py-2">Değer</th>
                  <th className="px-3 py-2">Güncelleme</th>
                </tr>
              </thead>
              <tbody>
                {settings.map((setting) => (
                  <tr key={setting.id ?? setting.key} className="border-b last:border-0">
                    <td className="px-3 py-3 font-medium text-slate-900">{setting.key}</td>
                    <td className="px-3 py-3 text-slate-600">{setting.value}</td>
                    <td className="px-3 py-3 text-slate-500">{setting.updatedAt ?? setting.createdAt ?? '-'}</td>
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
