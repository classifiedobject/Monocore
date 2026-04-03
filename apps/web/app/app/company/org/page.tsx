'use client';

import { DragEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, apiFetch, handleApiError } from '../../../../lib/api';

type OrgTitle = {
  id: string;
  name: string;
  departmentId: string;
  sortOrder: number;
  isActive: boolean;
  canDelete?: boolean;
  deleteBlockReason?: string | null;
};

type OrgDepartment = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  canDelete?: boolean;
  deleteBlockReason?: string | null;
  titles: OrgTitle[];
};

type AlertTone = 'success' | 'warning' | 'error';

type AlertState = {
  tone: AlertTone;
  message: string;
} | null;

type DrawerState =
  | { kind: 'department-create' }
  | { kind: 'department-edit'; departmentId: string }
  | { kind: 'title-create'; departmentId?: string }
  | { kind: 'title-edit'; titleId: string }
  | null;

type DepartmentFormState = {
  name: string;
  isActive: boolean;
};

type TitleFormState = {
  name: string;
  departmentId: string;
  isActive: boolean;
};

const EMPTY_DEPARTMENT_FORM: DepartmentFormState = {
  name: '',
  isActive: true
};

const EMPTY_TITLE_FORM: TitleFormState = {
  name: '',
  departmentId: '',
  isActive: true
};

function parseApiMessage(error: unknown) {
  if (error instanceof ApiError) {
    try {
      const parsed = JSON.parse(error.message) as {
        error?: { message?: string };
        detail?: { message?: string };
        message?: string;
      };
      return parsed.error?.message ?? parsed.detail?.message ?? parsed.message ?? error.message;
    } catch {
      return error.message;
    }
  }

  if (error instanceof Error) return error.message;
  return 'Beklenmeyen bir hata oluştu.';
}

