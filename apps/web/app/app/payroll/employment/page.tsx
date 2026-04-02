'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ApiError, apiFetch, handleApiError } from '../../../../lib/api';
import { PayrollDrawer, PayrollEmptyState, PayrollPageIntro, formatDate } from '../_components';
import type {
  CompanyDepartmentOption,
  CompanyTitleOption,
  PayrollEmployee,
  PayrollEmploymentRecord
} from '../_types';

type EmploymentFormState = {
  employeeId: string;
  departmentName: string;
  titleName: string;
  arrivalDate: string;
  sgkStartDate: string;
  exitDate: string;
  insuranceStatus: 'insured' | 'exited' | 'pending';
  status: 'active' | 'exited' | 'draft';
  identityNumberConfirmed: boolean;
};

const defaultForm: EmploymentFormState = {
  employeeId: '',
  departmentName: '',
  titleName: '',
  arrivalDate: '',
  sgkStartDate: '',
  exitDate: '',
  insuranceStatus: 'pending',
  status: 'active',
  identityNumberConfirmed: false
};

function mapRecordToForm(record: PayrollEmploymentRecord): EmploymentFormState {
  return {
    employeeId: record.employeeId,
    departmentName: record.departmentName ?? '',
    titleName: record.titleName ?? '',
    arrivalDate: record.arrivalDate.slice(0, 10),
    sgkStartDate: record.sgkStartDate ? record.sgkStartDate.slice(0, 10) : '',
    exitDate: record.exitDate ? record.exitDate.slice(0, 10) : '',
    insuranceStatus: record.insuranceStatus.toLowerCase() as EmploymentFormState['insuranceStatus'],
    status: record.status.toLowerCase() as EmploymentFormState['status'],
    identityNumberConfirmed: false
  };
}

function employmentStatusLabel(status: PayrollEmploymentRecord['status']) {
  if (status === 'ACTIVE') return 'Aktif';
  if (status === 'EXITED') return 'Ayrıldı';
  return 'Taslak';
}

