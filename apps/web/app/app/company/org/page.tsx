'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ApiError, apiFetch, handleApiError } from '../../../../lib/api';

type Department = {
  id: string;
  name: string;
  sortOrder: number;
  parentId: string | null;
  tipDepartment: 'SERVICE' | 'BAR' | 'KITCHEN' | 'SUPPORT' | 'OTHER';
  isActive: boolean;
  canDelete?: boolean;
  deleteBlockReason?: string | null;
};

type Title = {
  id: string;
  name: string;
  sortOrder: number;
  departmentId: string;
  isActive: boolean;
  department: { id: string; name: string; sortOrder: number };
  canDelete?: boolean;
  deleteBlockReason?: string | null;
};

type OrgRow = Department & { titles: Title[] };

type Notice = {
  tone: 'success' | 'warning' | 'error';
  text: string;
};

type EditorState =
  | null
  | {
      type: 'department';
      id: string | null;
      name: string;
      isActive: boolean;
    }
  | {
      type: 'title';
      id: string | null;
      name: string;
      departmentId: string;
      isActive: boolean;
    };

function sortDepartments(rows: Department[]) {
  return [...rows].sort((a, b) => {
    const orderDiff = a.sortOrder - b.sortOrder;
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name, 'tr');
  });
}

function sortTitles(rows: Title[]) {
  return [...rows].sort((a, b) => {
    const orderDiff = a.sortOrder - b.sortOrder;
    if (orderDiff !== 0) return orderDiff;
    return a.name.localeCompare(b.name, 'tr');
  });
}

