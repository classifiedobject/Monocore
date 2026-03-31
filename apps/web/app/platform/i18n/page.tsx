'use client';

import { FormEvent, useEffect, useState } from 'react';
import { EmptyState, PageHeader, SectionCard } from '../../../components/readable-ui';
import { apiFetch, handleApiError } from '../../../lib/api';

type I18nRow = {
  id: string;
  locale: string;
  namespace: string;
  key: string;
  value: string;
};

export default function PlatformI18nPage() {
  const [rows, setRows] = useState<I18nRow[]>([]);
  const [locale, setLocale] = useState('tr');
  const [namespace, setNamespace] = useState('common');
  const [key, setKey] = useState('welcome');
  const [value, setValue] = useState('Hos geldiniz');
  const [jsonData, setJsonData] = useState('{\n  "common": {\n    "welcome": "Welcome"\n  }\n}');

  const load = () => apiFetch('/platform-api/i18n').then(setRows).catch(handleApiError);
  useEffect(() => void load(), []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    await apiFetch('/platform-api/i18n', {
      method: 'POST',
      body: JSON.stringify({ locale, namespace, key, value })
    });
    await load();
  }

  async function exportJson() {
    const exported = await apiFetch(`/platform-api/i18n/export?locale=${encodeURIComponent(locale)}`) as { data?: Record<string, Record<string, string>> };
    setJsonData(JSON.stringify(exported.data ?? {}, null, 2));
  }

  async function importJson() {
    const parsed = JSON.parse(jsonData) as Record<string, Record<string, string>>;
    await apiFetch('/platform-api/i18n/import', {
      method: 'POST',
      body: JSON.stringify({ locale, data: parsed })
    });
    await load();
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Dil Paketleri"
        description="Arayüz metinlerini locale ve namespace bazında düzenleyebilir, toplu JSON içe ve dışa aktarma yapabilirsin."
      />
      <SectionCard title="Tekil Metin Kaydı" description="Belirli bir locale ve anahtar için çeviri kaydı oluştur veya güncelle.">
        <form className="grid gap-2 md:grid-cols-5" onSubmit={submit}>
          <input className="rounded border p-2" value={locale} onChange={(e) => setLocale(e.target.value)} placeholder="Locale" />
          <input className="rounded border p-2" value={namespace} onChange={(e) => setNamespace(e.target.value)} placeholder="Namespace" />
          <input className="rounded border p-2" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Anahtar" />
          <input className="rounded border p-2" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Metin değeri" />
          <button className="rounded bg-mono-500 px-4 text-white">Kaydet</button>
        </form>
      </SectionCard>
      <SectionCard title="JSON İçe / Dışa Aktarma" description="Daha büyük dil paketlerini toplu olarak yönetebilirsin.">
        <textarea
          className="h-44 w-full rounded border p-2 font-mono text-sm"
          value={jsonData}
          onChange={(e) => setJsonData(e.target.value)}
        />
        <div className="flex gap-2">
          <button className="rounded border px-3 py-2" onClick={() => void exportJson()}>
            JSON Dışa Aktar
          </button>
          <button className="rounded bg-mono-500 px-3 py-2 text-white" onClick={() => void importJson()}>
            JSON İçe Aktar
          </button>
        </div>
      </SectionCard>
      <SectionCard title="Kayıtlı Anahtarlar" description="Sistemde saklanan çeviri kayıtları.">
        {rows.length === 0 ? (
          <EmptyState title="Çeviri kaydı yok" description="Henüz kayıtlı dil anahtarı bulunamadı." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2">Locale</th>
                  <th className="px-3 py-2">Namespace</th>
                  <th className="px-3 py-2">Anahtar</th>
                  <th className="px-3 py-2">Değer</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="px-3 py-3">{row.locale}</td>
                    <td className="px-3 py-3">{row.namespace}</td>
                    <td className="px-3 py-3 font-medium text-slate-900">{row.key}</td>
                    <td className="px-3 py-3 text-slate-600">{row.value}</td>
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
