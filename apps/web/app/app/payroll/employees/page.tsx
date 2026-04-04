'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { apiFetch, handleApiError } from '../../../../lib/api';
import { PayrollDrawer, PayrollEmptyState, PayrollPageIntro, formatDate } from '../_components';
import type { PayrollEmployee, PayrollEmployeeImportPreview } from '../_types';

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

  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<PayrollEmployeeImportPreview | null>(null);
  const [importFileName, setImportFileName] = useState('');

  async function loadEmployees(nextSearch = search, nextStatus = status) {
    const params = new URLSearchParams();
    if (nextSearch.trim()) params.set('search', nextSearch.trim());
    if (nextStatus !== 'all') params.set('status', nextStatus);

    const suffix = params.toString() ? `?${params.toString()}` : '';
    const rows = (await apiFetch(`/app-api/payroll/employees${suffix}`)) as PayrollEmployee[];
    setEmployees(Array.isArray(rows) ? [...rows].sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'tr')) : []);
  }

  useEffect(() => {
    loadEmployees().catch(handleApiError);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const employeeLabel = useMemo(() => (editing ? `${editing.firstName} ${editing.lastName}` : 'Yeni çalışan'), [editing]);

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

  function resetImportModal() {
    setImportOpen(false);
    setImportPreview(null);
    setImportFileName('');
    setImporting(false);
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

  async function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    setImporting(true);
    try {
      const preview = (await apiFetch('/app-api/payroll/employees/import/preview', {
        method: 'POST',
        body: formData
      })) as PayrollEmployeeImportPreview;
      setImportPreview(preview);
      setImportFileName(file.name);
    } catch (error) {
      handleApiError(error);
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  }

  async function confirmImport() {
    if (!importPreview?.validRows.length) return;
    setImporting(true);
    try {
      await apiFetch('/app-api/payroll/employees/import/confirm', {
        method: 'POST',
        body: JSON.stringify({
          rows: importPreview.validRows.map((row) => ({
            firstName: row.firstName,
            lastName: row.lastName,
            identityNumber: row.identityNumber,
            birthDate: row.birthDate || '',
            iban: row.iban || ''
          }))
        })
      });
      resetImportModal();
      await loadEmployees();
    } catch (error) {
      handleApiError(error);
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="space-y-6">
      <PayrollPageIntro
        title="Employees"
        description="Çalışan ana kayıtlarını burada tutun. Tekil çalışan kaydı oluşturabilir veya CSV ile toplu içe aktarım yapabilirsiniz."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              onClick={() => setImportOpen(true)}
            >
              Import Employees
            </button>
            <button
              type="button"
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              onClick={openCreateDrawer}
            >
              Yeni Çalışan
            </button>
          </div>
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
          description="İlk çalışan kaydını oluşturabilir veya CSV dosyası ile çalışan listenizi toplu olarak içe aktarabilirsiniz."
          action={
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                onClick={() => setImportOpen(true)}
              >
                Import Employees
              </button>
              <button
                type="button"
                className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
                onClick={openCreateDrawer}
              >
                Yeni Çalışan
              </button>
            </div>
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
        <form id="payroll-employee-form" className="space-y-5" onSubmit={submitForm}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm text-slate-600">
              <span className="font-medium text-slate-800">Ad</span>
              <input
                required
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300"
                placeholder="Örn. Deniz"
                value={form.firstName}
                onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
              />
            </label>
            <label className="space-y-2 text-sm text-slate-600">
              <span className="font-medium text-slate-800">Soyad</span>
              <input
                required
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300"
                placeholder="Örn. Yılmaz"
                value={form.lastName}
                onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
              />
            </label>
            <label className="space-y-2 text-sm text-slate-600">
              <span className="font-medium text-slate-800">Kimlik Numarası</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300"
                placeholder="11 haneli TCKN"
                value={form.identityNumber}
                onChange={(event) => setForm((current) => ({ ...current, identityNumber: event.target.value }))}
              />
            </label>
            <label className="space-y-2 text-sm text-slate-600">
              <span className="font-medium text-slate-800">Cinsiyet</span>
              <select
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none focus:border-slate-300"
                value={form.gender}
                onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value as EmployeeFormState['gender'] }))}
              >
                <option value="">Seçiniz</option>
                <option value="male">Erkek</option>
                <option value="female">Kadın</option>
                <option value="other">Diğer</option>
                <option value="unspecified">Belirtilmedi</option>
              </select>
            </label>
            <label className="space-y-2 text-sm text-slate-600">
              <span className="font-medium text-slate-800">Doğum Tarihi</span>
              <input
                type="date"
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none focus:border-slate-300"
                value={form.birthDate}
                onChange={(event) => setForm((current) => ({ ...current, birthDate: event.target.value }))}
              />
            </label>
            <label className="space-y-2 text-sm text-slate-600">
              <span className="font-medium text-slate-800">Banka / IBAN</span>
              <input
                className="h-11 w-full rounded-xl border border-slate-200 px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300"
                placeholder="TR ile başlayan IBAN veya hesap no"
                value={form.ibanOrBankAccount}
                onChange={(event) => setForm((current) => ({ ...current, ibanOrBankAccount: event.target.value }))}
              />
            </label>
          </div>

          <label className="block space-y-2 text-sm text-slate-600">
            <span className="font-medium text-slate-800">Notlar</span>
            <textarea
              rows={4}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-slate-300"
              placeholder="İstersen kısa açıklama ekleyebilirsin"
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
            />
          </label>

          <label className="inline-flex items-center gap-3 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-0"
              checked={form.isActive}
              onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
            />
            <span>Aktif çalışan</span>
          </label>
        </form>
      </PayrollDrawer>

      <PayrollDrawer
        open={importOpen}
        title="Çalışan içe aktar"
        onClose={resetImportModal}
        footer={
          <>
            <button
              type="button"
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              onClick={resetImportModal}
            >
              Kapat
            </button>
            <button
              type="button"
              disabled={!importPreview?.validRows.length || importing}
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => confirmImport().catch(handleApiError)}
            >
              {importing ? 'Aktarılıyor...' : `Geçerli Satırları Oluştur (${importPreview?.validRows.length ?? 0})`}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-800">CSV Kolonları</p>
              <p className="text-sm text-slate-500">firstName, lastName, identityNumber, birthDate, iban</p>
            </div>
            <label className="mt-4 inline-flex cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportFileChange} />
              {importing ? 'Dosya okunuyor...' : 'CSV Yükle'}
            </label>
            {importFileName ? <p className="mt-3 text-xs text-slate-500">Yüklenen dosya: {importFileName}</p> : null}
          </div>

          {importPreview ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-400">Toplam satır</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{importPreview.rows.length}</p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-emerald-600">Geçerli</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-800">{importPreview.validRows.length}</p>
                </div>
                <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-rose-600">Hatalı</p>
                  <p className="mt-2 text-2xl font-semibold text-rose-800">{importPreview.invalidRows.length}</p>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[860px] text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr>
                        {['Satır', 'Ad', 'Soyad', 'Kimlik No', 'Doğum Tarihi', 'IBAN', 'Durum'].map((label) => (
                          <th key={label} className="px-4 py-3 text-left font-medium">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.rows.map((row) => (
                        <tr key={row.rowNumber} className={`border-t border-slate-100 ${row.valid ? 'bg-white' : 'bg-rose-50/40'}`}>
                          <td className="px-4 py-3 text-slate-500">{row.rowNumber}</td>
                          <td className="px-4 py-3 text-slate-700">{row.firstName || '-'}</td>
                          <td className="px-4 py-3 text-slate-700">{row.lastName || '-'}</td>
                          <td className="px-4 py-3 text-slate-700">{row.identityNumber || '-'}</td>
                          <td className="px-4 py-3 text-slate-700">{row.birthDate || '-'}</td>
                          <td className="px-4 py-3 text-slate-700">{row.iban || '-'}</td>
                          <td className="px-4 py-3">
                            {row.valid ? (
                              <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                                Hazır
                              </span>
                            ) : (
                              <div className="space-y-1">
                                {row.errors.map((error) => (
                                  <p key={error} className="text-xs text-rose-700">
                                    {error}
                                  </p>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </PayrollDrawer>
    </section>
  );
}
