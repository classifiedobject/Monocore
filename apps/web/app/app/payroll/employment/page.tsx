'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch, handleApiError } from '../../../../lib/api';
import { PayrollDrawer, PayrollEmptyState, PayrollPageIntro, formatDate } from '../_components';
import type { PayrollEmployee, PayrollEmploymentRecord } from '../_types';

type EmploymentFormState = {
  employeeId: string;
  departmentName: string;
  titleName: string;
  arrivalDate: string;
  accrualStartDate: string;
  sgkStartDate: string;
  exitDate: string;
  insuranceStatus: 'insured' | 'exited' | 'pending';
  status: 'active' | 'exited' | 'draft';
};

const defaultForm: EmploymentFormState = {
  employeeId: '',
  departmentName: '',
  titleName: '',
  arrivalDate: '',
  accrualStartDate: '',
  sgkStartDate: '',
  exitDate: '',
  insuranceStatus: 'pending',
  status: 'active'
};

function mapRecordToForm(record: PayrollEmploymentRecord): EmploymentFormState {
  return {
    employeeId: record.employeeId,
    departmentName: record.departmentName ?? '',
    titleName: record.titleName ?? '',
    arrivalDate: record.arrivalDate.slice(0, 10),
    accrualStartDate: record.accrualStartDate.slice(0, 10),
    sgkStartDate: record.sgkStartDate ? record.sgkStartDate.slice(0, 10) : '',
    exitDate: record.exitDate ? record.exitDate.slice(0, 10) : '',
    insuranceStatus: record.insuranceStatus.toLowerCase() as EmploymentFormState['insuranceStatus'],
    status: record.status.toLowerCase() as EmploymentFormState['status']
  };
}

function employmentStatusLabel(status: PayrollEmploymentRecord['status']) {
  if (status === 'ACTIVE') return 'Aktif';
  if (status === 'EXITED') return 'Ayrıldı';
  return 'Taslak';
}

export default function PayrollEmploymentPage() {
  const [employees, setEmployees] = useState<PayrollEmployee[]>([]);
  const [records, setRecords] = useState<PayrollEmploymentRecord[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'exited' | 'draft'>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<PayrollEmploymentRecord | null>(null);
  const [form, setForm] = useState<EmploymentFormState>(defaultForm);
  const [submitting, setSubmitting] = useState(false);

  async function loadEmployees() {
    const rows = (await apiFetch('/app-api/payroll/employees?status=active')) as PayrollEmployee[];
    setEmployees(Array.isArray(rows) ? rows : []);
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
    Promise.all([loadEmployees(), loadRecords()]).catch(handleApiError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const employeeOptions = useMemo(
    () =>
      employees.map((employee) => ({
        id: employee.id,
        label: `${employee.firstName} ${employee.lastName}`
      })),
    [employees]
  );

  function resetAndClose() {
    setDrawerOpen(false);
    setEditing(null);
    setForm(defaultForm);
  }

  function openCreateDrawer() {
    setEditing(null);
    setForm({
      ...defaultForm,
      employeeId: employeeOptions[0]?.id ?? ''
    });
    setDrawerOpen(true);
  }

  function openEditDrawer(record: PayrollEmploymentRecord) {
    setEditing(record);
    setForm(mapRecordToForm(record));
    setDrawerOpen(true);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        employeeId: form.employeeId,
        departmentName: form.departmentName || null,
        titleName: form.titleName || null,
        arrivalDate: form.arrivalDate,
        accrualStartDate: form.accrualStartDate,
        sgkStartDate: form.sgkStartDate || null,
        exitDate: form.exitDate || null,
        insuranceStatus: form.insuranceStatus,
        status: form.status
      };

      if (editing) {
        await apiFetch(`/app-api/payroll/employment-records/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('/app-api/payroll/employment-records', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      resetAndClose();
      await loadRecords();
    } catch (error) {
      handleApiError(error);
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
        description="Çalışanların geliş, hakediş başlangıç ve SGK tarihlerini dönemsel olarak yönetin. Ayrılan çalışanlar geçmişte korunur."
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
          description="Bir çalışan oluşturup ardından geliş, hakediş ve SGK başlangıç tarihlerini içeren ilk istihdam kaydını ekleyin."
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
            <table className="w-full min-w-[1120px] text-sm">
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
                            onClick={() => exitRecord(record)}
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
        <form id="payroll-employment-form" className="space-y-6" onSubmit={submitForm}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Çalışan seç</span>
              <select
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-slate-900 outline-none focus:border-slate-300"
                value={form.employeeId}
                onChange={(event) => setForm((current) => ({ ...current, employeeId: event.target.value }))}
                required
              >
                <option value="">Seçiniz</option>
                {employeeOptions.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Departman Adı</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300"
                value={form.departmentName}
                onChange={(event) => setForm((current) => ({ ...current, departmentName: event.target.value }))}
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Ünvan Adı</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300"
                value={form.titleName}
                onChange={(event) => setForm((current) => ({ ...current, titleName: event.target.value }))}
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Sigorta Durumu</span>
              <select
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-slate-900 outline-none focus:border-slate-300"
                value={form.insuranceStatus}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    insuranceStatus: event.target.value as EmploymentFormState['insuranceStatus']
                  }))
                }
              >
                <option value="pending">Beklemede</option>
                <option value="insured">Sigortalı</option>
                <option value="exited">Ayrıldı</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Geliş Tarihi</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-slate-900 outline-none focus:border-slate-300"
                type="date"
                value={form.arrivalDate}
                onChange={(event) => setForm((current) => ({ ...current, arrivalDate: event.target.value }))}
                required
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Hakediş Başlangıç</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-slate-900 outline-none focus:border-slate-300"
                type="date"
                value={form.accrualStartDate}
                onChange={(event) => setForm((current) => ({ ...current, accrualStartDate: event.target.value }))}
                required
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">SGK Tarihi</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-slate-900 outline-none focus:border-slate-300"
                type="date"
                value={form.sgkStartDate}
                onChange={(event) => setForm((current) => ({ ...current, sgkStartDate: event.target.value }))}
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Çıkış Tarihi</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-slate-900 outline-none focus:border-slate-300"
                type="date"
                value={form.exitDate}
                onChange={(event) => setForm((current) => ({ ...current, exitDate: event.target.value }))}
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
              <span className="font-medium">Durum</span>
              <select
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-slate-900 outline-none focus:border-slate-300"
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as EmploymentFormState['status'] }))}
              >
                <option value="active">Aktif</option>
                <option value="draft">Taslak</option>
                <option value="exited">Ayrıldı</option>
              </select>
            </label>
          </div>
        </form>
      </PayrollDrawer>
    </section>
  );
}