export default function CompanyOrgPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [titles, setTitles] = useState<Title[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [editor, setEditor] = useState<EditorState>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dragItem, setDragItem] = useState<null | { type: 'department' | 'title'; id: string; departmentId?: string }>(null);

  async function load() {
    setLoading(true);
    try {
      const [departmentRows, titleRows] = await Promise.all([
        apiFetch('/app-api/company/org/departments') as Promise<Department[]>,
        apiFetch('/app-api/company/org/titles') as Promise<Title[]>
      ]);
      setDepartments(Array.isArray(departmentRows) ? departmentRows : []);
      setTitles(Array.isArray(titleRows) ? titleRows : []);
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Organizasyon verisi yüklenemedi.'
      });
      handleApiError(error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(handleApiError);
  }, []);

  const orgRows = useMemo<OrgRow[]>(() => {
    const titlesByDepartment = new Map<string, Title[]>();
    for (const title of titles) {
      const list = titlesByDepartment.get(title.departmentId) ?? [];
      list.push(title);
      titlesByDepartment.set(title.departmentId, list);
    }

    return sortDepartments(departments).map((department) => ({
      ...department,
      titles: sortTitles(titlesByDepartment.get(department.id) ?? [])
    }));
  }, [departments, titles]);

  function openDepartmentEditor(row?: Department) {
    setEditor({
      type: 'department',
      id: row?.id ?? null,
      name: row?.name ?? '',
      isActive: row?.isActive ?? true
    });
  }

  function openTitleEditor(row?: Title, departmentId?: string) {
    setEditor({
      type: 'title',
      id: row?.id ?? null,
      name: row?.name ?? '',
      departmentId: row?.departmentId ?? departmentId ?? orgRows[0]?.id ?? '',
      isActive: row?.isActive ?? true
    });
  }

  async function saveEditor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setSaving(true);
    setNotice(null);

    try {
      if (editor.type === 'department') {
        if (editor.id) {
          await apiFetch(`/app-api/company/org/departments/${editor.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ name: editor.name, isActive: editor.isActive })
          });
          setNotice({ tone: 'success', text: 'Departman güncellendi.' });
        } else {
          const nextSortOrder = (sortDepartments(departments).at(-1)?.sortOrder ?? 0) + 100;
          await apiFetch('/app-api/company/org/departments', {
            method: 'POST',
            body: JSON.stringify({
              name: editor.name,
              sortOrder: nextSortOrder,
              isActive: editor.isActive,
              tipDepartment: 'OTHER'
            })
          });
          setNotice({ tone: 'success', text: 'Departman oluşturuldu.' });
        }
      } else {
        if (!editor.departmentId) {
          setNotice({ tone: 'warning', text: 'Önce bir departman seçin.' });
          setSaving(false);
          return;
        }
        if (editor.id) {
          await apiFetch(`/app-api/company/org/titles/${editor.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              name: editor.name,
              departmentId: editor.departmentId,
              isActive: editor.isActive
            })
          });
          setNotice({ tone: 'success', text: 'Ünvan güncellendi.' });
        } else {
          const departmentTitles = sortTitles(titles.filter((row) => row.departmentId === editor.departmentId));
          const nextSortOrder = (departmentTitles.at(-1)?.sortOrder ?? 0) + 100;
          await apiFetch('/app-api/company/org/titles', {
            method: 'POST',
            body: JSON.stringify({
              name: editor.name,
              departmentId: editor.departmentId,
              sortOrder: nextSortOrder,
              tipWeight: 1,
              isTipEligible: true,
              departmentAggregate: false,
              isActive: editor.isActive
            })
          });
          setNotice({ tone: 'success', text: 'Ünvan oluşturuldu.' });
        }
      }

      setEditor(null);
      await load();
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Kayıt işlemi başarısız oldu.' });
      handleApiError(error);
    } finally {
      setSaving(false);
    }
  }

  async function toggleDepartment(row: Department) {
    try {
      await apiFetch(`/app-api/company/org/departments/${row.id}/${row.isActive ? 'deactivate' : 'activate'}`, { method: 'POST' });
      setNotice({ tone: 'success', text: `Departman ${row.isActive ? 'pasife alındı' : 'aktifleştirildi'}.` });
      await load();
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Departman durumu güncellenemedi.' });
      handleApiError(error);
    }
  }

  async function toggleTitle(row: Title) {
    try {
      await apiFetch(`/app-api/company/org/titles/${row.id}/${row.isActive ? 'deactivate' : 'activate'}`, { method: 'POST' });
      setNotice({ tone: 'success', text: `Ünvan ${row.isActive ? 'pasife alındı' : 'aktifleştirildi'}.` });
      await load();
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Ünvan durumu güncellenemedi.' });
      handleApiError(error);
    }
  }

  async function deleteDepartment(row: OrgRow) {
    if (!(row.canDelete ?? false)) {
      setNotice({ tone: 'warning', text: row.deleteBlockReason ?? 'Bu departman silinemiyor.' });
      return;
    }
    if (!window.confirm(`"${row.name}" departmanını silmek istiyor musunuz?`)) return;

    try {
      await apiFetch(`/app-api/company/org/departments/${row.id}`, { method: 'DELETE' });
      setNotice({ tone: 'success', text: 'Departman silindi.' });
      await load();
    } catch (error) {
      if (error instanceof ApiError) {
        setNotice({ tone: 'warning', text: error.message });
        return;
      }
      throw error;
    }
  }

  async function deleteTitle(row: Title) {
    if (!(row.canDelete ?? false)) {
      setNotice({ tone: 'warning', text: row.deleteBlockReason ?? 'Bu ünvan silinemiyor.' });
      return;
    }
    if (!window.confirm(`"${row.name}" ünvanını silmek istiyor musunuz?`)) return;

    try {
      await apiFetch(`/app-api/company/org/titles/${row.id}`, { method: 'DELETE' });
      setNotice({ tone: 'success', text: 'Ünvan silindi.' });
      await load();
    } catch (error) {
      if (error instanceof ApiError) {
        setNotice({ tone: 'warning', text: error.message });
        return;
      }
      throw error;
    }
  }

  async function persistDepartmentOrder(nextRows: OrgRow[]) {
    setReordering(true);
    try {
      await Promise.all(
        nextRows.map((row, index) =>
          apiFetch(`/app-api/company/org/departments/${row.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ sortOrder: (index + 1) * 100 })
          })
        )
      );
      setNotice({ tone: 'success', text: 'Departman sırası kaydedildi.' });
      await load();
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Departman sırası kaydedilemedi.' });
      handleApiError(error);
    } finally {
      setReordering(false);
      setDragItem(null);
    }
  }

  async function persistTitleOrder(departmentId: string, nextTitles: Title[]) {
    setReordering(true);
    try {
      await Promise.all(
        nextTitles.map((row, index) =>
          apiFetch(`/app-api/company/org/titles/${row.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ sortOrder: (index + 1) * 100, departmentId })
          })
        )
      );
      setNotice({ tone: 'success', text: 'Ünvan sırası kaydedildi.' });
      await load();
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Ünvan sırası kaydedilemedi.' });
      handleApiError(error);
    } finally {
      setReordering(false);
      setDragItem(null);
    }
  }

  function moveDepartment(targetId: string) {
    if (!dragItem || dragItem.type !== 'department' || dragItem.id === targetId) return;
    const ordered = [...orgRows];
    const fromIndex = ordered.findIndex((row) => row.id === dragItem.id);
    const toIndex = ordered.findIndex((row) => row.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = ordered.splice(fromIndex, 1);
    ordered.splice(toIndex, 0, moved);
    persistDepartmentOrder(ordered).catch(handleApiError);
  }

  function moveTitle(targetTitle: Title) {
    if (!dragItem || dragItem.type !== 'title' || dragItem.id === targetTitle.id) return;
    if (dragItem.departmentId !== targetTitle.departmentId) {
      setNotice({ tone: 'warning', text: 'Ünvanlar bu ekranda yalnızca kendi departmanı içinde taşınabilir.' });
      setDragItem(null);
      return;
    }
    const departmentTitles = sortTitles(titles.filter((row) => row.departmentId === targetTitle.departmentId));
    const fromIndex = departmentTitles.findIndex((row) => row.id === dragItem.id);
    const toIndex = departmentTitles.findIndex((row) => row.id === targetTitle.id);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = departmentTitles.splice(fromIndex, 1);
    departmentTitles.splice(toIndex, 0, moved);
    persistTitleOrder(targetTitle.departmentId, departmentTitles).catch(handleApiError);
  }

  const hasOrgData = orgRows.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Company</div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Company Org Directory</h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-600">
            Departman ve ünvan ana verisini burada yönetin. Diğer modüller bu yapıyı tek kaynak olarak kullanır.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openDepartmentEditor()}
            className="inline-flex h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Yeni Departman
          </button>
          <button
            type="button"
            onClick={() => openTitleEditor(undefined, orgRows[0]?.id)}
            disabled={!hasOrgData}
            className="inline-flex h-10 items-center justify-center rounded-full bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Yeni Ünvan
          </button>
        </div>
      </header>

      {notice ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm ${
            notice.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : notice.tone === 'warning'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {notice.text}
        </div>
      ) : null}

      {!loading && !hasOrgData ? (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-8 text-sm text-amber-800">
          Henüz departman bulunmuyor. İlk organizasyon yapısını oluşturmak için “Yeni Departman” ile başlayın.
        </div>
      ) : null}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Organizasyon Yapısı</h2>
            <p className="mt-1 text-xs text-slate-500">Departmanları ve ünvanları sürükleyerek sıralayabilirsiniz.</p>
          </div>
          {reordering ? <div className="text-xs text-slate-500">Sıralama kaydediliyor...</div> : null}
        </div>

        {loading ? (
          <div className="px-5 py-10 text-sm text-slate-500">Yükleniyor...</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {orgRows.map((department) => (
              <div
                key={department.id}
                className="px-5 py-4"
                draggable
                onDragStart={() => setDragItem({ type: 'department', id: department.id })}
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => moveDepartment(department.id)}
              >
                <div className="flex flex-col gap-3 rounded-2xl bg-slate-50 px-4 py-4 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-1">
                    <div className="text-base font-semibold text-slate-900">{department.name}</div>
                    <div className="text-sm text-slate-500">{department.titles.length} ünvan</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleDepartment(department).catch(handleApiError)}
                      className={`inline-flex h-9 items-center rounded-full px-3 text-sm font-medium ${
                        department.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {department.isActive ? 'Aktif' : 'Pasif'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openDepartmentEditor(department)}
                      className="inline-flex h-9 items-center rounded-full border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
                    >
                      Düzenle
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteDepartment(department).catch(handleApiError)}
                      className="inline-flex h-9 items-center rounded-full border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-white"
                    >
                      Sil
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-2 pl-2 md:pl-6">
                  {department.titles.map((title) => (
                    <div
                      key={title.id}
                      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between"
                      draggable
                      onDragStart={() => setDragItem({ type: 'title', id: title.id, departmentId: title.departmentId })}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => moveTitle(title)}
                    >
                      <div className="space-y-1">
                        <div className="text-sm font-medium text-slate-900">{title.name}</div>
                        <div className="text-xs text-slate-500">
                          {title.isActive ? 'Aktif ünvan' : 'Pasif ünvan'}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleTitle(title).catch(handleApiError)}
                          className={`inline-flex h-8 items-center rounded-full px-3 text-xs font-medium ${
                            title.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {title.isActive ? 'Aktif' : 'Pasif'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openTitleEditor(title)}
                          className="inline-flex h-8 items-center rounded-full border border-slate-200 px-3 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTitle(title).catch(handleApiError)}
                          className="inline-flex h-8 items-center rounded-full border border-slate-200 px-3 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                        >
                          Sil
                        </button>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={() => openTitleEditor(undefined, department.id)}
                    className="inline-flex h-10 items-center rounded-full border border-dashed border-slate-300 px-4 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
                  >
                    {department.name} için yeni ünvan
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {editor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {editor.type === 'department'
                    ? editor.id
                      ? 'Departmanı Düzenle'
                      : 'Yeni Departman'
                    : editor.id
                      ? 'Ünvanı Düzenle'
                      : 'Yeni Ünvan'}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {editor.type === 'department'
                    ? 'Departman ana verisini burada düzenleyin.'
                    : 'Ünvan her zaman bir departmana bağlı olmalıdır.'}
                </p>
              </div>
              <button type="button" onClick={() => setEditor(null)} className="text-sm text-slate-500 hover:text-slate-900">
                Kapat
              </button>
            </div>

            <form className="space-y-4" onSubmit={(event) => saveEditor(event).catch(handleApiError)}>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">Ad</label>
                <input
                  className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-300"
                  placeholder={editor.type === 'department' ? 'Departman adı' : 'Ünvan adı'}
                  value={editor.name}
                  onChange={(event) => setEditor({ ...editor, name: event.target.value })}
                  required
                />
              </div>

              {editor.type === 'title' ? (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-700">Departman</label>
                  <select
                    className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none transition focus:border-slate-300"
                    value={editor.departmentId}
                    onChange={(event) => setEditor({ ...editor, departmentId: event.target.value })}
                    required
                  >
                    <option value="">Departman seçin</option>
                    {orgRows.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={editor.isActive}
                  onChange={(event) => setEditor({ ...editor, isActive: event.target.checked })}
                />
                Kayıt aktif olsun
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditor(null)}
                  className="inline-flex h-10 items-center rounded-full border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex h-10 items-center rounded-full bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {saving ? 'Kaydediliyor...' : editor.id ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