function moveBefore<T extends { id: string }>(items: T[], sourceId: string, targetId: string) {
  const sourceIndex = items.findIndex((item) => item.id === sourceId);
  const targetIndex = items.findIndex((item) => item.id === targetId);
  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return items;
  const next = [...items];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

function toneClasses(tone: AlertTone) {
  if (tone === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (tone === 'warning') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-red-200 bg-red-50 text-red-700';
}

function labelDeleteReason(reason?: string | null) {
  if (!reason) return 'Bu kayıt silinemiyor.';
  if (reason.includes('child departments')) return 'Alt departmanlar olduğu için departman silinemez.';
  if (reason.includes('titles')) return 'İçinde ünvan olduğu için departman silinemez.';
  if (reason.includes('assigned to employees')) return 'Ünvan başka kayıtlarda kullanıldığı için silinemez; pasife almayı tercih edin.';
  return reason;
}

function Pill({ active }: { active: boolean }) {
  return (
    <span
      className={[
        'inline-flex rounded-full px-2.5 py-1 text-xs font-medium',
        active ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200'
      ].join(' ')}
    >
      {active ? 'Aktif' : 'Pasif'}
    </span>
  );
}

function StatusToggle({
  value,
  onChange,
  activeLabel = 'Aktif',
  passiveLabel = 'Pasif'
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  activeLabel?: string;
  passiveLabel?: string;
}) {
  return (
    <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={[
          'rounded-full px-3 py-1.5 text-sm transition',
          value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
        ].join(' ')}
      >
        {activeLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={[
          'rounded-full px-3 py-1.5 text-sm transition',
          !value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
        ].join(' ')}
      >
        {passiveLabel}
      </button>
    </div>
  );
}

function DrawerShell({
  title,
  description,
  children,
  onClose
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/20 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="text-sm leading-6 text-slate-500">{description}</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-slate-500 transition hover:text-slate-900">
            Kapat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">{children}</div>
      </div>
    </div>
  );
}

export default function CompanyOrgPage() {
  const [departments, setDepartments] = useState<OrgDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [alert, setAlert] = useState<AlertState>(null);
  const [departmentForm, setDepartmentForm] = useState<DepartmentFormState>(EMPTY_DEPARTMENT_FORM);
  const [titleForm, setTitleForm] = useState<TitleFormState>(EMPTY_TITLE_FORM);
  const [draggingDepartmentId, setDraggingDepartmentId] = useState<string | null>(null);
  const [draggingTitle, setDraggingTitle] = useState<{ id: string; departmentId: string } | null>(null);

  const loadHierarchy = useCallback(async () => {
    const rows = (await apiFetch('/app-api/company/org/tree')) as OrgDepartment[];
    setDepartments(rows);
    return rows;
  }, []);

  useEffect(() => {
    loadHierarchy()
      .catch((error) => {
        setAlert({ tone: 'error', message: parseApiMessage(error) });
        handleApiError(error);
      })
      .finally(() => setLoading(false));
  }, [loadHierarchy]);

  const departmentsById = useMemo(() => new Map(departments.map((department) => [department.id, department])), [departments]);
  const activeDepartments = useMemo(() => departments.filter((department) => department.isActive), [departments]);

  function closeDrawer() {
    setDrawer(null);
    setDepartmentForm(EMPTY_DEPARTMENT_FORM);
    setTitleForm((current) => ({ ...EMPTY_TITLE_FORM, departmentId: current.departmentId }));
  }

  function openCreateDepartment() {
    setDepartmentForm(EMPTY_DEPARTMENT_FORM);
    setDrawer({ kind: 'department-create' });
  }

  function openEditDepartment(department: OrgDepartment) {
    setDepartmentForm({ name: department.name, isActive: department.isActive });
    setDrawer({ kind: 'department-edit', departmentId: department.id });
  }

  function openCreateTitle(preselectedDepartmentId?: string) {
    if (departments.length === 0) {
      setAlert({ tone: 'warning', message: 'Önce en az bir departman oluşturmanız gerekiyor.' });
      return;
    }
    setTitleForm({
      ...EMPTY_TITLE_FORM,
      departmentId: preselectedDepartmentId ?? departments[0]?.id ?? ''
    });
    setDrawer({ kind: 'title-create', departmentId: preselectedDepartmentId });
  }

  function openEditTitle(title: OrgTitle) {
    setTitleForm({ name: title.name, departmentId: title.departmentId, isActive: title.isActive });
    setDrawer({ kind: 'title-edit', titleId: title.id });
  }

  async function withFeedback<T>(action: () => Promise<T>, successMessage: string) {
    setSubmitting(true);
    try {
      const result = await action();
      setAlert({ tone: 'success', message: successMessage });
      return result;
    } catch (error) {
      const message = parseApiMessage(error);
      setAlert({ tone: 'error', message });
      if (!(error instanceof ApiError)) {
        handleApiError(error);
      }
      throw error;
    } finally {
      setSubmitting(false);
    }
  }

  async function submitDepartment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      name: departmentForm.name,
      isActive: departmentForm.isActive
    };

    const action = drawer?.kind === 'department-edit' && drawer.departmentId
      ? () => apiFetch(`/app-api/company/org/departments/${drawer.departmentId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        })
      : () => apiFetch('/app-api/company/org/departments', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

    await withFeedback(async () => {
      await action();
      await loadHierarchy();
      closeDrawer();
    }, drawer?.kind === 'department-edit' ? 'Departman güncellendi.' : 'Departman oluşturuldu.');
  }

  async function submitTitle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload = {
      name: titleForm.name,
      departmentId: titleForm.departmentId,
      isActive: titleForm.isActive
    };

    const action = drawer?.kind === 'title-edit' && drawer.titleId
      ? () => apiFetch(`/app-api/company/org/titles/${drawer.titleId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        })
      : () => apiFetch('/app-api/company/org/titles', {
          method: 'POST',
          body: JSON.stringify(payload)
        });

    await withFeedback(async () => {
      await action();
      await loadHierarchy();
      closeDrawer();
    }, drawer?.kind === 'title-edit' ? 'Ünvan güncellendi.' : 'Ünvan oluşturuldu.');
  }

  async function toggleDepartment(department: OrgDepartment) {
    await withFeedback(async () => {
      await apiFetch(`/app-api/company/org/departments/${department.id}/${department.isActive ? 'deactivate' : 'activate'}`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      await loadHierarchy();
    }, department.isActive ? 'Departman pasife alındı.' : 'Departman aktifleştirildi.');
  }

  async function toggleTitle(title: OrgTitle) {
    await withFeedback(async () => {
      await apiFetch(`/app-api/company/org/titles/${title.id}/${title.isActive ? 'deactivate' : 'activate'}`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      await loadHierarchy();
    }, title.isActive ? 'Ünvan pasife alındı.' : 'Ünvan aktifleştirildi.');
  }

  async function deleteDepartment(department: OrgDepartment) {
    if (!(department.canDelete ?? false)) {
      setAlert({ tone: 'warning', message: labelDeleteReason(department.deleteBlockReason) });
      return;
    }
    if (!window.confirm(`"${department.name}" departmanını silmek istiyor musunuz?`)) return;

    await withFeedback(async () => {
      await apiFetch(`/app-api/company/org/departments/${department.id}`, { method: 'DELETE' });
      await loadHierarchy();
    }, 'Departman silindi.');
  }

  async function deleteTitle(title: OrgTitle) {
    if (!(title.canDelete ?? false)) {
      setAlert({ tone: 'warning', message: labelDeleteReason(title.deleteBlockReason) });
      return;
    }
    if (!window.confirm(`"${title.name}" ünvanını silmek istiyor musunuz?`)) return;

    await withFeedback(async () => {
      await apiFetch(`/app-api/company/org/titles/${title.id}`, { method: 'DELETE' });
      await loadHierarchy();
    }, 'Ünvan silindi.');
  }

  async function persistDepartmentOrder(nextDepartments: OrgDepartment[]) {
    setDepartments(nextDepartments);
    try {
      const rows = (await apiFetch('/app-api/company/org/departments/reorder', {
        method: 'POST',
        body: JSON.stringify({ ids: nextDepartments.map((department) => department.id) })
      })) as OrgDepartment[];
      setDepartments(rows);
      setAlert({ tone: 'success', message: 'Departman sırası güncellendi.' });
    } catch (error) {
      setAlert({ tone: 'error', message: parseApiMessage(error) });
      await loadHierarchy().catch(handleApiError);
    }
  }

  async function persistTitleOrder(departmentId: string, nextTitles: OrgTitle[]) {
    const optimistic = departments.map((department) =>
      department.id === departmentId ? { ...department, titles: nextTitles } : department
    );
    setDepartments(optimistic);
    try {
      const rows = (await apiFetch('/app-api/company/org/titles/reorder', {
        method: 'POST',
        body: JSON.stringify({ departmentId, ids: nextTitles.map((title) => title.id) })
      })) as OrgDepartment[];
      setDepartments(rows);
      setAlert({ tone: 'success', message: 'Ünvan sırası güncellendi.' });
    } catch (error) {
      setAlert({ tone: 'error', message: parseApiMessage(error) });
      await loadHierarchy().catch(handleApiError);
    }
  }

  function onDepartmentDrop(targetDepartmentId: string) {
    if (!draggingDepartmentId || draggingDepartmentId === targetDepartmentId) return;
    const nextDepartments = moveBefore(departments, draggingDepartmentId, targetDepartmentId);
    setDraggingDepartmentId(null);
    persistDepartmentOrder(nextDepartments).catch(handleApiError);
  }

  function onTitleDrop(departmentId: string, targetTitleId: string) {
    if (!draggingTitle || draggingTitle.departmentId !== departmentId || draggingTitle.id === targetTitleId) return;
    const department = departmentsById.get(departmentId);
    if (!department) return;
    const nextTitles = moveBefore(department.titles, draggingTitle.id, targetTitleId);
    setDraggingTitle(null);
    persistTitleOrder(departmentId, nextTitles).catch(handleApiError);
  }

  function departmentRowClasses(active: boolean) {
    return [
      'rounded-2xl border px-5 py-4 transition',
      active ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50/70 text-slate-500'
    ].join(' ');
  }

  if (loading) {
    return (
      <section className="mx-auto w-full max-w-7xl space-y-6 px-1 pb-8 pt-2">
        <div className="space-y-2">
          <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
          <div className="h-10 w-72 animate-pulse rounded bg-slate-200" />
          <div className="h-4 w-[32rem] max-w-full animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-72 animate-pulse rounded-3xl border border-slate-200 bg-white" />
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-7xl space-y-6 px-1 pb-8 pt-2">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">Company</p>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Company Org Directory</h1>
            <p className="max-w-3xl text-sm leading-6 text-slate-500">
              Departman ve ünvan yapısını tek yerden yönetin. Payroll ve diğer modüller buradaki organizasyon verisini kullanmaya devam eder.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={openCreateDepartment}
            className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
          >
            Yeni Departman
          </button>
          <button
            type="button"
            onClick={() => openCreateTitle()}
            className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Yeni Ünvan
          </button>
        </div>
      </header>

      {alert ? (
        <div className={["rounded-2xl border px-4 py-3 text-sm", toneClasses(alert.tone)].join(' ')}>{alert.message}</div>
      ) : null}

      <article className="rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Organizasyon Yapısı</h2>
            <p className="mt-1 text-sm text-slate-500">Departmanları sürükleyerek yeniden sıralayın. Ünvanlar yalnızca kendi departmanı içinde taşınabilir.</p>
          </div>
          <div className="hidden text-xs text-slate-400 md:block">Sürükle bırak ile sıralama</div>
        </div>

        <div className="p-5 sm:p-6">
          {departments.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 px-8 py-16 text-center">
              <h3 className="text-lg font-semibold text-slate-900">Henüz departman bulunmuyor</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                Company Org artık yalnızca departman ve ünvan ana verisini yönetiyor. İlk departmanı oluşturup organizasyon yapısını kurmaya başlayın.
              </p>
              <button
                type="button"
                onClick={openCreateDepartment}
                className="mt-6 rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                İlk Departmanı Oluştur
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {departments.map((department) => (
                <section
                  key={department.id}
                  draggable
                  onDragStart={() => setDraggingDepartmentId(department.id)}
                  onDragEnd={() => setDraggingDepartmentId(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => onDepartmentDrop(department.id)}
                  className={departmentRowClasses(department.isActive)}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                      <span className="mt-1 select-none text-slate-300">⋮⋮</span>
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-slate-900">{department.name}</h3>
                          <Pill active={department.isActive} />
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                            {department.titles.length} ünvan
                          </span>
                        </div>
                        <p className="text-sm text-slate-500">
                          Ünvanlar bu departmanın altında gruplanır. Başka departmana taşıma yalnızca ünvan düzenleme ile yapılır.
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      <button
                        type="button"
                        onClick={() => openCreateTitle(department.id)}
                        className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                      >
                        Ünvan Ekle
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditDepartment(department)}
                        className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                      >
                        Düzenle
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleDepartment(department).catch(handleApiError)}
                        className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                      >
                        {department.isActive ? 'Pasife Al' : 'Aktifleştir'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteDepartment(department).catch(handleApiError)}
                        className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:border-slate-300 hover:text-red-600"
                      >
                        Sil
                      </button>
                    </div>
                  </div>

                  <div className="mt-5 overflow-x-auto">
                    <div className="min-w-[640px] overflow-hidden rounded-2xl border border-slate-200">
                      <div className="grid grid-cols-[56px,minmax(220px,1.2fr),minmax(140px,0.7fr),minmax(260px,1fr)] bg-slate-50 px-4 py-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                        <span />
                        <span>Ünvan</span>
                        <span>Durum</span>
                        <span>İşlemler</span>
                      </div>

                      {department.titles.length === 0 ? (
                        <div className="px-4 py-8 text-sm text-slate-500">Bu departmanda henüz ünvan tanımlı değil.</div>
                      ) : (
                        department.titles.map((title) => (
                          <div
                            key={title.id}
                            draggable
                            onDragStart={() => setDraggingTitle({ id: title.id, departmentId: department.id })}
                            onDragEnd={() => setDraggingTitle(null)}
                            onDragOver={(event: DragEvent<HTMLDivElement>) => event.preventDefault()}
                            onDrop={() => onTitleDrop(department.id, title.id)}
                            className={[
                              'grid grid-cols-[56px,minmax(220px,1.2fr),minmax(140px,0.7fr),minmax(260px,1fr)] items-center border-t border-slate-200 px-4 py-3 text-sm',
                              title.isActive ? 'bg-white text-slate-700' : 'bg-slate-50/70 text-slate-400'
                            ].join(' ')}
                          >
                            <span className="select-none text-slate-300">⋮⋮</span>
                            <div className="flex min-w-0 items-center gap-3">
                              <span className="truncate font-medium text-slate-900">{title.name}</span>
                            </div>
                            <div>
                              <Pill active={title.isActive} />
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => openEditTitle(title)}
                                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                              >
                                Düzenle
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleTitle(title).catch(handleApiError)}
                                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                              >
                                {title.isActive ? 'Pasife Al' : 'Aktifleştir'}
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteTitle(title).catch(handleApiError)}
                                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:text-red-600"
                              >
                                Sil
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </article>

      {drawer?.kind === 'department-create' || drawer?.kind === 'department-edit' ? (
        <DrawerShell
          title={drawer.kind === 'department-edit' ? 'Departmanı Düzenle' : 'Yeni Departman'}
          description="Company Org içindeki ana departman kayıtlarını buradan yönetirsiniz."
          onClose={closeDrawer}
        >
          <form className="space-y-6" onSubmit={(event) => submitDepartment(event).catch(() => undefined)}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Departman Adı</label>
              <input
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300"
                placeholder="Örn. Kitchen"
                value={departmentForm.name}
                onChange={(event) => setDepartmentForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Durum</label>
              <StatusToggle value={departmentForm.isActive} onChange={(next) => setDepartmentForm((current) => ({ ...current, isActive: next }))} />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-5">
              <button type="button" onClick={closeDrawer} className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900">
                Vazgeç
              </button>
              <button type="submit" disabled={submitting} className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? 'Kaydediliyor...' : drawer.kind === 'department-edit' ? 'Güncelle' : 'Kaydet'}
              </button>
            </div>
          </form>
        </DrawerShell>
      ) : null}

      {drawer?.kind === 'title-create' || drawer?.kind === 'title-edit' ? (
        <DrawerShell
          title={drawer.kind === 'title-edit' ? 'Ünvanı Düzenle' : 'Yeni Ünvan'}
          description="Ünvanlar her zaman bir departmana bağlıdır. Gerekirse düzenleme sırasında başka departmana taşıyabilirsiniz."
          onClose={closeDrawer}
        >
          <form className="space-y-6" onSubmit={(event) => submitTitle(event).catch(() => undefined)}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Ünvan Adı</label>
              <input
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300"
                placeholder="Örn. Waiter"
                value={titleForm.name}
                onChange={(event) => setTitleForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Bağlı Departman</label>
              <select
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-300"
                value={titleForm.departmentId}
                onChange={(event) => setTitleForm((current) => ({ ...current, departmentId: event.target.value }))}
                required
              >
                <option value="">Departman seçin</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Durum</label>
              <StatusToggle value={titleForm.isActive} onChange={(next) => setTitleForm((current) => ({ ...current, isActive: next }))} />
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-5">
              <button type="button" onClick={closeDrawer} className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900">
                Vazgeç
              </button>
              <button type="submit" disabled={submitting} className="rounded-full bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                {submitting ? 'Kaydediliyor...' : drawer.kind === 'title-edit' ? 'Güncelle' : 'Kaydet'}
              </button>
            </div>
          </form>
        </DrawerShell>
      ) : null}
    </section>
  );
}