export default function PayrollEmploymentPage() {
  const [employees, setEmployees] = useState<PayrollEmployee[]>([]);
  const [departments, setDepartments] = useState<CompanyDepartmentOption[]>([]);
  const [titles, setTitles] = useState<CompanyTitleOption[]>([]);
  const [records, setRecords] = useState<PayrollEmploymentRecord[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'exited' | 'draft'>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<PayrollEmploymentRecord | null>(null);
  const [form, setForm] = useState<EmploymentFormState>(defaultForm);
  const [entryFile, setEntryFile] = useState<File | null>(null);
  const [exitFile, setExitFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadMeta() {
    const [employeeRows, departmentRows, titleRows] = await Promise.all([
      apiFetch('/app-api/payroll/employees?status=active') as Promise<PayrollEmployee[]>,
      apiFetch('/app-api/company/org/departments') as Promise<CompanyDepartmentOption[]>,
      apiFetch('/app-api/company/org/titles') as Promise<CompanyTitleOption[]>
    ]);
    setEmployees(
      Array.isArray(employeeRows)
        ? [...employeeRows].sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'tr'))
        : []
    );
    setDepartments(
      Array.isArray(departmentRows)
        ? [...departmentRows].filter((row) => row.isActive).sort((a, b) => a.name.localeCompare(b.name, 'tr'))
        : []
    );
    setTitles(
      Array.isArray(titleRows)
        ? [...titleRows]
            .filter((row) => row.isActive)
            .sort((a, b) => {
              const depCompare = (a.department?.name ?? '').localeCompare(b.department?.name ?? '', 'tr');
              if (depCompare !== 0) return depCompare;
              return a.name.localeCompare(b.name, 'tr');
            })
        : []
    );
  }

  async function loadRecords(nextSearch = search, nextStatus = status) {
    const params = new URLSearchParams();
    if (nextSearch.trim()) params.set('search', nextSearch.trim());
    if (nextStatus !== 'all') params.set('status', nextStatus);
    const suffix = params.toString() ? `?${params.toString()}` : '';
    const rows = (await apiFetch(`/app-api/payroll/employment-records${suffix}`)) as PayrollEmploymentRecord[];
    setRecords(Array.isArray(rows) ? rows : []);
  }

  useEffect(() => {
    Promise.all([loadMeta(), loadRecords()]).catch(handleApiError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const employeeOptions = useMemo(
    () =>
      employees.map((employee) => ({
        id: employee.id,
        label: `${employee.lastName} ${employee.firstName}`,
        identityNumber: employee.identityNumber
      })),
    [employees]
  );

  const titleOptions = useMemo(() => {
    if (!form.departmentName) return titles;
    return titles.filter((title) => (title.department?.name ?? '') === form.departmentName);
  }, [form.departmentName, titles]);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === form.employeeId) ?? null,
    [employees, form.employeeId]
  );

  function resetAndClose() {
    setDrawerOpen(false);
    setEditing(null);
    setForm(defaultForm);
    setEntryFile(null);
    setExitFile(null);
    setFormError(null);
  }

  function openCreateDrawer() {
    setEditing(null);
    setForm({
      ...defaultForm,
      employeeId: employeeOptions[0]?.id ?? '',
      departmentName: departments[0]?.name ?? ''
    });
    setEntryFile(null);
    setExitFile(null);
    setFormError(null);
    setDrawerOpen(true);
  }

  function openEditDrawer(record: PayrollEmploymentRecord) {
    setEditing(record);
    setForm(mapRecordToForm(record));
    setEntryFile(null);
    setExitFile(null);
    setFormError(null);
    setDrawerOpen(true);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const formData = new FormData();
      formData.append('employeeId', form.employeeId);
      formData.append('departmentName', form.departmentName);
      formData.append('titleName', form.titleName);
      formData.append('arrivalDate', form.arrivalDate);
      formData.append('sgkStartDate', form.sgkStartDate || '');
      formData.append('exitDate', form.exitDate || '');
      formData.append('insuranceStatus', form.insuranceStatus);
      formData.append('status', form.status);
      formData.append('identityNumberConfirmed', String(form.identityNumberConfirmed));
      if (entryFile) formData.append('sgkEntryDocument', entryFile);
      if (exitFile) formData.append('sgkExitDocument', exitFile);

      if (editing) {
        await apiFetch(`/app-api/payroll/employment-records/${editing.id}`, {
          method: 'PATCH',
          body: formData
        });
      } else {
        await apiFetch('/app-api/payroll/employment-records', {
          method: 'POST',
          body: formData
        });
      }

      resetAndClose();
      await loadRecords();
    } catch (error) {
      if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        handleApiError(error);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function exitRecord(record: PayrollEmploymentRecord) {
    const exitDate = window.prompt('Çıkış tarihini YYYY-MM-DD formatında girin', new Date().toISOString().slice(0, 10));
    if (!exitDate) return;

    try {
      await apiFetch(`/app-api/payroll/employment-records/${record.id}/exit`, {
        method: 'POST',
        body: JSON.stringify({ exitDate, insuranceStatus: 'exited' })
      });
      await loadRecords();
    } catch (error) {
      handleApiError(error);
    }
  }

  return (
    <section className="space-y-6">
      <PayrollPageIntro
        title="Employment Records"
        description="İstihdam kayıtlarında geliş tarihi esas alınır; hakediş başlangıcı sistem tarafından geliş ve SGK tarihi içinden en erken tarihten türetilir."
        action={
          <button
            type="button"
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            onClick={openCreateDrawer}
          >
            Yeni İstihdam Kaydı
          </button>
        }
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
          <input
            className="h-11 rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300"
            placeholder="Çalışan, departman veya ünvan ile ara"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') loadRecords(event.currentTarget.value, status).catch(handleApiError);
            }}
          />
          <select
            className="h-11 rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none focus:border-slate-300"
            value={status}
            onChange={(event) => {
              const nextStatus = event.target.value as typeof status;
              setStatus(nextStatus);
              loadRecords(search, nextStatus).catch(handleApiError);
            }}
          >
            <option value="all">Tüm durumlar</option>
            <option value="active">Aktif</option>
            <option value="draft">Taslak</option>
            <option value="exited">Ayrıldı</option>
          </select>
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            onClick={() => loadRecords().catch(handleApiError)}
          >
            Ara
          </button>
        </div>
      </div>

      {records.length === 0 ? (
        <PayrollEmptyState
          title="Henüz istihdam kaydı yok"
          description="İlk istihdam kaydını eklediğinde SGK durumu, belge yükleme ve tarih temelli kayıt akışı hazır olacak."
          action={
            <button
              type="button"
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              onClick={openCreateDrawer}
            >
              Yeni İstihdam Kaydı
            </button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {[
                    'Çalışan',
                    'Departman',
                    'Ünvan',
                    'Geliş Tarihi',
                    'Hakediş Başlangıç',
                    'SGK Tarihi',
                    'Çıkış Tarihi',
                    'Durum',
                    'İşlemler'
                  ].map((label) => (
                    <th key={label} className="px-4 py-3 text-left font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className={`border-t border-slate-100 ${record.status === 'EXITED' ? 'bg-rose-50/30' : 'bg-white'}`}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {record.employee.firstName} {record.employee.lastName}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{record.departmentName || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{record.titleName || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(record.arrivalDate)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(record.accrualStartDate)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(record.sgkStartDate)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(record.exitDate)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {employmentStatusLabel(record.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 transition hover:bg-slate-50"
                          onClick={() => openEditDrawer(record)}
                        >
                          Düzenle
                        </button>
                        {record.status !== 'EXITED' ? (
                          <button
                            type="button"
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 transition hover:bg-slate-50"
                            onClick={() => exitRecord(record).catch(handleApiError)}
                          >
                            Çıkış Yap
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PayrollDrawer
        open={drawerOpen}
        title={editing ? 'İstihdam kaydını düzenle' : 'Yeni istihdam kaydı'}
        onClose={resetAndClose}
        footer={
          <>
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              onClick={resetAndClose}
            >
              İptal
            </button>
            <button
              type="submit"
              form="payroll-employment-form"
              disabled={submitting}
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Kaydediliyor...' : editing ? 'Güncelle' : 'Kaydet'}
            </button>
          </>
        }
      >
        <form id="payroll-employment-form" className="space-y-5" onSubmit={submitForm}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-600">
              <span className="font-medium text-slate-800">Çalışan</span>
              <select
                required
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none focus:border-slate-300"
                value={form.employeeId}
                onChange={(event) => setForm((current) => ({ ...current, employeeId: event.target.value, identityNumberConfirmed: false }))}
              >
                <option value="">Çalışan seç</option>
                {employeeOptions.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm text-slate-600">
              <span className="font-medium text-slate-800">Sigorta Durumu</span>
              <select
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none focus:border-slate-300"
                value={form.insuranceStatus}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    insuranceStatus: event.target.value as EmploymentFormState['insuranceStatus'],
                    status: event.target.value === 'exited' ? 'exited' : current.status
                  }))
                }
              >
                <option value="pending">Bekleniyor</option>
                <option value="insured">Sigortalı</option>
                <option value="exited">Çıkış Yapıldı</option>
              </select>
            </label>

            <label className="space-y-2 text-sm text-slate-600">
              <span className="font-medium text-slate-800">Departman</span>
              <select
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none focus:border-slate-300"
                value={form.departmentName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    departmentName: event.target.value,
                    titleName: ''
                  }))
                }
              >
                <option value="">Departman seç</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.name}>
                    {department.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm text-slate-600">
              <span className="font-medium text-slate-800">Ünvan</span>
              <select
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none focus:border-slate-300"
                value={form.titleName}
                onChange={(event) => setForm((current) => ({ ...current, titleName: event.target.value }))}
              >
                <option value="">Ünvan seç</option>
                {titleOptions.map((title) => (
                  <option key={title.id} value={title.name}>
                    {title.department?.name ? `${title.department.name} · ${title.name}` : title.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm text-slate-600">
              <span className="font-medium text-slate-800">Geliş Tarihi</span>
              <input
                required
                type="date"
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none focus:border-slate-300"
                value={form.arrivalDate}
                onChange={(event) => setForm((current) => ({ ...current, arrivalDate: event.target.value }))}
              />
            </label>

            {form.insuranceStatus !== 'pending' ? (
              <label className="space-y-2 text-sm text-slate-600">
                <span className="font-medium text-slate-800">SGK Başlangıç Tarihi</span>
                <input
                  type="date"
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none disabled:bg-slate-50 focus:border-slate-300"
                  value={form.sgkStartDate}
                  disabled={editing?.sgkEntryDocumentVerified}
                  onChange={(event) => setForm((current) => ({ ...current, sgkStartDate: event.target.value }))}
                />
              </label>
            ) : null}

            {form.insuranceStatus === 'exited' ? (
              <label className="space-y-2 text-sm text-slate-600">
                <span className="font-medium text-slate-800">Çıkış Tarihi</span>
                <input
                  type="date"
                  className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none disabled:bg-slate-50 focus:border-slate-300"
                  value={form.exitDate}
                  disabled={editing?.sgkExitDocumentVerified}
                  onChange={(event) => setForm((current) => ({ ...current, exitDate: event.target.value, status: 'exited' }))}
                />
              </label>
            ) : null}
          </div>

          {form.insuranceStatus === 'insured' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-600">
                <span className="font-medium text-slate-800">SGK Giriş Belgesi</span>
              <input
                  type="file"
                  accept=".pdf"
                  className="block w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5"
                  onChange={(event) => setEntryFile(event.target.files?.[0] ?? null)}
                />
                {editing?.sgkEntryDocumentName && !entryFile ? (
                  <p className="text-xs text-slate-500">Mevcut belge: {editing.sgkEntryDocumentName}</p>
                ) : null}
                {editing?.sgkEntryDocumentVerified ? (
                  <p className="text-xs font-medium text-emerald-600">Belge doğrulandı ✅</p>
                ) : formError?.includes('kimlik numarası') || formError?.includes('ad soyad') ? (
                  <p className="text-xs font-medium text-rose-600">Belge eşleşmedi ❌</p>
                ) : null}
              </label>
            </div>
          ) : null}

          {form.insuranceStatus === 'exited' ? (
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-600">
                <span className="font-medium text-slate-800">SGK Çıkış Belgesi</span>
                <input
                  type="file"
                  accept=".pdf"
                  className="block w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5"
                  onChange={(event) => setExitFile(event.target.files?.[0] ?? null)}
                />
                {editing?.sgkExitDocumentName && !exitFile ? (
                  <p className="text-xs text-slate-500">Mevcut belge: {editing.sgkExitDocumentName}</p>
                ) : null}
                {editing?.sgkExitDocumentVerified ? (
                  <p className="text-xs font-medium text-emerald-600">Belge doğrulandı ✅</p>
                ) : formError?.includes('kimlik numarası') || formError?.includes('ad soyad') ? (
                  <p className="text-xs font-medium text-rose-600">Belge eşleşmedi ❌</p>
                ) : null}
              </label>
            </div>
          ) : null}

          {(entryFile || exitFile) ? (
            <label className="inline-flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-900">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-amber-300 text-slate-900 focus:ring-0"
                checked={form.identityNumberConfirmed}
                onChange={(event) => setForm((current) => ({ ...current, identityNumberConfirmed: event.target.checked }))}
              />
              <span>
                Çalışanın kimlik numarasını belge ile manuel olarak kontrol ettim.
                {selectedEmployee?.identityNumber ? ` Kayıtlı kimlik no: ${selectedEmployee.identityNumber}` : ' Çalışan kaydında kimlik numarası bulunmuyor.'}
              </span>
            </label>
          ) : null}

          {formError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</div>
          ) : null}
        </form>
      </PayrollDrawer>
    </section>
  );
}
