'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch, handleApiError } from '../../../../lib/api';
import { PayrollDrawer, PayrollEmptyState, PayrollPageIntro, formatDate } from '../_components';
import type { PayrollEmployee } from '../_types';

type EmployeeFormState = {
  firstName: string;
  lastName: string;
  identityNumber: string;
  gender: '' | 'male' | 'female' | 'other' | 'unspecified';
  birthDate: string;
  ibanOrBankAccount: string;
  notes: string;
  isActive: boolean;
};

const defaultForm: EmployeeFormState = {
  firstName: '',
  lastName: '',
  identityNumber: '',
  gender: '',
  birthDate: '',
  ibanOrBankAccount: '',
  notes: '',
  isActive: true
};

function mapEmployeeToForm(employee: PayrollEmployee): EmployeeFormState {
  return {
    firstName: employee.firstName,
    lastName: employee.lastName,
    identityNumber: employee.identityNumber ?? '',
    gender: employee.gender ? (employee.gender.toLowerCase() as EmployeeFormState['gender']) : '',
    birthDate: employee.birthDate ? employee.birthDate.slice(0, 10) : '',
    ibanOrBankAccount: employee.ibanOrBankAccount ?? '',
    notes: employee.notes ?? '',
    isActive: employee.isActive
  };
}

export default function PayrollEmployeesPage() {
  const [employees, setEmployees] = useState<PayrollEmployee[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<PayrollEmployee | null>(null);
  const [form, setForm] = useState<EmployeeFormState>(defaultForm);
  const [submitting, setSubmitting] = useState(false);

  async function loadEmployees(nextSearch = search, nextStatus = status) {
    const params = new URLSearchParams();
    if (nextSearch.trim()) params.set('search', nextSearch.trim());
    if (nextStatus !== 'all') params.set('status', nextStatus);

    const suffix = params.toString() ? `?${params.toString()}` : '';
    const rows = (await apiFetch(`/app-api/payroll/employees${suffix}`)) as PayrollEmployee[];
    setEmployees(Array.isArray(rows) ? rows : []);
  }

  useEffect(() => {
    loadEmployees().catch(handleApiError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const employeeLabel = useMemo(
    () => (editing ? `${editing.firstName} ${editing.lastName}` : 'Yeni çalışan'),
    [editing]
  );

  function resetAndClose() {
    setDrawerOpen(false);
    setEditing(null);
    setForm(defaultForm);
  }

  function openCreateDrawer() {
    setEditing(null);
    setForm(defaultForm);
    setDrawerOpen(true);
  }

  function openEditDrawer(employee: PayrollEmployee) {
    setEditing(employee);
    setForm(mapEmployeeToForm(employee));
    setDrawerOpen(true);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        identityNumber: form.identityNumber || null,
        gender: form.gender || null,
        birthDate: form.birthDate || null,
        ibanOrBankAccount: form.ibanOrBankAccount || null,
        notes: form.notes || null,
        isActive: form.isActive
      };

      if (editing) {
        await apiFetch(`/app-api/payroll/employees/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('/app-api/payroll/employees', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      resetAndClose();
      await loadEmployees();
    } catch (error) {
      handleApiError(error);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(employee: PayrollEmployee) {
    try {
      await apiFetch(`/app-api/payroll/employees/${employee.id}/${employee.isActive ? 'deactivate' : 'activate'}`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      await loadEmployees();
    } catch (error) {
      handleApiError(error);
    }
  }

  return (
    <section className="space-y-6">
      <PayrollPageIntro
        title="Employees"
        description="Çalışan ana kayıtları burada tutulur. İstihdam dönemleri ve ücret profilleri bu kayıtlara bağlanır."
        action={
          <button
            type="button"
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            onClick={openCreateDrawer}
          >
            Yeni Çalışan
          </button>
        }
      />

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_auto]">
          <input
            className="h-11 rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300"
            placeholder="Çalışan adı veya kimlik numarası ile ara"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') loadEmployees(event.currentTarget.value, status).catch(handleApiError);
            }}
          />
          <select
            className="h-11 rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none focus:border-slate-300"
            value={status}
            onChange={(event) => {
              const nextStatus = event.target.value as typeof status;
              setStatus(nextStatus);
              loadEmployees(search, nextStatus).catch(handleApiError);
            }}
          >
            <option value="all">Tüm durumlar</option>
            <option value="active">Aktif</option>
            <option value="inactive">Pasif</option>
          </select>
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            onClick={() => loadEmployees().catch(handleApiError)}
          >
            Ara
          </button>
        </div>
      </div>

      {employees.length === 0 ? (
        <PayrollEmptyState
          title="Henüz çalışan kaydı yok"
          description="İlk çalışan kaydını oluşturduğunuzda istihdam ve ücret profili akışını bu temel üzerine kuracağız."
          action={
            <button
              type="button"
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              onClick={openCreateDrawer}
            >
              Yeni Çalışan
            </button>
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {['Ad Soyad', 'Kimlik No', 'Cinsiyet', 'Doğum Tarihi', 'Durum', 'İşlemler'].map((label) => (
                    <th key={label} className="px-4 py-3 text-left font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr
                    key={employee.id}
                    className={`border-t border-slate-100 ${employee.isActive ? 'bg-white' : 'bg-rose-50/40'}`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {employee.firstName} {employee.lastName}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{employee.identityNumber || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{employee.gender || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(employee.birthDate)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                          employee.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {employee.isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 transition hover:bg-slate-50"
                          onClick={() => openEditDrawer(employee)}
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 transition hover:bg-slate-50"
                          onClick={() => toggleActive(employee)}
                        >
                          {employee.isActive ? 'Pasife Al' : 'Aktife Al'}
                        </button>
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
        title={editing ? `${employeeLabel} düzenle` : 'Yeni çalışan'}
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
              form="payroll-employee-form"
              disabled={submitting}
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Kaydediliyor...' : editing ? 'Güncelle' : 'Kaydet'}
            </button>
          </>
        }
      >
        <form id="payroll-employee-form" className="space-y-6" onSubmit={submitForm}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Ad</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300"
                value={form.firstName}
                onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                required
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Soyad</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300"
                value={form.lastName}
                onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                required
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Kimlik Numarası</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300"
                value={form.identityNumber}
                onChange={(event) => setForm((current) => ({ ...current, identityNumber: event.target.value }))}
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Cinsiyet</span>
              <select
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-slate-900 outline-none focus:border-slate-300"
                value={form.gender}
                onChange={(event) =>
                  setForm((current) => ({ ...current, gender: event.target.value as EmployeeFormState['gender'] }))
                }
              >
                <option value="">Seçiniz</option>
                <option value="male">Erkek</option>
                <option value="female">Kadın</option>
                <option value="other">Diğer</option>
                <option value="unspecified">Belirtmek istemiyorum</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Doğum Tarihi</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-slate-900 outline-none focus:border-slate-300"
                type="date"
                value={form.birthDate}
                onChange={(event) => setForm((current) => ({ ...current, birthDate: event.target.value }))}
              />
            </label>
            <label className="space-y-2 text-sm text-slate-700">
              <span className="font-medium">Banka / IBAN</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300"
                value={form.ibanOrBankAccount}
                onChange={(event) => setForm((current) => ({ ...current, ibanOrBankAccount: event.target.value }))}
              />
            </label>
          </div>
          <label className="space-y-2 text-sm text-slate-700">
            <span className="font-medium">Notlar</span>
            <textarea
              className="min-h-[120px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300"
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>
        </form>
      </PayrollDrawer>
    </section>
  );
}
