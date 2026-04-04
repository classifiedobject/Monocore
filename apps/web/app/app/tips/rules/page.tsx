'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch, handleApiError } from '../../../../lib/api';

type OrgTitleRow = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  titleRule: null | {
    id: string;
    tipWeight: number;
    isActive: boolean;
  };
  effectiveTipWeight: number;
  effectiveSource: 'title' | 'department' | 'none';
};

type OrgDepartmentRow = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  departmentRule: null | {
    id: string;
    defaultTipWeight: number;
    isActive: boolean;
  };
  titles: OrgTitleRow[];
};

type EditorState =
  | null
  | {
      type: 'department';
      departmentId: string;
      ruleId: string | null;
      name: string;
      weight: string;
      isActive: boolean;
    }
  | {
      type: 'title';
      departmentId: string;
      titleId: string;
      ruleId: string | null;
      name: string;
      weight: string;
      isActive: boolean;
    };

const numberFormatter = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export default function TipRulesPage() {
  const [rows, setRows] = useState<OrgDepartmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = (await apiFetch('/app-api/tips/rules/organization-view')) as OrgDepartmentRow[];
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tip kuralları yüklenemedi.');
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(handleApiError);
  }, []);

  const hasOrgData = useMemo(() => rows.some((row) => row.titles.length > 0), [rows]);

  function openDepartmentEditor(row: OrgDepartmentRow) {
    setEditor({
      type: 'department',
      departmentId: row.id,
      ruleId: row.departmentRule?.id ?? null,
      name: row.name,
      weight: row.departmentRule ? String(row.departmentRule.defaultTipWeight) : '0',
      isActive: row.departmentRule?.isActive ?? true
    });
  }

  function openTitleEditor(department: OrgDepartmentRow, title: OrgTitleRow) {
    setEditor({
      type: 'title',
      departmentId: department.id,
      titleId: title.id,
      ruleId: title.titleRule?.id ?? null,
      name: title.name,
      weight: title.titleRule ? String(title.titleRule.tipWeight) : String(title.effectiveSource === 'title' ? title.effectiveTipWeight : 0),
      isActive: title.titleRule?.isActive ?? true
    });
  }

  async function submitEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setSaving(true);
    setError(null);
    try {
      if (editor.type === 'department') {
        const payload = {
          departmentId: editor.departmentId,
          defaultTipWeight: Number(editor.weight),
          isActive: editor.isActive
        };
        await apiFetch(
          editor.ruleId ? `/app-api/tips/rules/departments/${editor.ruleId}` : '/app-api/tips/rules/departments',
          {
            method: editor.ruleId ? 'PATCH' : 'POST',
            body: JSON.stringify(payload)
          }
        );
      } else {
        const payload = {
          departmentId: editor.departmentId,
          titleId: editor.titleId,
          tipWeight: Number(editor.weight),
          isActive: editor.isActive
        };
        await apiFetch(editor.ruleId ? `/app-api/tips/rules/titles/${editor.ruleId}` : '/app-api/tips/rules/titles', {
          method: editor.ruleId ? 'PATCH' : 'POST',
          body: JSON.stringify(payload)
        });
      }
      setEditor(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kural kaydedilemedi.');
      handleApiError(err);
    } finally {
      setSaving(false);
    }
  }

  async function toggleDepartment(row: OrgDepartmentRow) {
    if (!row.departmentRule) {
      openDepartmentEditor(row);
      return;
    }
    try {
      await apiFetch(
        `/app-api/tips/rules/departments/${row.departmentRule.id}/${row.departmentRule.isActive ? 'deactivate' : 'activate'}`,
        { method: 'POST' }
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Departman kuralı güncellenemedi.');
      handleApiError(err);
    }
  }

  async function toggleTitle(department: OrgDepartmentRow, title: OrgTitleRow) {
    if (!title.titleRule) {
      openTitleEditor(department, title);
      return;
    }
    try {
      await apiFetch(`/app-api/tips/rules/titles/${title.titleRule.id}/${title.titleRule.isActive ? 'deactivate' : 'activate'}`, {
        method: 'POST'
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ünvan kuralı güncellenemedi.');
      handleApiError(err);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4">
        <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Tip Core</span>
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Tip Rules</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-600">
              Departman ve ünvan bazlı tip puanlarını burada yönetin. Ünvan puanı varsa departman puanını ezer.
            </p>
          </div>
          <a
            href="/app/tips"
            className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Tip Core&apos;a Dön
          </a>
        </div>
      </header>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      {!loading && !hasOrgData ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-8 text-sm text-amber-800">
          Önce Company Org içinde departman ve ünvan tanımlayın.
        </div>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Organizasyon Tip Kuralları</h2>
        </div>

        {loading ? (
          <div className="px-5 py-10 text-sm text-slate-500">Yükleniyor...</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {rows.map((department) => (
              <div key={department.id} className="px-5 py-4">
                <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 px-4 py-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <div className="text-base font-semibold text-slate-900">{department.name}</div>
                    <div className="text-sm text-slate-600">
                      {department.departmentRule
                        ? `${numberFormatter.format(department.departmentRule.defaultTipWeight)} varsayılan puan`
                        : 'Varsayılan departman puanı tanımlı değil'}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleDepartment(department)}
                      className={`inline-flex h-9 items-center rounded-full px-3 text-sm font-medium ${
                        department.departmentRule?.isActive
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {department.departmentRule?.isActive ? 'Aktif' : 'Pasif'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openDepartmentEditor(department)}
                      className="inline-flex h-9 items-center rounded-full border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
                    >
                      {department.departmentRule ? 'Düzenle' : 'Kural Ekle'}
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-2 pl-2 md:pl-6">
                  {department.titles.map((title) => (
                    <div
                      key={title.id}
                      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-slate-900">{title.name}</div>
                        <div className="text-sm text-slate-600">
                          {title.titleRule
                            ? `${numberFormatter.format(title.titleRule.tipWeight)} ünvan puanı`
                            : title.effectiveSource === 'department'
                              ? `Departman varsayılanı kullanılacak (${numberFormatter.format(title.effectiveTipWeight)})`
                              : 'Departman varsayılanı kullanılacak (0)'}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleTitle(department, title)}
                          className={`inline-flex h-8 items-center rounded-full px-3 text-sm font-medium ${
                            title.titleRule?.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {title.titleRule?.isActive ? 'Aktif' : 'Pasif'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openTitleEditor(department, title)}
                          className="inline-flex h-8 items-center rounded-full border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          {title.titleRule ? 'Düzenle' : 'Override Ekle'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {editor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/20 p-4">
          <div className="flex h-full w-full max-w-md flex-col rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {editor.type === 'department' ? 'Departman Tip Kuralı' : 'Ünvan Tip Kuralı'}
                </h2>
                <p className="mt-1 text-sm text-slate-600">{editor.name}</p>
              </div>
              <button type="button" onClick={() => setEditor(null)} className="text-sm text-slate-500">
                Kapat
              </button>
            </div>

            <form onSubmit={submitEditor} className="flex flex-1 flex-col justify-between">
              <div className="space-y-5 px-5 py-5">
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-700">
                    {editor.type === 'department' ? 'Varsayılan Tip Puanı' : 'Override Tip Puanı'}
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editor.weight}
                    onChange={(event) => setEditor({ ...editor, weight: event.target.value })}
                    className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-slate-400"
                    placeholder="0.00"
                  />
                </label>

                <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={editor.isActive}
                    onChange={(event) => setEditor({ ...editor, isActive: event.target.checked })}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  Kural aktif olsun
                </label>
              </div>

              <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4">
                <button
                  type="button"
                  onClick={() => setEditor(null)}
                  className="inline-flex h-10 items-center rounded-full border border-slate-200 px-4 text-sm font-medium text-slate-700"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-10 items-center rounded-full bg-slate-900 px-4 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
